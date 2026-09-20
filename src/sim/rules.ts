/**
 * The rule engine.
 *
 * A rule is three small parts: the `subjects` it looks at this tick, the `when`
 * that decides whether it applies, and the `then` that changes the world. Rules
 * never call each other and never touch a renderer. They run in phase order, and
 * inside a phase in the order the rulebook lists them, which is the entire
 * scheduling story: deterministic, inspectable, and re-orderable on purpose.
 *
 * There are two rulebooks. `SETTLEMENT` is what the browser island runs. `HAULING`
 * is the economy experiment: wares exist on the ground, and fetching one is a job.
 * They share every rule but one, which is the point of keeping rules as data.
 */
import { nextRandom } from './rng.ts';
import { HOME, distance, onLand } from './terrain.ts';
import {
  CARRY_SPEED, DAY_SECONDS, DOOR_REACH, JOB_HISTORY_SECONDS, JOB_PRIORITY, TASKS, type TaskSpec,
  MAX_JOBS_PER_VILLAGER, PILE_REACH, REST_SECONDS, ROAM_RADIUS, ROAM_SPEED, SITE_KINDS, STOCKPILE_REACH,
  SWINGS_PER_SECOND, TREE_REACH, WALK_SPEED,
} from './tuning.ts';
import { accepts, type Building, type WareId, type EmittedEvent, type Job, type Site, type TravelPurpose, type Villager, type WarePile, type World } from './types.ts';
import {
  activeJobs, availableSite, dropWare, findBuilding, findJob, findPile, findSite, findVillager,
  hasRoom, heldIn, idleVillagers, jobForSite, loosePiles, openJobs, roomForYield, secondsToTicks,
  shortOf, spare, taskIsReady, tasksFor, workplaceOf,
} from './world.ts';

/** Phases run in this order, every tick, always. */
export const PHASES = ['intake', 'plan', 'act', 'resolve', 'upkeep'] as const;
export type RulePhase = (typeof PHASES)[number];

/** Told, in order, which rules changed something this tick. Watching costs nothing. */
export type RuleTrace = (step: { rule: string; phase: RulePhase; fired: number }) => void;

export type RuleContext = {
  /** Seconds in one tick. The only source of time a rule may use. */
  dt: number;
  tick: number;
  emit(event: EmittedEvent): void;
  trace?: RuleTrace;
};

export type Rule<T> = {
  id: string;
  phase: RulePhase;
  /** One plain-language line explaining the rule; the docs are checked against these. */
  about: string;
  subjects(world: World): readonly T[];
  when(world: World, subject: T, ctx: RuleContext): boolean;
  then(world: World, subject: T, ctx: RuleContext): void;
};

export type CompiledRule = {
  id: string;
  phase: RulePhase;
  about: string;
  /** Runs the rule over its subjects and reports how many it acted on. */
  apply(world: World, ctx: RuleContext): number;
};

export type Rulebook = { id: string; about: string; rules: readonly CompiledRule[] };

export function defineRule<T>(rule: Rule<T>): CompiledRule {
  return {
    id: rule.id,
    phase: rule.phase,
    about: rule.about,
    apply(world, ctx) {
      let fired = 0;
      for (const subject of rule.subjects(world)) {
        if (!rule.when(world, subject, ctx)) continue;
        rule.then(world, subject, ctx);
        fired++;
      }
      if (fired && ctx.trace) ctx.trace({ rule: rule.id, phase: rule.phase, fired });
      return fired;
    },
  };
}

const ARRIVED = 1e-3;
const world1 = (world: World) => [world] as const;
const travellers = (world: World) => world.villagers.filter(v => v.activity.kind === 'travel');
const workers = (world: World) => world.villagers.filter(v => v.activity.kind === 'work');
const liveJobs = (world: World) => world.jobs.filter(job => job.state === 'queued' || job.state === 'assigned');
/** Free hands. Somebody who works at a building needs their tool before anything else. */
const available = (world: World) => idleVillagers(world).filter(v => v.workplace === null || (v.tool !== null && v.shiftDay === world.day));
const targetOf = (job: Job) => job.kind === 'task' ? job.siteId ?? -1 : job.kind === 'haul' ? job.pileId : job.from;

