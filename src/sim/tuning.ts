import type { SiteKind, WareId } from './types.ts';

/**
 * Every number a designer would want to nudge, in one place. The rules read these;
 * they never hide constants of their own.
 */
export const TICK_SECONDS = 1 / 30;

/** Never simulate more than this much wall time in a single `advance` call. */
export const MAX_CATCH_UP_SECONDS = .25;

export const WALK_SPEED = 2.3;
export const CARRY_SPEED = 1.95;
export const ROAM_SPEED = .48;

/** How close a villager stands to work on a tree, to pick a ware up, and to drop it home. */
export const TREE_REACH = .85;
export const PILE_REACH = .3;
export const STOCKPILE_REACH = .35;

/** Seconds to fell an average tree; bigger trunks take proportionally longer. */
export const CHOP_SECONDS = 4.2;
export const SWINGS_PER_SECOND = 1.43;

export const REST_SECONDS = 3.5;
export const ROAM_RADIUS = 1.6;

/** Orders a player may stack up per pair of hands, before the queue politely declines. */
export const MAX_JOBS_PER_VILLAGER = 12;

/**
 * Higher goes first when work is handed out. Fetching beats felling so that logs
 * come home as they are made; set them equal and the forest fills with loose wares
 * while the axe keeps swinging, which is a different and more Settlers-ish game.
 */
export const JOB_PRIORITY = { haul: 10, task: 0 } as const;

/** Finished jobs linger this long so the host can notice them, then are pruned. */
export const JOB_HISTORY_SECONDS = 1;

export const ISLAND_SEED = 841;
export const TREE_COUNT = 37;
export const PATCH_COUNT = 14;

export const DOOR_REACH = .6;

/**
 * A task is the one shape all work takes: optionally a place in the world, the
 * wares it takes from the building's own store, how long it lasts, and what it
 * leaves behind. Felling a tree, sawing a plank, foraging a patch and sowing a
 * field are all rows in this table rather than rules of their own.
 */
export type TaskSpec = {
  id: string;
  /** Work on a site within the building's radius, taking this much of it. */
  site?: { kind: SiteKind; take: number };
  /** Wares consumed from the building's store. Several means a recipe with several inputs. */
  takes?: readonly { ware: WareId; amount: number }[];
  seconds: number;
  /** Work on a bigger site takes proportionally longer. */
  scaleWithSite?: boolean;
  /**
   * What the work produces. `ground` leaves it where the work happened, for
   * somebody to fetch — right for anything heavy. `hands` means the worker
   * carries it home themselves, which is right for a basket of berries. `store`
   * puts it straight into the building, for work done at the bench.
   */
  yields?: readonly { ware: WareId; amount: number; to: 'ground' | 'hands' | 'store' }[];
};

export const TASKS: Record<string, TaskSpec> = {
  fell: {
    id: 'fell',
    site: { kind: 'tree', take: 1 },
    seconds: CHOP_SECONDS,
    scaleWithSite: true,
    yields: [{ ware: 'log', amount: 1, to: 'ground' }],
  },
  forage: {
    id: 'forage',
    site: { kind: 'patch', take: 1 },
    seconds: 6,
    // Berries are light. You carry them home yourself rather than leaving them
    // in the bracken for somebody else to make a second trip for.
    yields: [{ ware: 'forage', amount: 1, to: 'hands' }],
  },
  saw: {
    id: 'saw',
    takes: [{ ware: 'log', amount: 1 }],
    seconds: 5,
    yields: [{ ware: 'plank', amount: 1, to: 'store' }],
  },
};

/**
 * Buildings are data. A new one is an entry here plus, at most, one new task —
 * which is the whole point of declaring work rather than writing it.
 */
export const BUILDINGS = {
  'lumberjack-hut': {
    capacity: 5,
    /** How far it sends its worker for sites. Zero for a building that works indoors. */
    radius: 8,
    tool: 'axe',
    /** How many of each input to keep on hand. A hut takes nothing, so none. */
    queue: 0,
    tasks: ['fell'],
  },
  'foragers-hut': {
    capacity: 6,
    radius: 7,
    tool: 'basket',
    queue: 0,
    tasks: ['forage'],
  },
  'sawmill': {
    capacity: 8,
    radius: 0,
    tool: 'saw',
    queue: 3,
    tasks: ['saw'],
  },
} as const;

/**
 * What each kind of place in the world does when it is left alone. A tree does
 * nothing: fell it and it is gone. A patch comes back, slowly enough that the
 * forager has to range further while it does.
 */
export const SITE_KINDS = {
  tree: { regrowSeconds: 0 },
  patch: { regrowSeconds: 50 },
} as const;

/** How much of a ware one villager can carry in one trip. */
export const CARRY_LOAD = 4;

/** A day is only a shift boundary for now: tools go back to the hut overnight. */
export const DAY_SECONDS = 120;
