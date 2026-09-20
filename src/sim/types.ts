/**
 * Little Island simulation types.
 *
 * Everything here is plain JSON: no classes, no functions, no Three.js, no DOM.
 * A `World` can be stringified, sent over a wire, diffed, or replayed. The rule
 * engine in `engine.ts` is the only thing allowed to mutate one.
 */

export type Vec2 = { x: number; z: number };

/** Things that can be carried, stacked and counted. */
export type WareId = 'log' | 'stone' | 'plank' | 'forage';

/**
 * A place in the world that work can be done on. A tree is one; so are the forage
 * patches, shoals, outcrops and farm plots that will follow. Depletion is `amount`
 * going down, and that is all it is.
 */
export type SiteKind = 'tree' | 'patch';

export type Site = {
  id: number;
  kind: SiteKind;
  x: number;
  z: number;
  /** How much is left to take. Zero is spent: a felled tree, an empty patch. */
  amount: number;
  /** What it grows back to. A tree never does; a patch does, slowly. */
  max: number;
  /** Which of its kind: a fir or an oak. Rendering and flavour, not rules. */
  variant: number;
  /** Physical size. Work on a bigger site takes proportionally longer. */
  scale: number;
  /** Villager id holding a claim, so two workers never share one trunk. */
  reservedBy: number | null;
};

/** A ware lying where it was made or dropped. Wares exist somewhere, always. */
export type WarePile = {
  id: number;
  ware: WareId;
  amount: number;
  x: number;
  z: number;
  /** Where this is meant to end up: a building, or null for the clearing. */
  destination: number | null;
  /** Villager on their way to collect it, so two never fetch the same log. */
  reservedBy: number | null;
};

export type TravelPurpose = 'clock-on' | 'work' | 'fetch' | 'deliver' | 'roam';

/** What a villager is doing right now. One of these, never two. */
export type Activity =
  | { kind: 'idle' }
  | { kind: 'travel'; to: Vec2; stopWithin: number; speed: number; purpose: TravelPurpose }
  /** Doing a task, at a site or at a bench. One activity for every kind of work. */
  | { kind: 'work'; task: string; siteId: number | null; buildingId: number | null; progress: number; duration: number };

export type Carried = { ware: WareId; amount: number };

/**
 * Who takes what work. `hand` turns to anything, which is the whole game today;
 * the other two are Widelands' idea that a woodcutter never carries and a carrier
 * never chops. Roles are the smallest version of that, and they change a lot.
 */
export type Role = 'hand' | 'feller' | 'carrier';

export const ROLES: readonly Role[] = ['hand', 'feller', 'carrier'];

export function accepts(role: Role, job: JobKind): boolean {
  if (role === 'feller') return job === 'task';
  if (role === 'carrier') return job === 'haul' || job === 'supply';
  return true;
}