/** Where a carried ware is headed: the building that asked, or the carrier's own. */
function deliveryTarget(world: World, villager: Villager): Building | undefined {
  const job = findJob(world, villager.jobId);
  if (job?.kind === 'supply') return findBuilding(world, job.to);
  if (job?.kind === 'haul' && job.to !== null) return findBuilding(world, job.to);
  return workplaceOf(world, villager);
}

/** The input a working building lacks right now, or null while it can work. */
function shortageAt(building: Building): WareId | null {
  if (building.workerId === null) return null;
  for (const task of tasksFor(building)) {
    if (!roomForYield(building, task)) continue;
    for (const ingredient of task.takes ?? []) {
      if (building.stock[ingredient.ware] < ingredient.amount) return ingredient.ware;
    }
  }
  return null;
}

/** Hand a job back: the villager forgets it and its target loses the claim. */
function release(world: World, job: Job | undefined, villager: Villager | undefined): void {
  if (job) {
    const claimant = villager?.id ?? null;
    const target = job.kind === 'task' ? findSite(world, job.siteId) : job.kind === 'haul' ? findPile(world, job.pileId) : undefined;
    if (target && target.reservedBy === claimant) target.reservedBy = null;
    if (job.state !== 'done') { job.state = 'cancelled'; job.assignee = null; job.finishedTick = world.tick; }
  }
  if (villager) { villager.jobId = null; villager.activity = { kind: 'idle' }; }
}

/**
 * Close a finished job. It deliberately leaves the activity alone: work that ends
 * with something in your arms has already set off for somewhere to put it.
 */
function finish(world: World, job: Job | undefined, villager: Villager): void {
  if (job) { job.state = 'done'; job.assignee = null; job.finishedTick = world.tick; }
  villager.jobId = null;
}

function travelTo(villager: Villager, to: { x: number; z: number }, stopWithin: number, speed: number, purpose: TravelPurpose): void {
  villager.activity = { kind: 'travel', to: { x: to.x, z: to.z }, stopWithin, speed, purpose };
}

const workSeconds = (task: TaskSpec, site: Site | undefined) =>
  task.scaleWithSite && site ? task.seconds * site.scale : task.seconds;

/** Where a task is performed: at its site, or at the bench. */
function workPlace(world: World, job: Job): { x: number; z: number; reach: number } | undefined {
  if (job.kind !== 'task') return undefined;
  const site = findSite(world, job.siteId);
  if (site) return { x: site.x, z: site.z, reach: TREE_REACH };
  const building = findBuilding(world, job.buildingId);
  return building ? { x: building.x, z: building.z, reach: DOOR_REACH } : undefined;
}
const arrivedTravelling = (villager: Villager, purpose: TravelPurpose) =>
  villager.activity.kind === 'travel' && villager.activity.purpose === purpose
  && distance(villager, villager.activity.to) <= villager.activity.stopWithin + ARRIVED;

/* ------------------------------------------------------------------ intake */

const acceptCommands = defineRule<World>({
  id: 'accept-commands',
  phase: 'intake',
  about: 'Applies the orders the player queued since the last tick, one at a time, in order.',
  subjects: world1,
  when: (world) => world.inbox.length > 0,
  then: (world, _subject, ctx) => {
    const inbox = world.inbox;
    world.inbox = [];
    for (const command of inbox) {
      if (command.kind === 'order-fell') {
        const site = findSite(world, command.siteId);
        if (!site || site.kind !== TASKS.fell.site?.kind) { ctx.emit({ kind: 'order-rejected', siteId: command.siteId, reason: 'unknown-site' }); continue; }
        if (site.amount <= 0) { ctx.emit({ kind: 'order-rejected', siteId: site.id, reason: 'already-spent' }); continue; }
        if (jobForSite(world, site.id)) { ctx.emit({ kind: 'order-rejected', siteId: site.id, reason: 'already-ordered' }); continue; }
        if (activeJobs(world).length >= MAX_JOBS_PER_VILLAGER * world.villagers.length) { ctx.emit({ kind: 'order-rejected', siteId: site.id, reason: 'queue-full' }); continue; }
        const job: Job = {
          id: world.nextJobId++, kind: 'task', task: 'fell', siteId: site.id, buildingId: null, state: 'queued',
          assignee: null, priority: JOB_PRIORITY.task, createdTick: world.tick, finishedTick: null,
        };
        world.jobs.push(job);
        world.stats.ordersQueued++;
        ctx.emit({ kind: 'order-queued', jobId: job.id, siteId: site.id });
      } else {
        // Only the player's own orders can be called off; fetching is the settlement's business.
        const doomed = command.kind === 'cancel-all'
          ? world.jobs.filter(job => job.kind === 'task' && job.state === 'queued')
          : [jobForSite(world, command.siteId)].filter((job): job is Job => !!job);
        for (const job of doomed) {
          const worker = findVillager(world, job.assignee);
          // A felled log is already real: let the carrier finish the delivery.
          if (worker?.carrying) continue;
          release(world, job, worker);
          ctx.emit({ kind: 'order-cancelled', jobId: job.id, siteId: targetOf(job) });
        }
      }
    }
  },
});

