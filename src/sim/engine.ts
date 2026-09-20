/**
 * The clock. Everything the host can do to a world goes through this file:
 * queue a command, advance time, read the events that came back.
 *
 * Time is quantised to whole ticks. A frame that took 17ms and a frame that took
 * 34ms produce the same world for the same total elapsed time, so the simulation
 * does not depend on the frame rate of the machine watching it.
 */
import { RULES, type RuleContext, type RuleTrace } from './rules.ts';
import { MAX_CATCH_UP_SECONDS, TICK_SECONDS } from './tuning.ts';
import type { Command, SimEvent, World } from './types.ts';
import { createWorld } from './world.ts';

export type Simulation = {
  world: World;
  /** Unspent wall time, smaller than one tick. Runtime only: never saved. */
  accumulator: number;
  /** Ticks run by the most recent `advance`, useful for spotting catch-up. */
  lastTicks: number;
};

export function createSimulation(world: World = createWorld()): Simulation {
  return { world, accumulator: 0, lastTicks: 0 };
}

/** Queue an order. It is applied by the `accept-commands` rule on the next tick. */
export function enqueue(sim: Simulation, command: Command): void {
  sim.world.inbox.push(command);
}

/** Run exactly one tick and return what happened. Pass `trace` to watch the rules fire. */
export function tick(world: World, trace?: RuleTrace): SimEvent[] {
  const events: SimEvent[] = [];
  for (const villager of world.villagers) { villager.px = villager.x; villager.pz = villager.z; }
  world.tick++;
  const ctx: RuleContext = {
    dt: TICK_SECONDS,
    tick: world.tick,
    emit: (event) => { events.push({ tick: world.tick, ...event }); },
    trace,
  };
  for (const rule of RULES) rule.apply(world, ctx);
  return events;
}

export function tickTimes(world: World, count: number, trace?: RuleTrace): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < count; i++) events.push(...tick(world, trace));
  return events;
}

/**
 * Advance by real seconds. Leftover time is carried, extreme gaps (a backgrounded
 * tab, a breakpoint) are clamped rather than simulated in one enormous lurch.
 */
export function advance(sim: Simulation, seconds: number): SimEvent[] {
  if (!Number.isFinite(seconds) || seconds <= 0) { sim.lastTicks = 0; return []; }
  sim.accumulator += Math.min(seconds, MAX_CATCH_UP_SECONDS);
  const events: SimEvent[] = [];
  let ticks = 0;
  while (sim.accumulator >= TICK_SECONDS) {
    sim.accumulator -= TICK_SECONDS;
    events.push(...tick(sim.world));
    ticks++;
  }
  sim.lastTicks = ticks;
  return events;
}

/** How far the world is between the last tick and the next, for render interpolation. */
export function alpha(sim: Simulation): number {
  return Math.min(1, sim.accumulator / TICK_SECONDS);
}
