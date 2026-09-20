import { describe, expect, it } from 'vitest';
import { advance, alpha, createAccumulator } from './timestep.ts';
import { createStressWorld, hashStress, stepStress } from './stress-simulation.ts';

const run = (frames: number, frameDt: number, apply: (dt: number) => void) => {
  const acc = createAccumulator();
  for (let i = 0; i < frames; i++) advance(acc, frameDt, apply);
  return acc;
};

describe('fixed timestep', () => {
  it('runs the same simulation whatever the frame pacing', () => {
    const fast = createStressWorld(200, 7), slow = createStressWorld(200, 7);
    run(600, 1 / 60, dt => stepStress(fast, dt));
    run(300, 1 / 30, dt => stepStress(slow, dt));
    expect(hashStress(slow)).toBe(hashStress(fast));
    expect(fast.completedTrips).toBeGreaterThan(0);
  });
  it('runs the same number of steps under ragged pacing as under smooth pacing', () => {
    let smooth = 0, ragged = 0;
    const smoothAcc = createAccumulator(), raggedAcc = createAccumulator();
    for (let i = 0; i < 480; i++) smooth += advance(smoothAcc, 1 / 48, () => {});
    for (let i = 0; i < 480; i++) ragged += advance(raggedAcc, i % 2 ? 1 / 24 : 0, () => {});
    expect(ragged).toBe(smooth);
  });
  // A case here used to drive src/simulation.ts at two frame rates. The island now
  // runs on src/sim, whose engine banks time itself and is tested for the same
  // property in engine.test.ts; timestep.ts is the lab's clock, covered above.
  it('feeds every step the same fixed delta', () => {
    const seen: number[] = [];
    const acc = createAccumulator();
    for (const frameDt of [1 / 60, 1 / 12, 1 / 144, 0.037]) advance(acc, frameDt, dt => seen.push(dt));
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]).toBeCloseTo(1 / 60, 12);
  });
  it('drops the backlog after a hitch instead of spiralling', () => {
    let steps = 0;
    const acc = createAccumulator(1 / 60, 5);
    advance(acc, 10, () => steps++);
    expect(steps).toBe(5);
    expect(acc.carry).toBeLessThan(1 / 60);
  });
  it('leaves headroom for a speed multiplier on a slow display', () => {
    // Three times speed at 30 Hz needs six 1/60 steps in one frame; a tighter cap
    // would quietly run the game slower than the button claims.
    let steps = 0;
    const acc = createAccumulator(1 / 60, 12);
    advance(acc, (1 / 30) * 3, () => steps++);
    expect(steps).toBe(6);
    expect(createAccumulator().maxSteps).toBeLessThan(12);
  });
  it('keeps a multiplier honest when the cap scales with it', () => {
    // The cap bounds catch-up work, but 3x is genuinely three times the work.
    // Holding the cap fixed turns the 3x button into 1.6x on a slow display.
    const frame = 1 / 8.4, speed = 3, wanted = Math.floor(frame * speed * 60);
    let fixed = 0, scaled = 0;
    const fixedCap = createAccumulator(1 / 60, 12), scaledCap = createAccumulator(1 / 60, 12 * speed);
    advance(fixedCap, frame * speed, () => fixed++);
    advance(scaledCap, frame * speed, () => scaled++);
    expect(fixed).toBe(12);
    expect(scaled).toBe(wanted);
    expect(scaled).toBeGreaterThan(fixed);
  });
  it('ignores impossible frame deltas', () => {
    let steps = 0;
    const acc = createAccumulator();
    for (const bad of [NaN, -1, 0, Infinity]) advance(acc, bad, () => steps++);
    expect(steps).toBe(0);
    expect(acc.carry).toBe(0);
  });
  it('reports how far the carry sits between steps', () => {
    const acc = createAccumulator();
    expect(alpha(acc)).toBe(0);
    advance(acc, 1 / 120, () => {});
    expect(alpha(acc)).toBeCloseTo(0.5, 6);
    expect(alpha(acc)).toBeGreaterThanOrEqual(0);
    expect(alpha(acc)).toBeLessThan(1);
  });
});