/* -------------------------------------------------------------------- plan */

const dropImpossibleJobs = defineRule<Job>({
  id: 'drop-impossible-jobs',
  phase: 'plan',
  about: 'Cancels any job whose tree or ware has gone, freeing whoever was sent for it.',
  subjects: liveJobs,
  when: (world, job) => {
    const worker = findVillager(world, job.assignee);
    if (worker?.carrying) return false;
    if (job.kind === 'haul') return !findPile(world, job.pileId);
    if (job.kind === 'supply') {
      const source = findBuilding(world, job.from);
      return !source || !findBuilding(world, job.to) || source.stock[job.ware] < 1;
    }
    if (job.siteId === null) return false;
    const site = findSite(world, job.siteId);
    return !site || site.amount <= 0;
  },
  then: (world, job, ctx) => {
    const worker = findVillager(world, job.assignee);
    release(world, job, worker);
    ctx.emit({ kind: 'job-abandoned', jobId: job.id, job: job.kind, targetId: targetOf(job), villagerId: worker?.id ?? null });
  },
});

const listLooseWares = defineRule<WarePile>({
  id: 'list-loose-wares',
  phase: 'plan',
  about: 'Notices a ware lying on the ground and adds fetching it to the work list.',
  subjects: loosePiles,
  when: () => true,
  then: (world, pile) => {
    world.jobs.push({
      id: world.nextJobId++, kind: 'haul', pileId: pile.id, to: pile.destination, state: 'queued',
      assignee: null, priority: JOB_PRIORITY.haul, createdTick: world.tick, finishedTick: null,
    });
  },
});

const assignJobs = defineRule<Job>({
  id: 'assign-jobs',
  phase: 'plan',
  about: 'Hands the most pressing queued job to the nearest free villager whose role takes that work.',
  subjects: (world) => openJobs(world).sort((a, b) => b.priority - a.priority || a.id - b.id),
  when: (world, job) => available(world).some(villager => accepts(villager.role, job.kind)),
  then: (world, job, ctx) => {
    const target = job.kind === 'task' ? workPlace(world, job)
      : job.kind === 'haul' ? findPile(world, job.pileId)
      : findBuilding(world, job.from);
    if (!target) return;
    const worker = available(world)
      .filter(villager => accepts(villager.role, job.kind))
      .sort((a, b) => distance(a, target) - distance(b, target) || a.id - b.id)[0];
    job.state = 'assigned';
    job.assignee = worker.id;
    worker.jobId = job.id;
    if (job.kind === 'task') {
      const site = findSite(world, job.siteId);
      if (site) site.reservedBy = worker.id;
      travelTo(worker, target, 'reach' in target ? target.reach : TREE_REACH, WALK_SPEED, 'work');
    } else if (job.kind === 'haul') {
      const pile = findPile(world, job.pileId);
      if (pile) pile.reservedBy = worker.id;
      travelTo(worker, target, PILE_REACH, WALK_SPEED, 'fetch');
    } else {
      travelTo(worker, target, DOOR_REACH, WALK_SPEED, 'fetch');
    }
    ctx.emit({ kind: 'job-assigned', jobId: job.id, job: job.kind, targetId: targetOf(job), villagerId: worker.id });
  },
});

/* --------------------------------------------------------------------- act */

const walk = defineRule<Villager>({
  id: 'walk',
  phase: 'act',
  about: 'Moves a travelling villager toward their destination and turns them to face it.',
  subjects: travellers,
  when: (_world, villager) => villager.activity.kind === 'travel',
  then: (_world, villager, ctx) => {
    if (villager.activity.kind !== 'travel') return;
    const { to, stopWithin, speed } = villager.activity;
    const dx = to.x - villager.x, dz = to.z - villager.z;
    const far = Math.hypot(dx, dz);
    if (far < 1e-5) return;
    villager.facing = Math.atan2(dx, dz);
    const stride = Math.min(speed * ctx.dt, Math.max(0, far - stopWithin));
    villager.x += dx / far * stride;
    villager.z += dz / far * stride;
  },
});

