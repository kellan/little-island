/**
 * The lumberjack hut: a worker clocks on, fells what is in range, hauls the logs
 * back, and stops when the store is full. Terminal-only; the browser island still
 * runs SETTLEMENT.
 */
import { describe, expect, it } from 'vitest';
import { LUMBERJACK } from './rules.ts';
import { tickTimes } from './engine.ts';
import { deserialize, serialize } from './serialize.ts';
import { HOME } from './terrain.ts';
import { DAY_SECONDS, HUT_CAPACITY, HUT_RADIUS } from './tuning.ts';
import { addBuilding, createWorld, findBuilding, hasRoom, hashWorld, heldIn, hire, secondsToTicks, standingTrees } from './world.ts';
import type { Building, SimEvent, World } from './types.ts';

const rules = LUMBERJACK.rules;
const run = (world: World, count: number) => tickTimes(world, count, { rules });
const kinds = (events: SimEvent[]) => events.map(event => event.kind);

/** An island with one hut by the clearing and one lumberjack working there. */
function withHut(capacity = HUT_CAPACITY): { world: World; hut: Building } {
  const world = createWorld();
  const hut = addBuilding(world, 'lumberjack-hut', { x: HOME.x + 2.4, z: HOME.z - 1.5 }, capacity, HUT_RADIUS);
  hire(world, world.villagers[0], hut);
  return { world, hut };
}

const until = (world: World, done: (world: World) => boolean, limit = 8000) => {
  const events: SimEvent[] = [];
  for (let i = 0; i < limit && !done(world); i++) events.push(...run(world, 1));
  return events;
};

describe('a day at the lumberjack hut', () => {
  it('walks to the hut, picks up the axe, and only then starts work', () => {
    const { world, hut } = withHut();
    expect(world.villagers[0].tool).toBeNull();
    const events = until(world, w => w.villagers[0].tool !== null);
    expect(kinds(events)).toContain('shift-started');
    expect(world.villagers[0].tool).toBe('axe');
    expect(Math.hypot(world.villagers[0].x - hut.x, world.villagers[0].z - hut.z)).toBeLessThan(1);
    expect(world.stats.treesFelled).toBe(0); // Nothing is felled before the axe is in hand.
  });

  it('fells a tree in range, leaves a log, hauls it back and stores it', () => {
    const { world, hut } = withHut();
    const events = until(world, w => heldIn(findBuilding(w, hut.id)!) > 0);
    expect(kinds(events)).toEqual(expect.arrayContaining(['shift-started', 'tree-felled', 'ware-dropped', 'ware-collected', 'ware-stored']));
    const order = kinds(events);
    expect(order.indexOf('ware-dropped')).toBeLessThan(order.indexOf('ware-collected'));
    expect(order.indexOf('ware-collected')).toBeLessThan(order.indexOf('ware-stored'));
    expect(hut.stock.log).toBe(1);
    expect(world.stockpile.stock.log).toBe(0); // Logs go to the hut, not the clearing.
    expect(world.piles).toHaveLength(0);
  });

  it('only fells trees within the hut’s reach', () => {
    const { world, hut } = withHut(2);
    const inRange = standingTrees(world).filter(tree => Math.hypot(tree.x - hut.x, tree.z - hut.z) <= hut.radius).map(tree => tree.id);
    until(world, w => !hasRoom(findBuilding(w, hut.id)!));
    const felled = world.trees.filter(tree => tree.state === 'felled').map(tree => tree.id);
    expect(felled).toHaveLength(2);
    for (const id of felled) expect(inRange).toContain(id);
  });

  it('stops when the store is full, and says so once', () => {
    const { world, hut } = withHut(3);
    const events = until(world, w => !hasRoom(findBuilding(w, hut.id)!));
    expect(kinds(events).filter(kind => kind === 'store-full')).toHaveLength(1);
    expect(heldIn(hut)).toBe(3);

    const after = run(world, 900);
    expect(heldIn(hut)).toBe(3);
    expect(world.stats.treesFelled).toBe(3);
    expect(kinds(after)).not.toContain('tree-felled');
    expect(world.villagers[0].carrying).toBeNull();
  });

  it('hands the axe back overnight and clocks on again the next day', () => {
    const { world } = withHut(2);
    until(world, w => w.villagers[0].tool !== null);
    const events = run(world, secondsToTicks(DAY_SECONDS) + 60);
    expect(kinds(events)).toContain('day-begins');
    expect(world.day).toBe(2);
    expect(kinds(events).filter(kind => kind === 'shift-started').length).toBeGreaterThanOrEqual(1);
    expect(world.villagers[0].tool).toBe('axe');
  });

  it('does nothing at all without somebody working there', () => {
    const world = createWorld();
    addBuilding(world, 'lumberjack-hut', { x: HOME.x + 2.4, z: HOME.z - 1.5 }, HUT_CAPACITY, HUT_RADIUS);
    run(world, 1200);
    expect(world.stats.treesFelled).toBe(0);
    expect(world.villagers[0].tool).toBeNull();
    expect(world.buildings[0].workerId).toBeNull();
  });

  it('saves and restores a half-worked day', () => {
    const { world, hut } = withHut();
    until(world, w => heldIn(findBuilding(w, hut.id)!) > 0);
    const restored = deserialize(serialize(world))!;
    expect(restored).toEqual(world);
    run(world, 600);
    run(restored, 600);
    expect(hashWorld(restored)).toBe(hashWorld(world));
    expect(heldIn(restored.buildings[0])).toBe(heldIn(world.buildings[0]));
  });
});