export type Villager = {
  id: number;
  name: string;
  role: Role;
  /** The building this villager works at, if any. */
  workplace: number | null;
  /** In hand. Picked up at the building when the day starts. */
  tool: ToolId | null;
  /**
   * The day they last clocked on. Keyed on the day rather than on holding a tool,
   * so somebody still working at midnight clocks on when they next come free
   * instead of keeping yesterday's axe for good.
   */
  shiftDay: number;
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

/** A building: somewhere that gives out work and stores what comes back. */
export type BuildingKind = 'lumberjack-hut' | 'sawmill' | 'foragers-hut';

export type Building = {
  id: number;
  kind: BuildingKind;
  x: number;
  z: number;
  /** How far from the door this building will send its worker for work. */
  radius: number;
  /** The one villager who works here. A building without a worker does nothing. */
  workerId: number | null;
  stock: Record<WareId, number>;
  /** Total wares the building will hold. Full means work stops. */
  capacity: number;
  /** The tool kept here; the worker picks it up to start the day. */
  tool: ToolId;
  /** The input it is short of, while it is short of it. */
  waiting: WareId | null;
};

/** What a worker carries to do their job. Kept at the building overnight. */
export type ToolId = 'axe' | 'saw' | 'basket';

export const TOOLS: readonly ToolId[] = ['axe', 'saw', 'basket'];

export type JobState = 'queued' | 'assigned' | 'done' | 'cancelled';
export type JobKind = 'task' | 'haul' | 'supply';

/** What a job is about. Adding a kind here is how the settlement learns a verb. */
export type JobTarget =
  /** Perform a building's task. `siteId` is set when the task works on a place. */
  | { kind: 'task'; task: string; siteId: number | null; buildingId: number | null }
  | { kind: 'haul'; pileId: number; to: number | null }
  | { kind: 'supply'; ware: WareId; amount: number; from: number; to: number };

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
  | { kind: 'order-fell'; siteId: number }
  | { kind: 'cancel-fell'; siteId: number }
  | { kind: 'cancel-all' };

/** Things that happened. The host reads these instead of diffing state. */
export type SimEvent = { tick: number } & (
  | { kind: 'order-queued'; jobId: number; siteId: number }
  | { kind: 'order-rejected'; siteId: number; reason: 'unknown-site' | 'already-spent' | 'already-ordered' | 'queue-full' }
  | { kind: 'order-cancelled'; jobId: number; siteId: number }
  | { kind: 'job-assigned'; jobId: number; job: JobKind; targetId: number; villagerId: number }
  | { kind: 'job-abandoned'; jobId: number; job: JobKind; targetId: number; villagerId: number | null }
  | { kind: 'work-stroke'; villagerId: number; task: string; siteId: number | null }
  | { kind: 'site-spent'; siteId: number; siteKind: SiteKind; villagerId: number }
  | { kind: 'ware-dropped'; ware: WareId; pileId: number; x: number; z: number }
  | { kind: 'ware-collected'; ware: WareId; amount: number; pileId: number; villagerId: number }
  | { kind: 'ware-delivered'; ware: WareId; amount: number; total: number; villagerId: number }
  | { kind: 'shift-started'; villagerId: number; buildingId: number; tool: ToolId }
  | { kind: 'ware-stored'; ware: WareId; amount: number; buildingId: number; stored: number; capacity: number; villagerId: number }
  | { kind: 'store-full'; buildingId: number }
  | { kind: 'day-begins'; day: number }
  | { kind: 'ware-taken'; ware: WareId; amount: number; buildingId: number; villagerId: number }
  | { kind: 'ware-gathered'; ware: WareId; amount: number; villagerId: number }
  | { kind: 'ware-used'; ware: WareId; amount: number; buildingId: number }
  | { kind: 'ware-made'; ware: WareId; amount: number; stored: number; buildingId: number; villagerId: number }
  | { kind: 'waiting-for'; ware: WareId; buildingId: number }
  | { kind: 'supply-asked'; jobId: number; ware: WareId; amount: number; from: number; to: number }
);

export type SimEventKind = SimEvent['kind'];

/** An event as a rule emits it: the engine stamps the tick on the way out. */
export type EmittedEvent = SimEvent extends infer E ? (E extends SimEvent ? Omit<E, 'tick'> : never) : never;

export type World = {
  version: 7;
  /** Whole ticks elapsed. Seconds are derived, never stored, so time cannot drift. */
  tick: number;
  /** Current state of the world's only random number generator. */
  seed: number;
  /** Days are only a counter and a shift boundary so far. */
  day: number;
  sites: Site[];
  villagers: Villager[];
  buildings: Building[];
  /** Wares lying on the ground, waiting for someone to fetch them. */
  piles: WarePile[];
  jobs: Job[];
  stockpile: Stockpile;
  nextJobId: number;
  nextVillagerId: number;
  nextPileId: number;
  nextBuildingId: number;
  nextSiteId: number;
  /** Commands waiting for the next tick. Part of the state, so a save never loses an order. */
  inbox: Command[];
  stats: { treesFelled: number; logsDelivered: number; ordersQueued: number };
};

export const WARES: readonly WareId[] = ['log', 'stone', 'plank', 'forage'];

export function emptyStock(): Record<WareId, number> {
  return { log: 0, stone: 0, plank: 0, forage: 0 };
}