const work = defineRule<Villager>({
  id: 'work',
  phase: 'act',
  about: 'Advances whatever work is in hand, and beats out a stroke so sound and dust can follow it.',
  subjects: workers,
  when: (_world, villager) => villager.activity.kind === 'work',
  then: (_world, villager, ctx) => {
    if (villager.activity.kind !== 'work') return;
    const before = Math.floor(villager.activity.progress * SWINGS_PER_SECOND);
    villager.activity.progress += ctx.dt;
    if (Math.floor(villager.activity.progress * SWINGS_PER_SECOND) !== before) {
      ctx.emit({ kind: 'work-stroke', villagerId: villager.id, task: villager.activity.task, siteId: villager.activity.siteId });
    }
  },
});

/* ----------------------------------------------------------------- resolve */

const arriveAtWork = defineRule<Villager>({
  id: 'arrive-at-work',
  phase: 'resolve',
  about: 'Turns a walk into work once the villager reaches the site, or the bench.',
  subjects: travellers,
  when: (_world, villager) => arrivedTravelling(villager, 'work'),
  then: (world, villager, ctx) => {
    const job = findJob(world, villager.jobId);
    const task = job?.kind === 'task' ? TASKS[job.task] : undefined;
    const site = job?.kind === 'task' ? findSite(world, job.siteId) : undefined;
    const building = job?.kind === 'task' ? findBuilding(world, job.buildingId) : undefined;
    const wrongPlace = task?.site && (!site || site.amount <= 0 || site.kind !== task.site.kind);
    if (!job || !task || wrongPlace) {
      release(world, job, villager);
      ctx.emit({ kind: 'job-abandoned', jobId: job?.id ?? -1, job: 'task', targetId: job ? targetOf(job) : -1, villagerId: villager.id });
      return;
    }
    villager.activity = {
      kind: 'work', task: task.id, siteId: site?.id ?? null, buildingId: building?.id ?? null,
      progress: 0, duration: workSeconds(task, site),
    };
  },
});

/**
 * The one rule that turns work into things. Takes the inputs, takes from the site,
 * and puts what comes out where the task says it goes.
 */
const finishWork = defineRule<Villager>({
  id: 'finish-work',
  phase: 'resolve',
  about: 'Takes the inputs, spends the site, and puts what the task yields where it belongs.',
  subjects: workers,
  when: (_world, villager) => villager.activity.kind === 'work' && villager.activity.progress >= villager.activity.duration,
  then: (world, villager, ctx) => {
    if (villager.activity.kind !== 'work') return;
    const { task: taskId, siteId, buildingId } = villager.activity;
    const task = TASKS[taskId];
    const site = findSite(world, siteId);
    const building = findBuilding(world, buildingId);
    const job = findJob(world, villager.jobId);
    villager.activity = { kind: 'idle' };
    if (!task) { release(world, job, villager); return; }

    for (const ingredient of task.takes ?? []) {
      if (!building || building.stock[ingredient.ware] < ingredient.amount) { release(world, job, villager); return; }
    }
    for (const ingredient of task.takes ?? []) {
      building!.stock[ingredient.ware] -= ingredient.amount;
      ctx.emit({ kind: 'ware-used', ware: ingredient.ware, amount: ingredient.amount, buildingId: building!.id });
    }
    if (task.site && site) {
      site.amount = Math.max(0, site.amount - task.site.take);
      site.reservedBy = null;
      if (site.amount === 0) {
        if (site.kind === 'tree') world.stats.treesFelled++;
        ctx.emit({ kind: 'site-spent', siteId: site.id, siteKind: site.kind, villagerId: villager.id });
      }
    }
    for (const produced of task.yields ?? []) {
      if (produced.to === 'hands' && !villager.carrying) {
        villager.carrying = { ware: produced.ware, amount: produced.amount };
        const home = building ?? undefined;
        if (home) travelTo(villager, home, DOOR_REACH, CARRY_SPEED, 'deliver');
        else travelTo(villager, world.stockpile, STOCKPILE_REACH, CARRY_SPEED, 'deliver');
        ctx.emit({ kind: 'ware-gathered', ware: produced.ware, amount: produced.amount, villagerId: villager.id });
      } else if (produced.to === 'ground') {
        const pile = dropWare(world, produced.ware, site ?? villager, produced.amount, building?.id ?? null);
        ctx.emit({ kind: 'ware-dropped', ware: pile.ware, pileId: pile.id, x: pile.x, z: pile.z });
      } else if (building) {
        building.stock[produced.ware] += produced.amount;
        ctx.emit({ kind: 'ware-made', ware: produced.ware, amount: produced.amount, stored: building.stock[produced.ware], buildingId: building.id, villagerId: villager.id });
        if (!hasRoom(building)) ctx.emit({ kind: 'store-full', buildingId: building.id });
      }
    }
    finish(world, job, villager);
  },
});

