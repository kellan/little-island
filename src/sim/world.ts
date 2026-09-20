import { nextRandom } from './rng.ts';
import { HOME, distance, onLand } from './terrain.ts';
import { BUILDINGS, ISLAND_SEED, TICK_SECONDS, TREE_COUNT } from './tuning.ts';
import { emptyStock, type Building, type BuildingKind, type Job, type Role, type Tree, type TreeKind, type Vec2, type Villager, type WareId, type WarePile, type World } from './types.ts';

/** Seconds of world time. Derived from whole ticks, so it can never drift. */
export function elapsedSeconds(world: World): number {
  return world.tick * TICK_SECONDS;
}

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds / TICK_SECONDS);
}

export function createWorld(seed = ISLAND_SEED): World {
  const world: World = {
    version: 5,
    tick: 0,
    day: 1,
    seed,
    trees: [],
    villagers: [],
    buildings: [],
    piles: [],
    jobs: [],
    stockpile: { x: HOME.x, z: HOME.z, stock: emptyStock() },
    nextJobId: 1,
    nextVillagerId: 1,
    nextPileId: 1,
    nextBuildingId: 1,
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

export function addVillager(world: World, name: string, at: Vec2, role: Role = 'hand'): Villager {
  const villager: Villager = {
    id: world.nextVillagerId++,
    name,
    role,
    x: at.x,
    z: at.z,
    px: at.x,
    pz: at.z,
    facing: 0,
    workplace: null,
    tool: null,
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

/** Raise a building. It does nothing until somebody works there. */
export function addBuilding(world: World, kind: BuildingKind, at: Vec2): Building {
  const type = BUILDINGS[kind];
  const building: Building = {
    id: world.nextBuildingId++, kind, x: at.x, z: at.z,
    radius: type.radius, workerId: null, stock: emptyStock(), capacity: type.capacity,
    wants: { ...type.wants }, recipe: type.recipe ? { ...type.recipe } : null, tool: type.tool, waiting: null,
  };
  world.buildings.push(building);
  return building;
}

/** What a building holds beyond what it wants to keep: free for anyone to fetch. */
export function spare(building: Building, ware: WareId): number {
  return Math.max(0, building.stock[ware] - (building.wants[ware] ?? 0));
}

/** The input this building is short of, if any. */
export function shortOf(building: Building): WareId | null {
  for (const [ware, target] of Object.entries(building.wants) as [WareId, number][]) {
    if (building.stock[ware] < target) return ware;
  }
  return null;
}

/** Can the worker run the recipe right now? */
export function canCraft(building: Building): boolean {
  const recipe = building.recipe;
  if (!recipe) return false;
  if (building.stock[recipe.consumes.ware] < recipe.consumes.amount) return false;
  return heldIn(building) - recipe.consumes.amount + recipe.produces.amount <= building.capacity;
}

export function findBuilding(world: World, id: number | null): Building | undefined {
  return id === null ? undefined : world.buildings.find(building => building.id === id);
}

/** Put somebody to work at a building, taking them off their old one. */
export function hire(world: World, villager: Villager, building: Building): void {
  for (const other of world.buildings) if (other.workerId === villager.id) other.workerId = null;
  const previous = findVillager(world, building.workerId);
  if (previous) { previous.workplace = null; previous.tool = null; }
  building.workerId = villager.id;
  villager.workplace = building.id;
}

export function workplaceOf(world: World, villager: Villager): Building | undefined {
  return findBuilding(world, villager.workplace);
}

export function heldIn(building: Building): number {
  return Object.values(building.stock).reduce((total, count) => total + count, 0);
}

/** Everything the settlement holds of one ware, in every store. */
export function totalWare(world: World, ware: WareId): number {
  return world.stockpile.stock[ware] + world.buildings.reduce((sum, building) => sum + building.stock[ware], 0);
}

export function hasRoom(building: Building): boolean {
  return heldIn(building) < building.capacity;
}

/** Put a ware on the ground. This is how anything enters the world with a place. */
export function dropWare(world: World, ware: WareId, at: Vec2, amount = 1, destination: number | null = null): WarePile {
  const pile: WarePile = { id: world.nextPileId++, ware, amount, x: at.x, z: at.z, destination, reservedBy: null };
  world.piles.push(pile);
  return pile;
}

export function findPile(world: World, id: number | null): WarePile | undefined {
  return id === null ? undefined : world.piles.find(pile => pile.id === id);
}

/** Piles nobody is already going to fetch. */
export function loosePiles(world: World): WarePile[] {
  const claimed = new Set(world.jobs.flatMap(job => job.kind === 'haul' && (job.state === 'queued' || job.state === 'assigned') ? [job.pileId] : []));
  return world.piles.filter(pile => !claimed.has(pile.id));
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
  return world.jobs.find(job => job.kind === 'fell' && job.treeId === treeId && (job.state === 'queued' || job.state === 'assigned'));
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
  mix(world.tick); mix(world.day); mix(world.seed);
  for (const [ware, count] of Object.entries(world.stockpile.stock)) { mixText(ware); mix(count); }
  mix(world.stats.treesFelled); mix(world.stats.logsDelivered); mix(world.stats.ordersQueued);
  for (const tree of world.trees) { mix(tree.id); mix(tree.x); mix(tree.z); mixText(tree.state); mix(tree.reservedBy ?? -1); }
  for (const villager of world.villagers) {
    mix(villager.id); mix(villager.x); mix(villager.z); mix(villager.facing); mixText(villager.role);
    mixText(villager.activity.kind); mix(villager.jobId ?? -1); mix(villager.carrying?.amount ?? 0);
    mix(villager.workplace ?? -1); mixText(villager.tool ?? 'none');
    if (villager.activity.kind === 'chop') mix(villager.activity.progress);
    if (villager.activity.kind === 'travel') { mix(villager.activity.to.x); mix(villager.activity.to.z); }
  }
  for (const building of world.buildings) {
    mix(building.id); mix(building.workerId ?? -1); mixText(building.waiting ?? 'none');
    for (const ware of Object.keys(building.stock).sort()) { mixText(ware); mix(building.stock[ware as WareId]); }
  }
  for (const pile of world.piles) { mix(pile.id); mixText(pile.ware); mix(pile.amount); mix(pile.x); mix(pile.z); mix(pile.reservedBy ?? -1); }
  for (const job of world.jobs) { mix(job.id); mixText(job.kind); mix(job.kind === 'fell' ? job.treeId : job.kind === 'haul' ? job.pileId : job.to); mixText(job.state); mix(job.assignee ?? -1); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
