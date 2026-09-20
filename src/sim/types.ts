/**
 * Little Island simulation types.
 *
 * Everything here is plain JSON: no classes, no functions, no Three.js, no DOM.
 * A `World` can be stringified, sent over a wire, diffed, or replayed. The rule
 * engine in `engine.ts` is the only thing allowed to mutate one.
 */

export type Vec2 = { x: number; z: number };

export type ResourceId = 'timber';

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

/** What a villager is doing right now. One of these, never two. */
export type Activity =
  | { kind: 'idle' }
  | { kind: 'travel'; to: Vec2; stopWithin: number; speed: number; purpose: 'harvest' | 'deliver' | 'roam' }
  | { kind: 'harvest'; treeId: number; progress: number; duration: number };

export type Carried = { resource: ResourceId; amount: number };

export type Villager = {
  id: number;
  name: string;
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

export type Job = {
  id: number;
  kind: 'harvest';
  treeId: number;
  state: JobState;
  assignee: number | null;
  createdTick: number;
  finishedTick: number | null;
};

export type Stockpile = {
  x: number;
  z: number;
  stock: Record<ResourceId, number>;
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
  | { kind: 'job-assigned'; jobId: number; treeId: number; villagerId: number }
  | { kind: 'job-abandoned'; jobId: number; treeId: number; villagerId: number | null }
  | { kind: 'chop-swing'; villagerId: number; treeId: number }
  | { kind: 'tree-felled'; treeId: number; villagerId: number }
  | { kind: 'resource-delivered'; resource: ResourceId; amount: number; total: number; villagerId: number }
);

export type SimEventKind = SimEvent['kind'];

/** An event as a rule emits it: the engine stamps the tick on the way out. */
export type EmittedEvent = SimEvent extends infer E ? (E extends SimEvent ? Omit<E, 'tick'> : never) : never;

export type World = {
  version: 2;
  /** Whole ticks elapsed. Seconds are derived, never stored, so time cannot drift. */
  tick: number;
  /** Current state of the world's only random number generator. */
  seed: number;
  trees: Tree[];
  villagers: Villager[];
  jobs: Job[];
  stockpile: Stockpile;
  nextJobId: number;
  nextVillagerId: number;
  /** Commands waiting for the next tick. Part of the state, so a save never loses an order. */
  inbox: Command[];
  stats: { treesFelled: number; logsDelivered: number; ordersQueued: number };
};