/**
 * SETTLEMENT only. Without the hauling rules, nobody would ever come back for what
 * was just made, so the worker shoulders it themselves and walks it home.
 */
const shoulderUnderfoot = defineRule<Villager>({
  id: 'shoulder-underfoot',
  phase: 'resolve',
  about: 'A villager with empty hands picks up what is lying at their feet and takes it home.',
  subjects: (world) => world.villagers.filter(v => v.activity.kind === 'idle' && !v.carrying && v.jobId === null),
  when: (world, villager) => world.piles.some(pile => pile.reservedBy === null && distance(pile, villager) <= TREE_REACH + ARRIVED),
  then: (world, villager, ctx) => {
    const pile = world.piles.find(other => other.reservedBy === null && distance(other, villager) <= TREE_REACH + ARRIVED)!;
    world.piles = world.piles.filter(other => other.id !== pile.id);
    villager.carrying = { ware: pile.ware, amount: pile.amount };
    const home = findBuilding(world, pile.destination) ?? workplaceOf(world, villager);
    if (home) travelTo(villager, home, DOOR_REACH, CARRY_SPEED, 'deliver');
    else travelTo(villager, world.stockpile, STOCKPILE_REACH, CARRY_SPEED, 'deliver');
    ctx.emit({ kind: 'ware-collected', ware: pile.ware, amount: pile.amount, pileId: pile.id, villagerId: villager.id });
  },
});

const collectWare = defineRule<Villager>({
  id: 'collect-ware',
  phase: 'resolve',
  about: 'Picks a ware up off the ground and sets off for the stockpile with it.',
  subjects: travellers,
  when: (_world, villager) => arrivedTravelling(villager, 'fetch'),
  then: (world, villager, ctx) => {
    const job = findJob(world, villager.jobId);
    if (job && job.kind !== 'haul') return; // A supply run is another rule's business.
    const pile = job?.kind === 'haul' ? findPile(world, job.pileId) : undefined;
    if (!pile) {
      release(world, job, villager);
      ctx.emit({ kind: 'job-abandoned', jobId: job?.id ?? -1, job: 'haul', targetId: job ? targetOf(job) : -1, villagerId: villager.id });
      return;
    }
    world.piles = world.piles.filter(other => other.id !== pile.id);
    villager.carrying = { ware: pile.ware, amount: pile.amount };
    // The pile said where it was headed; failing that, wherever the carrier works.
    const home = (job?.kind === 'haul' ? findBuilding(world, job.to) : undefined) ?? workplaceOf(world, villager);
    if (home) travelTo(villager, home, DOOR_REACH, CARRY_SPEED, 'deliver');
    else travelTo(villager, world.stockpile, STOCKPILE_REACH, CARRY_SPEED, 'deliver');
    ctx.emit({ kind: 'ware-collected', ware: pile.ware, amount: pile.amount, pileId: pile.id, villagerId: villager.id });
  },
});

const storeDelivery = defineRule<Villager>({
  id: 'store-delivery',
  phase: 'resolve',
  about: 'Adds a carried ware to the stockpile the moment the villager reaches the clearing.',
  subjects: travellers,
  when: (world, villager) => arrivedTravelling(villager, 'deliver')
    && distance(villager, world.stockpile) <= STOCKPILE_REACH + ARRIVED,
  then: (world, villager, ctx) => {
    const load = villager.carrying;
    if (load) {
      world.stockpile.stock[load.ware] += load.amount;
      if (load.ware === 'log') world.stats.logsDelivered += load.amount;
      villager.carrying = null;
      ctx.emit({ kind: 'ware-delivered', ware: load.ware, amount: load.amount, total: world.stockpile.stock[load.ware], villagerId: villager.id });
    }
    finish(world, findJob(world, villager.jobId), villager);
    villager.activity = { kind: 'idle' };
    villager.restUntil = world.tick + secondsToTicks(REST_SECONDS);
  },
});

