/**
 * Little Island simulation types.
 *
 * Everything here is plain JSON: no classes, no functions, no Three.js, no DOM.
 * A `World` can be stringified, sent over a wire, diffed, or replayed. The rule
 * engine in `engine.ts` is the only thing allowed to mutate one.
 */

export type Vec2 = { x: number; z: number };

/** Things that can be carried, stacked and counted. */
export type WareId = 'timber' | 'stone';

export type TreeKind = 0 | 1;

export type Tree = {
  id: number;
  x: number;
  z: number;
  /** Visual size, also how long it takes to fell. */
  scale: number;
  kind: TreeKind;
  state: 'standing' | 'felled';
  /** Villager id holding a claim on this tree, so two workers never share one trunk. */
  reservedBy: number | null;
};

/** A ware lying where it was made or dropped. Wares exist somewhere, always. */
export type WarePile = {
  id: number;
  ware: WareId;
  amount: number;
  x: number;
  z: number;
  /** Villager on their way to collect it, so two never fetch the same log. */
  reservedBy: number | null;
};

export type TravelPurpose = 'harvest' | 'collect' | 'deliver' | 'roam';

/** What a villager is doing right now. One of these, never two. */
export type Activity =
  | { kind: 'idle' }
  | { kind: 'travel'; to: Vec2; stopWithin: number; speed: number; purpose: TravelPurpose }
  | { kind: 'harvest'; treeId: number; progress: number; duration: number };

export type Carried = { ware: WareId; amount: number };

/**
 * Who takes what work. `hand` turns to anything, which is the whole game today;
 * the other two are Widelands' idea that a woodcutter never carries and a carrier
 * never chops. Roles are the smallest version of that, and they change a lot.
 */
export type Role = 'hand' | 'feller' | 'carrier';

export const ROLES: readonly Role[] = ['hand', 'feller', 'carrier'];

export function accepts(role: Role, job: JobKind): boolean {
  if (role === 'feller') return job === 'harvest';
  if (role === 'carrier') return job === 'haul';
  return true;
}

export type Villager = {
  id: number;
  name: string;
  role: Role;
  x: number;
  z: number;
  /** Position at the previous tick, so a renderer can interpolate between ticks. */
  px: number;
  pz: number;
  facing: number;
  activity: Activity;
  jobId: number | null;
  carrying: Carried | null;
  /** Tick before which this villager will not wander off again. */
  restUntil: number;
};

export type JobState = 'queued' | 'assigned' | 'done' | 'cancelled';
export type JobKind = 'harvest' | 'haul';

/** What a job is about. Adding a kind here is how the settlement learns a verb. */
export type JobTarget =
  | { kind: 'harvest'; treeId: number }
  | { kind: 'haul'; pileId: number };

export type Job = JobTarget & {
  id: number;
  state: JobState;
  assignee: number | null;
  /** Higher goes first. Fetching beats felling, so logs do not pile up in the forest. */
  priority: number;
  createdTick: number;
  finishedTick: number | null;
};

export type Stockpile = {
  x: number;
  z: number;
  stock: Record<WareId, number>;
};

/** Orders from the outside world. Queued, then applied at the next tick boundary. */
export type Command =
  | { kind: 'order-harvest'; treeId: number }
  | { kind: 'cancel-harvest'; treeId: number }
  | { kind: 'cancel-all' };

/** Things that happened. The host reads these instead of diffing state. */
export type SimEvent = { tick: number } & (
  | { kind: 'order-queued'; jobId: number; treeId: number }
  | { kind: 'order-rejected'; treeId: number; reason: 'unknown-tree' | 'already-felled' | 'already-ordered' | 'queue-full' }
  | { kind: 'order-cancelled'; jobId: number; treeId: number }
  | { kind: 'job-assigned'; jobId: number; job: JobKind; targetId: number; villagerId: number }
  | { kind: 'job-abandoned'; jobId: number; job: JobKind; targetId: number; villagerId: number | null }
  | { kind: 'chop-swing'; villagerId: number; treeId: number }
  | { kind: 'tree-felled'; treeId: number; villagerId: number }
  | { kind: 'ware-dropped'; ware: WareId; pileId: number; x: number; z: number }
  | { kind: 'ware-collected'; ware: WareId; amount: number; pileId: number; villagerId: number }
  | { kind: 'ware-delivered'; ware: WareId; amount: number; total: number; villagerId: number }
);

export type SimEventKind = SimEvent['kind'];

/** An event as a rule emits it: the engine stamps the tick on the way out. */
export type EmittedEvent = SimEvent extends infer E ? (E extends SimEvent ? Omit<E, 'tick'> : never) : never;

export type World = {
  version: 3;
  /** Whole ticks elapsed. Seconds are derived, never stored, so time cannot drift. */
  tick: number;
  /** Current state of the world's only random number generator. */
  seed: number;
  trees: Tree[];
  villagers: Villager[];
  /** Wares lying on the ground, waiting for someone to fetch them. */
  piles: WarePile[];
  jobs: Job[];
  stockpile: Stockpile;
  nextJobId: number;
  nextVillagerId: number;
  nextPileId: number;
  /** Commands waiting for the next tick. Part of the state, so a save never loses an order. */
  inbox: Command[];
  stats: { treesFelled: number; logsDelivered: number; ordersQueued: number };
};

export const WARES: readonly WareId[] = ['timber', 'stone'];

export function emptyStock(): Record<WareId, number> {
  return { timber: 0, stone: 0 };
}
