import { nextRandom } from './rng';
import { HOME, distance, onLand } from './terrain';
import { ISLAND_SEED, TICK_SECONDS, TREE_COUNT } from './tuning';
import type { Job, Tree, TreeKind, Vec2, Villager, World } from './types';

/** Seconds of world time. Derived from whole ticks, so it can never drift. */
export function elapsedSeconds(world: World): number {
  return world.tick * TICK_SECONDS;
}

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds / TICK_SECONDS);
}

export function createWorld(seed = ISLAND_SEED): World {
  const world: World = {
    version: 2,
    tick: 0,
    seed,
    trees: [],
    villagers: [],
    jobs: [],
    stockpile: { x: HOME.x, z: HOME.z, stock: { timber: 0 } },
    nextJobId: 1,
    nextVillagerId: 1,
    inbox: [],
    stats: { treesFelled: 0, logsDelivered: 0, ordersQueued: 0 },
  };
  // Rejection sampling: inside the mainland ellipse, clear of the clearing, never crowding a neighbour.
  for (let attempt = 0; attempt < 400 && world.trees.length < TREE_COUNT; attempt++) {
    const x = (nextRandom(world) - .5) * 25, z = (nextRandom(world) - .5) * 20;
    if (!onLand(x, z)) continue;
    if (distance({ x, z }, HOME) < 4.6) continue;
    if (world.trees.some(tree => distance(tree, { x, z }) < 2)) continue;
    const scale = .8 + nextRandom(world) * .55;
    const kind: TreeKind = nextRandom(world) > .32 ? 0 : 1;
    world.trees.push({ id: world.trees.length, x, z, scale, kind, state: 'standing', reservedBy: null });
  }
  addVillager(world, 'Robin', HOME);
  return world;
}

export function addVillager(world: World, name: string, at: Vec2): Villager {
  const villager: Villager = {
    id: world.nextVillagerId++,
    name,
    x: at.x,
    z: at.z,
    px: at.x,
    pz: at.z,
    facing: 0,
    activity: { kind: 'idle' },
    jobId: null,
    carrying: null,
    restUntil: 0,
  };
  world.villagers.push(villager);
  return villager;
}

export function findTree(world: World, id: number): Tree | undefined {
  return world.trees.find(tree => tree.id === id);
}

export function findJob(world: World, id: number | null): Job | undefined {
  return id === null ? undefined : world.jobs.find(job => job.id === id);
}

export function findVillager(world: World, id: number | null): Villager | undefined {
  return id === null ? undefined : world.villagers.find(villager => villager.id === id);
}

/** Jobs a villager could still be given, oldest first. */
export function openJobs(world: World): Job[] {
  return world.jobs.filter(job => job.state === 'queued');
}

export function activeJobs(world: World): Job[] {
  return world.jobs.filter(job => job.state === 'queued' || job.state === 'assigned');
}

/** An outstanding order against this tree, if any. Used to make clicks a toggle. */
export function jobForTree(world: World, treeId: number): Job | undefined {
  return world.jobs.find(job => job.treeId === treeId && (job.state === 'queued' || job.state === 'assigned'));
}

export function idleVillagers(world: World): Villager[] {
  return world.villagers.filter(villager => villager.jobId === null && villager.carrying === null);
}

export function standingTrees(world: World): Tree[] {
  return world.trees.filter(tree => tree.state === 'standing');
}

/**
 * Order-independent fingerprint of a world, for determinism tests and for spotting
 * drift between a live world and one restored from a save.
 */
export function hashWorld(world: World): string {
  let hash = 2166136261;
  const mix = (n: number) => { hash ^= Math.round(n * 1000) | 0; hash = Math.imul(hash, 16777619); };
  const mixText = (text: string) => { for (let i = 0; i < text.length; i++) mix(text.charCodeAt(i)); };
  mix(world.tick); mix(world.seed); mix(world.stockpile.stock.timber);
  mix(world.stats.treesFelled); mix(world.stats.logsDelivered); mix(world.stats.ordersQueued);
  for (const tree of world.trees) { mix(tree.id); mix(tree.x); mix(tree.z); mixText(tree.state); mix(tree.reservedBy ?? -1); }
  for (const villager of world.villagers) {
    mix(villager.id); mix(villager.x); mix(villager.z); mix(villager.facing);
    mixText(villager.activity.kind); mix(villager.jobId ?? -1); mix(villager.carrying?.amount ?? 0);
    if (villager.activity.kind === 'harvest') mix(villager.activity.progress);
    if (villager.activity.kind === 'travel') { mix(villager.activity.to.x); mix(villager.activity.to.z); }
  }
  for (const job of world.jobs) { mix(job.id); mix(job.treeId); mixText(job.state); mix(job.assignee ?? -1); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