const finishRoaming = defineRule<Villager>({
  id: 'finish-roaming',
  phase: 'resolve',
  about: 'Ends a wander at its destination and buys the villager a moment of rest.',
  subjects: travellers,
  when: (_world, villager) => arrivedTravelling(villager, 'roam'),
  then: (world, villager) => {
    villager.activity = { kind: 'idle' };
    villager.restUntil = world.tick + secondsToTicks(REST_SECONDS);
  },
});

/* ------------------------------------------------------------------ upkeep */

const wanderWhenIdle = defineRule<Villager>({
  id: 'wander-when-idle',
  phase: 'upkeep',
  about: 'Sends a rested villager with nothing left to do on a short stroll near the clearing.',
  subjects: (world) => world.villagers.filter(v => v.activity.kind === 'idle' && v.jobId === null),
  when: (world, villager) => world.tick >= villager.restUntil
    && !openJobs(world).some(job => accepts(villager.role, job.kind))
    && !(villager.role !== 'feller' && loosePiles(world).length > 0),
  then: (world, villager) => {
    const angle = nextRandom(world) * Math.PI * 2;
    const reach = .45 + nextRandom(world) * ROAM_RADIUS;
    const goal = { x: HOME.x + Math.sin(angle) * reach, z: HOME.z + Math.cos(angle) * reach * .95 };
    if (!onLand(goal.x, goal.z)) { villager.restUntil = world.tick + secondsToTicks(1); return; }
    travelTo(villager, goal, .05, ROAM_SPEED, 'roam');
  },
});

const regrowSites = defineRule<Site>({
  id: 'regrow-sites',
  phase: 'upkeep',
  about: 'Lets a picked-over patch come back, slowly, so foraging moves rather than ends.',
  subjects: (world) => world.sites.filter(site => site.amount < site.max && SITE_KINDS[site.kind].regrowSeconds > 0),
  when: (world, site) => world.tick % secondsToTicks(SITE_KINDS[site.kind].regrowSeconds) === 0,
  then: (_world, site) => { site.amount += 1; },
});

const forgetFinishedJobs = defineRule<World>({
  id: 'forget-finished-jobs',
  phase: 'upkeep',
  about: 'Prunes done and cancelled jobs a second after they end, keeping saved state small.',
  subjects: world1,
  when: (world) => world.jobs.some(job => job.finishedTick !== null && world.tick - job.finishedTick > secondsToTicks(JOB_HISTORY_SECONDS)),
  then: (world) => {
    world.jobs = world.jobs.filter(job => job.finishedTick === null || world.tick - job.finishedTick <= secondsToTicks(JOB_HISTORY_SECONDS));
  },
});

/* --------------------------------------------- working at a building */

const clockOn = defineRule<Villager>({
  id: 'clock-on',
  phase: 'plan',
  about: 'Sends a villager who has not started their day yet to their building to pick up the tool.',
  subjects: (world) => world.villagers.filter(v => v.workplace !== null && v.shiftDay !== world.day && !v.carrying),
  when: (world, villager) => villager.activity.kind === 'idle' && !!workplaceOf(world, villager),
  then: (world, villager) => {
    const hut = workplaceOf(world, villager)!;
    travelTo(villager, hut, DOOR_REACH, WALK_SPEED, 'clock-on');
  },
});

const takeTool = defineRule<Villager>({
  id: 'take-tool',
  phase: 'resolve',
  about: 'Hands the villager the axe kept at their building; the working day starts here.',
  subjects: travellers,
  when: (_world, villager) => arrivedTravelling(villager, 'clock-on'),
  then: (world, villager, ctx) => {
    const hut = workplaceOf(world, villager);
    villager.activity = { kind: 'idle' };
    if (!hut || villager.shiftDay === world.day) return;
    villager.tool = hut.tool;
    villager.shiftDay = world.day;
    ctx.emit({ kind: 'shift-started', villagerId: villager.id, buildingId: hut.id, tool: hut.tool });
  },
});

