// A frame-pacing-independent clock. Simulation code sees one fixed delta whatever
// the display refresh rate or how badly a frame ran over, so the same elapsed time
// always produces the same simulation, and a stalled tab cannot bank hours of work.
export type Accumulator = { fixed: number; carry: number; maxSteps: number };
export function createAccumulator(fixed = 1 / 60, maxSteps = 5): Accumulator { return { fixed, carry: 0, maxSteps }; }
export function advance(acc: Accumulator, elapsed: number, step: (dt: number) => void): number {
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
  acc.carry += elapsed;
  let steps = 0;
  while (acc.carry >= acc.fixed && steps < acc.maxSteps) { acc.carry -= acc.fixed; steps++; step(acc.fixed); }
  if (acc.carry >= acc.fixed) acc.carry %= acc.fixed; // Discard the backlog rather than chase it forever.
  return steps;
}
// How far the render sits past the last simulated step, for interpolation.
export function alpha(acc: Accumulator): number { return acc.carry / acc.fixed; }
