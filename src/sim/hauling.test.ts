/**
 * The hauling rulebook: wares exist on the ground, and fetching one is a job.
 * Terminal-only for now; the browser island still runs SETTLEMENT.
 */
import { describe, expect, it } from 'vitest';
import { HAULING, SETTLEMENT } from './rules.ts';
import { tick, tickTimes } from './engine.ts';
import { deserialize, serialize } from './serialize.ts';
import { HOME } from './terrain.ts';
import { addVillager, createWorld, dropWare, hashWorld, loosePiles } from './world.ts';
import type { SimEvent, World } from './types.ts';

const rules = HAULING.rules;
const run = (world: World, count: number) => tickTimes(world, count, { rules });
const kinds = (events: SimEvent[]) => events.map(event => event.kind);
const ordering = (world: World, ...treeIds: number[]) => {
  for (const treeId of treeIds) world.inbox.push({ kind: 'order-fell', treeId });
  return world;
};
const until = (world: World, done: (world: World) => boolean, limit = 4000) => {
  const events: SimEvent[] = [];
  for (let i = 0; i < limit && !done(world); i++) events.push(...run(world, 1));
  return events;
};

describe('wares on the ground', () => {
  it('leaves the log where the tree fell, and nobody is carrying it', () => {
    const world = ordering(createWorld(), 0);
    until(world, w => w.piles.length > 0);
    const [pile] = world.piles;
    const tree = world.trees[0];
    expect(pile).toMatchObject({ ware: 'log', amount: 1, reservedBy: null });
    expect(Math.hypot(pile.x - tree.x, pile.z - tree.z)).toBe(0);
    expect(world.villagers[0].carrying).toBeNull();
    expect(world.stockpile.stock.log).toBe(0);
    expect(world.villagers[0].jobId).toBeNull(); // The felling job is finished.
  });

  it('notices the loose log, fetches it and stockpiles it', () => {
    const world = ordering(createWorld(), 0);
    const events = until(world, w => w.stockpile.stock.log > 0);
    expect(kinds(events)).toEqual(expect.arrayContaining(['tree-felled', 'ware-dropped', 'ware-collected', 'ware-delivered']));
    expect(kinds(events).indexOf('ware-dropped')).toBeLessThan(kinds(events).indexOf('ware-collected'));
    expect(world.piles).toHaveLength(0);
    expect(world.stockpile.stock.log).toBe(1);
  });

  it('carries any ware, not just logs', () => {
    const world = createWorld();
    dropWare(world, 'stone', { x: HOME.x + 3, z: HOME.z }, 2);
    until(world, w => w.stockpile.stock.stone > 0);
    expect(world.stockpile.stock).toEqual({ log: 0, stone: 2, plank: 0 });
    expect(world.stats.logsDelivered).toBe(0); // Logs count as logs, stone does not.
  });

  it('sends exactly one villager for one log', () => {
    const world = createWorld();
    addVillager(world, 'Wren', HOME);
    dropWare(world, 'log', { x: HOME.x + 5, z: HOME.z + 1 });
    run(world, 1);
    expect(world.jobs.filter(job => job.kind === 'haul')).toHaveLength(1);
    expect(loosePiles(world)).toHaveLength(0);
    expect(world.villagers.filter(villager => villager.jobId !== null)).toHaveLength(1);
    until(world, w => w.stockpile.stock.log > 0);
    expect(world.stockpile.stock.log).toBe(1);
  });

  it('will not let the player call off the settlement’s own errands', () => {
    const world = ordering(createWorld(), 0);
    until(world, w => w.piles.length > 0);
    run(world, 1);
    world.inbox.push({ kind: 'cancel-all' });
    run(world, 1);
    expect(world.jobs.some(job => job.kind === 'haul' && job.state === 'assigned')).toBe(true);
    until(world, w => w.stockpile.stock.log > 0);
    expect(world.stockpile.stock.log).toBe(1);
  });

  it('gives up on a ware that disappears from under the errand', () => {
    const world = createWorld();
    dropWare(world, 'log', { x: HOME.x + 6, z: HOME.z + 2 });
    run(world, 2);
    world.piles = [];
    const events = run(world, 1);
    expect(kinds(events)).toContain('job-abandoned');
    expect(world.villagers[0].jobId).toBeNull();
  });
});

describe('roles', () => {
  it('keeps a feller felling and a carrier carrying', () => {
    const world = ordering(createWorld(), 0, 1);
    world.villagers[0].role = 'feller';
    const carrier = addVillager(world, 'Wren', HOME, 'carrier');
    until(world, w => w.stockpile.stock.log === 2, 6000);
    expect(world.stats.treesFelled).toBe(2);
    expect(world.villagers[0].role).toBe('feller');
    expect(carrier.carrying).toBeNull();
  });

  it('never hands a carrier an axe', () => {
    const world = ordering(createWorld(), 0);
    world.villagers[0].role = 'carrier';
    run(world, 300);
    expect(world.jobs.some(job => job.state === 'assigned')).toBe(false);
    expect(world.trees[0].state).toBe('standing');
  });
});

describe('the two rulebooks', () => {
  it('reach the same stockpile from the same orders', () => {
    const settle = ordering(createWorld(), 3, 4);
    const haul = ordering(createWorld(), 3, 4);
    for (let i = 0; i < 3000; i++) {
      tick(settle, { rules: SETTLEMENT.rules });
      tick(haul, { rules: HAULING.rules });
    }
    expect(settle.stockpile.stock.log).toBe(2);
    expect(haul.stockpile.stock.log).toBe(2);
    expect(settle.piles).toHaveLength(0); // Nothing in the browser rules drops a ware.
    expect(hashWorld(settle)).not.toBe(hashWorld(haul));
  });

  it('is deterministic and survives a save with wares lying about', () => {
    const world = ordering(createWorld(), 0, 1);
    until(world, w => w.piles.length > 0);
    const restored = deserialize(serialize(world))!;
    expect(restored).toEqual(world);
    run(world, 800);
    run(restored, 800);
    expect(hashWorld(restored)).toBe(hashWorld(world));
    expect(restored.stockpile.stock.log).toBe(2);
  });
});