const pickATask = defineRule<Building>({
  id: 'pick-a-task',
  phase: 'plan',
  about: 'A building with a free worker starts the first of its tasks that can be done right now.',
  subjects: (world) => world.buildings.filter(building => building.workerId !== null),
  when: (world, building) => {
    const worker = findVillager(world, building.workerId);
    if (!worker || worker.tool === null || worker.shiftDay !== world.day) return false;
    if (worker.jobId !== null || worker.carrying) return false;
    if (worker.activity.kind === 'work') return false;
    return tasksFor(building).some(task => taskIsReady(world, building, task));
  },
  then: (world, building, ctx) => {
    const worker = findVillager(world, building.workerId)!;
    const task = tasksFor(building).find(candidate => taskIsReady(world, building, candidate))!;
    const site = task.site ? availableSite(world, building, task, worker) : undefined;
    const job: Job = {
      id: world.nextJobId++, kind: 'task', task: task.id, siteId: site?.id ?? null, buildingId: building.id,
      state: 'assigned', assignee: worker.id, priority: JOB_PRIORITY.task, createdTick: world.tick, finishedTick: null,
    };
    world.jobs.push(job);
    worker.jobId = job.id;
    if (site) site.reservedBy = worker.id;
    travelTo(worker, site ?? building, site ? TREE_REACH : DOOR_REACH, WALK_SPEED, 'work');
    ctx.emit({ kind: 'job-assigned', jobId: job.id, job: 'task', targetId: site?.id ?? -1, villagerId: worker.id });
  },
});

const storeInBuilding = defineRule<Villager>({
  id: 'store-in-building',
  phase: 'resolve',
  about: 'Puts a carried ware into the worker\u2019s own building, up to its capacity.',
  subjects: travellers,
  when: (world, villager) => arrivedTravelling(villager, 'deliver') && !!deliveryTarget(world, villager),
  then: (world, villager, ctx) => {
    const hut = deliveryTarget(world, villager)!;
    const load = villager.carrying;
    if (load && hasRoom(hut)) {
      hut.stock[load.ware] += load.amount;
      if (load.ware === 'log') world.stats.logsDelivered += load.amount;
      villager.carrying = null;
      ctx.emit({ kind: 'ware-stored', ware: load.ware, amount: load.amount, buildingId: hut.id, stored: heldIn(hut), capacity: hut.capacity, villagerId: villager.id });
      if (!hasRoom(hut)) ctx.emit({ kind: 'store-full', buildingId: hut.id });
    }
    finish(world, findJob(world, villager.jobId), villager);
    villager.activity = { kind: 'idle' };
    villager.restUntil = world.tick + secondsToTicks(REST_SECONDS);
  },
});

const newDay = defineRule<World>({
  id: 'new-day',
  phase: 'upkeep',
  about: 'Turns the day over; tools stay at the building, so everyone clocks on again.',
  subjects: world1,
  when: (world) => world.tick > 0 && world.tick % secondsToTicks(DAY_SECONDS) === 0,
  then: (world, _subject, ctx) => {
    world.day++;
    // The tools go back to the building. Anyone still working keeps theirs until
    // they finish, and clocks on again when they next come free.
    for (const villager of world.villagers) {
      if (villager.workplace !== null && villager.activity.kind === 'idle' && !villager.carrying) villager.tool = null;
    }
    ctx.emit({ kind: 'day-begins', day: world.day });
  },
});

/* ------------------------------------------------- making things */

const fetchInputs = defineRule<Building>({
  id: 'fetch-inputs',
  phase: 'plan',
  about: 'A building short of an input asks for one from whichever building has a spare.',
  subjects: (world) => world.buildings.filter(building => building.workerId !== null && shortOf(building) !== null),
  when: (world, building) => {
    const ware = shortOf(building)!;
    if (!hasRoom(building)) return false;
    if (world.jobs.some(job => job.kind === 'supply' && job.to === building.id && job.state !== 'done' && job.state !== 'cancelled')) return false;
    return world.buildings.some(other => other.id !== building.id && spare(other, ware) > 0);
  },
  then: (world, building, ctx) => {
    const ware = shortOf(building)!;
    const source = world.buildings
      .filter(other => other.id !== building.id && spare(other, ware) > 0)
      .sort((a, b) => distance(a, building) - distance(b, building) || a.id - b.id)[0];
    const job: Job = {
      id: world.nextJobId++, kind: 'supply', ware, from: source.id, to: building.id,
      state: 'queued', assignee: null, priority: JOB_PRIORITY.haul, createdTick: world.tick, finishedTick: null,
    };
    world.jobs.push(job);
    ctx.emit({ kind: 'supply-asked', jobId: job.id, ware, from: source.id, to: building.id });
  },
});

