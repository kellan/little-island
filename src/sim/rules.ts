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
  CARRY_SPEED, CHOP_SECONDS, JOB_HISTORY_SECONDS, JOB_PRIORITY, MAX_JOBS_PER_VILLAGER,
  PILE_REACH, REST_SECONDS, ROAM_RADIUS, ROAM_SPEED, STOCKPILE_REACH, SWINGS_PER_SECOND,
  TREE_REACH, WALK_SPEED,
} from './tuning.ts';
import { accepts, type EmittedEvent, type Job, type Tree, type TravelPurpose, type Villager, type WarePile, type World } from './types.ts';
import {
  activeJobs, dropWare, findJob, findPile, findTree, findVillager, idleVillagers,
  jobForTree, loosePiles, openJobs, secondsToTicks,
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
const harvesters = (world: World) => world.villagers.filter(v => v.activity.kind === 'harvest');
const liveJobs = (world: World) => world.jobs.filter(job => job.state === 'queued' || job.state === 'assigned');
const targetOf = (job: Job) => job.kind === 'harvest' ? job.treeId : job.pileId;

/** Hand a job back: the villager forgets it and its target loses the claim. */
function release(world: World, job: Job | undefined, villager: Villager | undefined): void {
  if (job) {
    const claimant = villager?.id ?? null;
    const target = job.kind === 'harvest' ? findTree(world, job.treeId) : findPile(world, job.pileId);
    if (target && target.reservedBy === claimant) target.reservedBy = null;
    if (job.state !== 'done') { job.state = 'cancelled'; job.assignee = null; job.finishedTick = world.tick; }
  }
  if (villager) { villager.jobId = null; villager.activity = { kind: 'idle' }; }
}

function finish(world: World, job: Job | undefined, villager: Villager): void {
  if (job) { job.state = 'done'; job.assignee = null; job.finishedTick = world.tick; }
  villager.jobId = null;
  villager.activity = { kind: 'idle' };
}

function travelTo(villager: Villager, to: { x: number; z: number }, stopWithin: number, speed: number, purpose: TravelPurpose): void {
  villager.activity = { kind: 'travel', to: { x: to.x, z: to.z }, stopWithin, speed, purpose };
}

const chopDuration = (tree: Tree) => CHOP_SECONDS * tree.scale;
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
      if (command.kind === 'order-harvest') {
        const tree = findTree(world, command.treeId);
        if (!tree) { ctx.emit({ kind: 'order-rejected', treeId: command.treeId, reason: 'unknown-tree' }); continue; }
        if (tree.state === 'felled') { ctx.emit({ kind: 'order-rejected', treeId: tree.id, reason: 'already-felled' }); continue; }
        if (jobForTree(world, tree.id)) { ctx.emit({ kind: 'order-rejected', treeId: tree.id, reason: 'already-ordered' }); continue; }
        if (activeJobs(world).length >= MAX_JOBS_PER_VILLAGER * world.villagers.length) { ctx.emit({ kind: 'order-rejected', treeId: tree.id, reason: 'queue-full' }); continue; }
        const job: Job = {
          id: world.nextJobId++, kind: 'harvest', treeId: tree.id, state: 'queued',
          assignee: null, priority: JOB_PRIORITY.harvest, createdTick: world.tick, finishedTick: null,
        };
        world.jobs.push(job);
        world.stats.ordersQueued++;
        ctx.emit({ kind: 'order-queued', jobId: job.id, treeId: tree.id });
      } else {
        // Only the player's own orders can be called off; fetching is the settlement's business.
        const doomed = command.kind === 'cancel-all'
          ? world.jobs.filter(job => job.kind === 'harvest' && job.state === 'queued')
          : [jobForTree(world, command.treeId)].filter((job): job is Job => !!job);
        for (const job of doomed) {
          const worker = findVillager(world, job.assignee);
          // A felled log is already real: let the carrier finish the delivery.
          if (worker?.carrying) continue;
          release(world, job, worker);
          ctx.emit({ kind: 'order-cancelled', jobId: job.id, treeId: targetOf(job) });
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
    const tree = findTree(world, job.treeId);
    return !tree || tree.state === 'felled';
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
      id: world.nextJobId++, kind: 'haul', pileId: pile.id, state: 'queued',
      assignee: null, priority: JOB_PRIORITY.haul, createdTick: world.tick, finishedTick: null,
    });
  },
});

