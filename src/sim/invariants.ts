/**
 * What must be true of any world, at any moment, under any rulebook.
 *
 * Rules are small and local; the damage they do is not. A rule that forgets to
 * clear a reservation, or hands one job to two people, produces a world that
 * still ticks along quite happily while the settlement quietly stops making
 * sense. These checks are the tripwire: cheap enough to run after every tick in
 * a test, and available from the terminal as `check`.
 */
import { heldIn } from './world.ts';
import { TASKS } from './tuning.ts';
import { WARES, type WareId, type World, type SimEvent } from './types.ts';

export type Violation = { invariant: string; detail: string };

const whole = (value: number) => Number.isInteger(value) && value >= 0;

/** Every ware in the world, wherever it is sitting. */
export function census(world: World): Record<WareId, number> {
  const total = Object.fromEntries(WARES.map(ware => [ware, 0])) as Record<WareId, number>;
  for (const ware of WARES) total[ware] += world.stockpile.stock[ware];
  for (const building of world.buildings) for (const ware of WARES) total[ware] += building.stock[ware];
  for (const pile of world.piles) total[pile.ware] += pile.amount;
  for (const villager of world.villagers) if (villager.carrying) total[villager.carrying.ware] += villager.carrying.amount;
  return total;
}

/**
 * How many wares the events in a tick claim to have created or destroyed.
 * Everything else only moves them, so the census must move by exactly this much.
 */
export function ledger(events: SimEvent[]): Record<WareId, number> {
  const delta = Object.fromEntries(WARES.map(ware => [ware, 0])) as Record<WareId, number>;
  for (const event of events) {
    if (event.kind === 'ware-dropped') delta[event.ware] += 1;
    else if (event.kind === 'ware-made') delta[event.ware] += event.amount;
    else if (event.kind === 'ware-used') delta[event.ware] -= event.amount;
  }
  return delta;
}

