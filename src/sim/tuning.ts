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
export const JOB_PRIORITY = { haul: 10, fell: 0 } as const;

/** Finished jobs linger this long so the host can notice them, then are pruned. */
export const JOB_HISTORY_SECONDS = 1;

export const ISLAND_SEED = 841;
export const TREE_COUNT = 37;

export const DOOR_REACH = .6;

/**
 * Buildings are data. A new building is an entry here plus, at most, one rule —
 * which is the whole point of declaring recipes rather than writing them.
 */
export const BUILDINGS = {
  'lumberjack-hut': {
    capacity: 5,
    /** How far it sends its worker for trees. Zero for a building that works indoors. */
    radius: 8,
    tool: 'axe',
    wants: {},
    recipe: null,
  },
  'sawmill': {
    capacity: 8,
    radius: 0,
    tool: 'saw',
    /** Keeps three logs on hand; anything above that is spare for somebody else. */
    wants: { log: 3 },
    recipe: { consumes: { ware: 'log', amount: 1 }, produces: { ware: 'plank', amount: 1 }, seconds: 5 },
  },
} as const;

/** A day is only a shift boundary for now: tools go back to the hut overnight. */
export const DAY_SECONDS = 120;
