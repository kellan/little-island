/**
 * The lumberjack hut: a worker clocks on, fells what is in range, hauls the logs
 * back, and stops when the store is full. Terminal-only; the browser island still
 * runs SETTLEMENT.
 */
import { describe, expect, it } from 'vitest';
import { VILLAGE } from './rules.ts';
import { tickTimes } from './engine.ts';
import { deserialize, serialize } from './serialize.ts';
import { HOME } from './terrain.ts';
import { BUILDINGS, DAY_SECONDS } from './tuning.ts';
import { addBuilding, addVillager, createWorld, findBuilding, hasRoom, hashWorld, heldIn, hire, secondsToTicks, standingTrees } from './world.ts';
import type { Building, SimEvent, World } from './types.ts';

const rules = VILLAGE.rules;
const run = (world: World, count: number) => tickTimes(world, count, { rules });
const kinds = (events: SimEvent[]) => events.map(event => event.kind);

/** An island with one hut by the clearing and one lumberjack working there. */
function withHut(capacity: number = BUILDINGS['lumberjack-hut'].capacity): { world: World; hut: Building } {
  const world = createWorld();
  const hut = addBuilding(world, 'lumberjack-hut', { x: HOME.x + 2.4, z: HOME.z - 1.5 });
  hut.capacity = capacity;
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
    addBuilding(world, 'lumberjack-hut', { x: HOME.x + 2.4, z: HOME.z - 1.5 });
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

/* ------------------------------------------------------------ the sawmill */

function withMill(): { world: World; hut: Building; mill: Building } {
  const { world, hut } = withHut();
  const mill = addBuilding(world, 'sawmill', { x: HOME.x - 2.6, z: HOME.z + 1.2 });
  hire(world, addVillager(world, 'Wren', HOME), mill);
  return { world, hut, mill };
}

describe('the sawmill', () => {
  it('is built from data, recipe and all', () => {
    const { mill } = withMill();
    expect(mill.recipe).toEqual({ consumes: { ware: 'log', amount: 1 }, produces: { ware: 'plank', amount: 1 }, seconds: 5 });
    expect(mill.wants).toEqual({ log: 3 });
    expect(mill.tool).toBe('saw');
  });

  it('says what it is waiting for before any logs exist', () => {
    const { world, mill } = withMill();
    const events = run(world, 2);
    expect(kinds(events)).toContain('waiting-for');
    expect(mill.waiting).toBe('log');
  });

  it('asks the hut for a log, and the log moves store to store', () => {
    const { world, hut, mill } = withMill();
    until(world, w => findBuilding(w, hut.id)!.stock.log > 0);
    const before = hut.stock.log;
    const events = until(world, w => findBuilding(w, mill.id)!.stock.log > 0);
    expect(kinds(events)).toEqual(expect.arrayContaining(['supply-asked', 'ware-taken', 'ware-stored']));
    expect(mill.stock.log).toBe(1);
    expect(hut.stock.log).toBeLessThan(before + 1);
  });

  it('turns one log into one plank and nothing else', () => {
    const { world, mill } = withMill();
    until(world, w => findBuilding(w, mill.id)!.stock.plank > 0, 12000);
    expect(mill.stock.plank).toBe(1);
    expect(mill.waiting === null || mill.waiting === 'log').toBe(true);
    expect(world.villagers.every(villager => villager.carrying === null || villager.carrying.amount === 1)).toBe(true);
  });

  it('keeps the sawyer out of the forest and the lumberjack out of the mill', () => {
    const { world, mill } = withMill();
    const sawyer = world.villagers.find(villager => villager.workplace === mill.id)!;
    let sawyerChopped = false, lumberjackCrafted = false;
    for (let i = 0; i < 4000; i++) {
      run(world, 1);
      if (sawyer.activity.kind === 'chop') sawyerChopped = true;
      if (world.villagers[0].activity.kind === 'craft') lumberjackCrafted = true;
    }
    expect(sawyerChopped).toBe(false);
    expect(lumberjackCrafted).toBe(false);
    expect(mill.stock.plank).toBeGreaterThan(0);
  });

  it('stops when the store is full of output, and starts again when it is emptied', () => {
    const { world, mill } = withMill();
    // A one-for-one recipe still runs at capacity — a log leaves as a plank arrives.
    // Work only stops once the store is full and the last input has been used.
    until(world, w => { const m = findBuilding(w, mill.id)!; return !hasRoom(m) && m.stock.log === 0; }, 40000);
    expect(heldIn(mill)).toBe(mill.capacity);
    expect(mill.stock.plank).toBe(mill.capacity);
    const stuck = run(world, 900);
    expect(kinds(stuck)).not.toContain('ware-made');
    // The hut keeps working; it is only the mill that has nowhere to put anything.
    expect(stuck.filter(event => event.kind === 'ware-stored' && event.buildingId === mill.id)).toHaveLength(0);

    mill.stock.plank = 0; // A warehouse would do this; for now, by hand.
    const freed = until(world, w => findBuilding(w, mill.id)!.stock.plank > 0, 12000);
    expect(kinds(freed)).toContain('ware-made');
  });

  it('survives a save taken mid-recipe', () => {
    const { world, mill } = withMill();
    until(world, w => w.villagers.some(villager => villager.activity.kind === 'craft'), 12000);
    const restored = deserialize(serialize(world))!;
    expect(restored).toEqual(world);
    run(world, 600);
    run(restored, 600);
    expect(hashWorld(restored)).toBe(hashWorld(world));
    expect(restored.buildings[1].stock.plank).toBe(findBuilding(world, mill.id)!.stock.plank);
  });
});