export function checkWorld(world: World): Violation[] {
  const broken: Violation[] = [];
  const fail = (invariant: string, detail: string) => broken.push({ invariant, detail });

  // Wares are whole things in one place.
  for (const ware of WARES) {
    if (!whole(world.stockpile.stock[ware])) fail('ware-counts-are-whole', `the clearing holds ${world.stockpile.stock[ware]} ${ware}`);
  }
  for (const building of world.buildings) {
    for (const ware of WARES) if (!whole(building.stock[ware])) fail('ware-counts-are-whole', `building ${building.id} holds ${building.stock[ware]} ${ware}`);
    if (heldIn(building) > building.capacity) fail('stores-within-capacity', `building ${building.id} holds ${heldIn(building)} of ${building.capacity}`);
  }
  for (const pile of world.piles) {
    if (!whole(pile.amount) || pile.amount < 1) fail('ware-counts-are-whole', `pile ${pile.id} is ${pile.amount} ${pile.ware}`);
    if (pile.destination !== null && !world.buildings.some(b => b.id === pile.destination)) fail('piles-go-somewhere-real', `pile ${pile.id} is bound for building ${pile.destination}`);
  }

  const villagers = new Map(world.villagers.map(villager => [villager.id, villager]));
  const jobs = new Map(world.jobs.map(job => [job.id, job]));
  const live = world.jobs.filter(job => job.state === 'queued' || job.state === 'assigned');

  // Jobs and the people doing them agree with each other.
  const claimedJobs = new Set<number>();
  for (const villager of world.villagers) {
    if (villager.carrying && (!whole(villager.carrying.amount) || villager.carrying.amount < 1)) {
      fail('ware-counts-are-whole', `${villager.name} carries ${villager.carrying.amount} ${villager.carrying.ware}`);
    }
    if (villager.jobId === null) continue;
    const job = jobs.get(villager.jobId);
    if (!job) { fail('jobs-and-workers-agree', `${villager.name} holds job ${villager.jobId}, which does not exist`); continue; }
    if (job.assignee !== villager.id) fail('jobs-and-workers-agree', `${villager.name} holds job ${job.id}, assigned to ${job.assignee}`);
    if (claimedJobs.has(job.id)) fail('jobs-and-workers-agree', `job ${job.id} is held by more than one villager`);
    claimedJobs.add(job.id);
  }
  for (const job of live) {
    if (job.assignee === null) continue;
    const worker = villagers.get(job.assignee);
    if (!worker) { fail('jobs-and-workers-agree', `job ${job.id} is assigned to villager ${job.assignee}, who does not exist`); continue; }
    if (worker.jobId !== job.id) fail('jobs-and-workers-agree', `job ${job.id} thinks ${worker.name} is on it, and they are on ${worker.jobId}`);
  }
  for (const job of live) {
    const missing = job.kind === 'task' ? job.siteId !== null && !world.sites.some(site => site.id === job.siteId)
      : job.kind === 'haul' ? !world.piles.some(pile => pile.id === job.pileId) && !villagers.get(job.assignee ?? -1)?.carrying
      : !world.buildings.some(b => b.id === job.from) || !world.buildings.some(b => b.id === job.to);
    if (missing) fail('jobs-point-at-something', `live ${job.kind} job ${job.id} has no target`);
  }

  // A claim on a site or a pile means somebody is actually on their way.
  for (const site of world.sites) {
    if (!whole(site.amount)) fail('ware-counts-are-whole', `site ${site.id} has ${site.amount} left`);
    if (site.reservedBy === null) continue;
    if (!villagers.has(site.reservedBy)) fail('reservations-are-mutual', `site ${site.id} is claimed by villager ${site.reservedBy}, who does not exist`);
    else if (!live.some(job => job.kind === 'task' && job.siteId === site.id && job.assignee === site.reservedBy)) {
      fail('reservations-are-mutual', `site ${site.id} is claimed by ${site.reservedBy} with no live job to match`);
    }
  }
  for (const pile of world.piles) {
    if (pile.reservedBy === null) continue;
    if (!villagers.has(pile.reservedBy)) fail('reservations-are-mutual', `pile ${pile.id} is claimed by villager ${pile.reservedBy}, who does not exist`);
  }

  // Workers and their buildings point at each other.
  for (const villager of world.villagers) {
    if (villager.workplace === null) {
      if (villager.tool !== null) fail('tools-come-from-buildings', `${villager.name} holds a ${villager.tool} but works nowhere`);
      continue;
    }
    const building = world.buildings.find(b => b.id === villager.workplace);
    if (!building) fail('workers-and-buildings-agree', `${villager.name} works at building ${villager.workplace}, which does not exist`);
    else if (building.workerId !== villager.id) fail('workers-and-buildings-agree', `${villager.name} works at building ${building.id}, which employs ${building.workerId}`);
  }
  for (const building of world.buildings) {
    if (building.workerId === null) continue;
    const worker = villagers.get(building.workerId);
    if (!worker) fail('workers-and-buildings-agree', `building ${building.id} employs villager ${building.workerId}, who does not exist`);
    else if (worker.workplace !== building.id) fail('workers-and-buildings-agree', `building ${building.id} employs ${worker.name}, who works at ${worker.workplace}`);
  }

  // Everyone is somewhere, doing something that exists.
  for (const villager of world.villagers) {
    if (![villager.x, villager.z, villager.facing].every(Number.isFinite)) fail('everyone-is-somewhere', `${villager.name} is at ${villager.x}, ${villager.z}`);
    if (Math.abs(villager.x) > 25 || Math.abs(villager.z) > 22) fail('everyone-is-somewhere', `${villager.name} has left the island at ${villager.x.toFixed(1)}, ${villager.z.toFixed(1)}`);
    const activity = villager.activity;
    if (activity.kind === 'work' && activity.siteId !== null && !world.sites.some(site => site.id === activity.siteId)) fail('activities-make-sense', `${villager.name} is working site ${activity.siteId}, which does not exist`);
    if (activity.kind === 'work' && activity.buildingId !== null && !world.buildings.some(b => b.id === activity.buildingId)) fail('activities-make-sense', `${villager.name} is working at building ${activity.buildingId}, which does not exist`);
    if (activity.kind === 'work' && !TASKS[activity.task]) fail('activities-make-sense', `${villager.name} is doing "${activity.task}", which is not a task`);
    if (activity.kind === 'travel' && ![activity.to.x, activity.to.z].every(Number.isFinite)) fail('activities-make-sense', `${villager.name} is walking to nowhere`);
  }

  return broken;
}

/** Throws with everything that is wrong, or returns the world unchanged. */
export function assertSound(world: World, note = ''): World {
  const broken = checkWorld(world);
  if (broken.length) {
    throw new Error(`${broken.length} broken invariant${broken.length === 1 ? '' : 's'}${note ? ` ${note}` : ''} at tick ${world.tick}:\n` +
      broken.map(v => `  ${v.invariant}: ${v.detail}`).join('\n'));
  }
  return world;
}
