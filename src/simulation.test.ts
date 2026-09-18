import { describe, it, expect } from 'vitest';
import { createWorld, orderChop, step, serialize, deserialize, HOME } from './simulation';
describe('island simulation', () => {
  it('completes the walk, chop, physical delivery loop exactly once', () => {
    const world = createWorld(); expect(orderChop(world, 0)).toBe(true);
    let sawChopping = false, sawReturning = false;
    for (let i = 0; i < 2000; i++) { step(world, .05); sawChopping ||= world.villager.phase === 'chopping'; sawReturning ||= world.villager.phase === 'returning'; }
    expect(sawChopping && sawReturning).toBe(true); expect(world.logs).toBe(1); expect(world.trees[0].chopped).toBe(true);
    expect(Math.hypot(world.villager.x - HOME.x, world.villager.z - HOME.z)).toBeLessThan(1.3);
    expect(orderChop(world, 0)).toBe(false);
  });
  it('restores an in-progress job without losing or duplicating resources', () => {
    const world = createWorld(); orderChop(world, 1); for (let i = 0; i < 120; i++) step(world, .05);
    const restored = deserialize(serialize(world))!; expect(restored).toEqual(world);
    for (let i = 0; i < 1000; i++) step(restored, .05);
    expect(restored.logs).toBe(1);
  });
  it('ignores invalid saves, targets and time', () => {
    expect(deserialize('{')).toBeNull(); expect(deserialize('{}')).toBeNull();
    const world = createWorld(); expect(orderChop(world, 999)).toBe(false); step(world, NaN); expect(world.time).toBe(0);
  });
});