const assignJobs = defineRule<Job>({
  id: 'assign-jobs',
  phase: 'plan',
  about: 'Hands the most pressing queued job to the nearest free villager whose role takes that work.',
  subjects: (world) => openJobs(world).sort((a, b) => b.priority - a.priority || a.id - b.id),
  when: (world, job) => idleVillagers(world).some(villager => accepts(villager.role, job.kind)),
  then: (world, job, ctx) => {
    const target = job.kind === 'harvest' ? findTree(world, job.treeId) : findPile(world, job.pileId);
    if (!target) return;
    const worker = idleVillagers(world)
      .filter(villager => accepts(villager.role, job.kind))
      .sort((a, b) => distance(a, target) - distance(b, target) || a.id - b.id)[0];
    job.state = 'assigned';
    job.assignee = worker.id;
    worker.jobId = job.id;
    target.reservedBy = worker.id;
    if (job.kind === 'harvest') travelTo(worker, target, TREE_REACH, WALK_SPEED, 'harvest');
    else travelTo(worker, target, PILE_REACH, WALK_SPEED, 'collect');
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

const chop = defineRule<Villager>({
  id: 'chop',
  phase: 'act',
  about: 'Advances a chop and emits one swing event per axe stroke, so sound and dust follow the work.',
  subjects: harvesters,
  when: (_world, villager) => villager.activity.kind === 'harvest',
  then: (_world, villager, ctx) => {
    if (villager.activity.kind !== 'harvest') return;
    const before = Math.floor(villager.activity.progress * SWINGS_PER_SECOND);
    villager.activity.progress += ctx.dt;
    if (Math.floor(villager.activity.progress * SWINGS_PER_SECOND) !== before) {
      ctx.emit({ kind: 'chop-swing', villagerId: villager.id, treeId: villager.activity.treeId });
    }
  },
});

/* ----------------------------------------------------------------- resolve */

const arriveAtTree = defineRule<Villager>({
  id: 'arrive-at-tree',
  phase: 'resolve',
  about: 'Turns a walk into work once the villager is within arm’s reach of their tree.',
  subjects: travellers,
  when: (_world, villager) => arrivedTravelling(villager, 'harvest'),
  then: (world, villager, ctx) => {
    const job = findJob(world, villager.jobId);
    const tree = job?.kind === 'harvest' ? findTree(world, job.treeId) : undefined;
    if (!tree || tree.state === 'felled') {
      release(world, job, villager);
      ctx.emit({ kind: 'job-abandoned', jobId: job?.id ?? -1, job: 'harvest', targetId: job ? targetOf(job) : -1, villagerId: villager.id });
      return;
    }
    villager.activity = { kind: 'harvest', treeId: tree.id, progress: 0, duration: chopDuration(tree) };
  },
});

/** SETTLEMENT: the feller picks the log up themselves and walks it home. */
const fellTreeAndCarry = defineRule<Villager>({
  id: 'fell-tree',
  phase: 'resolve',
  about: 'Drops the tree when the chop completes and puts a log in the villager’s arms.',
  subjects: harvesters,
  when: (_world, villager) => villager.activity.kind === 'harvest' && villager.activity.progress >= villager.activity.duration,
  then: (world, villager, ctx) => {
    if (villager.activity.kind !== 'harvest') return;
    const tree = findTree(world, villager.activity.treeId);
    if (!tree) { release(world, findJob(world, villager.jobId), villager); return; }
    tree.state = 'felled';
    tree.reservedBy = null;
    world.stats.treesFelled++;
    villager.carrying = { ware: 'timber', amount: 1 };
    travelTo(villager, world.stockpile, STOCKPILE_REACH, CARRY_SPEED, 'deliver');
    ctx.emit({ kind: 'tree-felled', treeId: tree.id, villagerId: villager.id });
  },
});

/** HAULING: the log lands where the tree stood, and becomes somebody's errand. */
const fellTreeToGround = defineRule<Villager>({
  id: 'fell-tree-to-ground',
  phase: 'resolve',
  about: 'Drops the tree when the chop completes and leaves a log lying where it fell.',
  subjects: harvesters,
  when: (_world, villager) => villager.activity.kind === 'harvest' && villager.activity.progress >= villager.activity.duration,
  then: (world, villager, ctx) => {
    if (villager.activity.kind !== 'harvest') return;
    const tree = findTree(world, villager.activity.treeId);
    if (!tree) { release(world, findJob(world, villager.jobId), villager); return; }
    tree.state = 'felled';
    tree.reservedBy = null;
    world.stats.treesFelled++;
    const pile = dropWare(world, 'timber', tree);
    finish(world, findJob(world, villager.jobId), villager);
    ctx.emit({ kind: 'tree-felled', treeId: tree.id, villagerId: villager.id });
    ctx.emit({ kind: 'ware-dropped', ware: pile.ware, pileId: pile.id, x: pile.x, z: pile.z });
  },
});

const collectWare = defineRule<Villager>({
  id: 'collect-ware',
  phase: 'resolve',
  about: 'Picks a ware up off the ground and sets off for the stockpile with it.',
  subjects: travellers,
  when: (_world, villager) => arrivedTravelling(villager, 'collect'),
  then: (world, villager, ctx) => {
    const job = findJob(world, villager.jobId);
    const pile = job?.kind === 'haul' ? findPile(world, job.pileId) : undefined;
    if (!pile) {
      release(world, job, villager);
      ctx.emit({ kind: 'job-abandoned', jobId: job?.id ?? -1, job: 'haul', targetId: job ? targetOf(job) : -1, villagerId: villager.id });
      return;
    }
    world.piles = world.piles.filter(other => other.id !== pile.id);
    villager.carrying = { ware: pile.ware, amount: pile.amount };
    travelTo(villager, world.stockpile, STOCKPILE_REACH, CARRY_SPEED, 'deliver');
    ctx.emit({ kind: 'ware-collected', ware: pile.ware, amount: pile.amount, pileId: pile.id, villagerId: villager.id });
  },
});

const storeDelivery = defineRule<Villager>({
  id: 'store-delivery',
  phase: 'resolve',
  about: 'Adds a carried ware to the stockpile the moment the villager reaches the clearing.',
  subjects: travellers,
  when: (_world, villager) => arrivedTravelling(villager, 'deliver'),
  then: (world, villager, ctx) => {
    const load = villager.carrying;
    if (load) {
      world.stockpile.stock[load.ware] += load.amount;
      if (load.ware === 'timber') world.stats.logsDelivered += load.amount;
      villager.carrying = null;
      ctx.emit({ kind: 'ware-delivered', ware: load.ware, amount: load.amount, total: world.stockpile.stock[load.ware], villagerId: villager.id });
    }
    finish(world, findJob(world, villager.jobId), villager);
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

/** What the browser island runs: fell a tree, carry the log home yourself. */
export const SETTLEMENT: Rulebook = {
  id: 'settlement',
  about: 'One villager sees a job through from standing tree to stockpiled log.',
  rules: [
    acceptCommands,
    dropImpossibleJobs,
    assignJobs,
    walk,
    chop,
    arriveAtTree,
    fellTreeAndCarry,
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
    chop,
    arriveAtTree,
    fellTreeToGround,
    collectWare,
    storeDelivery,
    finishRoaming,
    wanderWhenIdle,
    forgetFinishedJobs,
  ],
};

export const RULEBOOKS: readonly Rulebook[] = [SETTLEMENT, HAULING];

/** The default rulebook, in execution order. */
export const RULES = SETTLEMENT.rules;