const collectFromStore = defineRule<Villager>({
  id: 'collect-from-store',
  phase: 'resolve',
  about: 'Takes a ware out of one building\u2019s store and sets off for the building that asked.',
  subjects: travellers,
  when: (world, villager) => {
    if (!arrivedTravelling(villager, 'fetch')) return false;
    return findJob(world, villager.jobId)?.kind === 'supply';
  },
  then: (world, villager, ctx) => {
    const job = findJob(world, villager.jobId)!;
    if (job.kind !== 'supply') return;
    const source = findBuilding(world, job.from), destination = findBuilding(world, job.to);
    if (!source || !destination || source.stock[job.ware] < 1) {
      release(world, job, villager);
      ctx.emit({ kind: 'job-abandoned', jobId: job.id, job: 'supply', targetId: job.from, villagerId: villager.id });
      return;
    }
    source.stock[job.ware] -= 1;
    villager.carrying = { ware: job.ware, amount: 1 };
    travelTo(villager, destination, DOOR_REACH, CARRY_SPEED, 'deliver');
    ctx.emit({ kind: 'ware-taken', ware: job.ware, amount: 1, buildingId: source.id, villagerId: villager.id });
  },
});

const noteShortage = defineRule<Building>({
  id: 'note-shortage',
  phase: 'upkeep',
  about: 'Records what a building is waiting for, so a stalled workshop says why.',
  subjects: (world) => world.buildings.filter(building => tasksFor(building).some(task => (task.takes ?? []).length > 0)),
  when: (_world, building) => shortageAt(building) !== building.waiting,
  then: (_world, building, ctx) => {
    building.waiting = shortageAt(building);
    if (building.waiting) ctx.emit({ kind: 'waiting-for', ware: building.waiting, buildingId: building.id });
  },
});

/** What the browser island runs: fell a tree, carry the log home yourself. */
export const SETTLEMENT: Rulebook = {
  id: 'settlement',
  about: 'One villager sees a job through from standing tree to stockpiled log.',
  rules: [
    acceptCommands,
    dropImpossibleJobs,
    assignJobs,
    walk,
    work,
    arriveAtWork,
    finishWork,
    shoulderUnderfoot,
    storeDelivery,
    finishRoaming,
    wanderWhenIdle,
    forgetFinishedJobs,
  ],
};

/** The economy experiment: wares exist on the ground, and fetching one is a job. */
export const HAULING: Rulebook = {
  id: 'hauling',
  about: 'A felled tree leaves a log where it fell; carrying it home is separate work.',
  rules: [
    acceptCommands,
    dropImpossibleJobs,
    listLooseWares,
    assignJobs,
    walk,
    work,
    arriveAtWork,
    finishWork,
    collectWare,
    storeDelivery,
    finishRoaming,
    wanderWhenIdle,
    forgetFinishedJobs,
  ],
};

/** Buildings give out the work, and every building is a row in a table. */
export const VILLAGE: Rulebook = {
  id: 'village',
  about: 'Buildings give out the work: fell and haul at the hut, saw logs into planks at the mill.',
  rules: [
    acceptCommands,
    dropImpossibleJobs,
    clockOn,
    // Work already in hand comes first: hand out the hauling, and only then let a
    // building start something new. The other order fells the forest and carries none of it.
    listLooseWares,
    fetchInputs,
    assignJobs,
    pickATask,
    walk,
    work,
    takeTool,
    arriveAtWork,
    finishWork,
    collectWare,
    collectFromStore,
    storeInBuilding,
    storeDelivery,
    finishRoaming,
    wanderWhenIdle,
    noteShortage,
    regrowSites,
    newDay,
    forgetFinishedJobs,
  ],
};

export const RULEBOOKS: readonly Rulebook[] = [SETTLEMENT, HAULING, VILLAGE];

/** The default rulebook, in execution order. */
export const RULES = SETTLEMENT.rules;
