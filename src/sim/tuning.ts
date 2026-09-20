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

/** How close a villager stands to work on a tree, and to drop a log at the clearing. */
export const TREE_REACH = .85;
export const STOCKPILE_REACH = .35;

/** Seconds to fell an average tree; bigger trunks take proportionally longer. */
export const CHOP_SECONDS = 4.2;
export const SWINGS_PER_SECOND = 1.43;

export const REST_SECONDS = 3.5;
export const ROAM_RADIUS = 1.6;

/** Orders a player may stack up per pair of hands, before the queue politely declines. */
export const MAX_JOBS_PER_VILLAGER = 12;

/** Finished jobs linger this long so the host can notice them, then are pruned. */
export const JOB_HISTORY_SECONDS = 1;

export const ISLAND_SEED = 841;
export const TREE_COUNT = 37;
