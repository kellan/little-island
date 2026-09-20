import { describe, expect, it } from 'vitest';
import { tick, tickTimes } from './engine.ts';
import { HOME, distance, onLand } from './terrain.ts';
import { MAX_JOBS_PER_VILLAGER } from './tuning.ts';
import { addVillager, createWorld, findTree, jobForTree } from './world.ts';
import type { SimEvent, World } from './types.ts';

const order = (world: World, treeId: number) => world.inbox.push({ kind: 'order-harvest', treeId });
const kinds = (events: SimEvent[]) => events.map(event => event.kind);
const runUntil = (world: World, done: (world: World) => boolean, limit = 3000) => {
  const events: SimEvent[] = [];
  for (let i = 0; i < limit && !done(world); i++) events.push(...tick(world));
  return events;
};

describe('the one true loop', () => {
  it('walks, chops, carries and delivers exactly one log', () => {
    const world = createWorld();
    order(world, 0);
    const events = runUntil(world, w => w.stockpile.stock.timber > 0);

    expect(kinds(events)).toEqual(expect.arrayContaining(['order-queued', 'job-assigned', 'chop-swing', 'tree-felled', 'resource-delivered']));
    expect(kinds(events).indexOf('tree-felled')).toBeLessThan(kinds(events).indexOf('resource-delivered'));
    expect(findTree(world, 0)!.state).toBe('felled');
    expect(findTree(world, 0)!.reservedBy).toBeNull();
    expect(world.stats).toMatchObject({ treesFelled: 1, logsDelivered: 1, ordersQueued: 1 });
    expect(world.villagers[0].carrying).toBeNull();
    expect(distance(world.villagers[0], HOME)).toBeLessThan(.6);
  });

  it('never hands the stockpile a log the villager is still carrying', () => {
    const world = createWorld();
    order(world, 2);
    runUntil(world, w => w.villagers[0].carrying !== null);
    expect(world.stockpile.stock.timber).toBe(0);
    runUntil(world, w => w.stockpile.stock.timber > 0);
    expect(world.villagers[0].carrying).toBeNull();
  });
});

describe('the job queue', () => {
  it('works a stack of orders one at a time, oldest first', () => {
    const world = createWorld();
    for (const id of [5, 6, 7]) order(world, id);
    const events = runUntil(world, w => w.stockpile.stock.timber === 3, 9000);
    const felled = events.filter(event => event.kind === 'tree-felled').map(event => event.treeId);
    expect(felled).toEqual([5, 6, 7]);
    expect(world.villagers[0].jobId).toBeNull();
    tickTimes(world, 60);
    expect(world.jobs).toHaveLength(0);
  });

  it('refuses orders it cannot honour, and says why', () => {
    const world = createWorld();
    order(world, 999);
    order(world, 3);
    order(world, 3);
    const reasons = tick(world).filter(event => event.kind === 'order-rejected').map(event => event.reason);
    expect(reasons).toEqual(['unknown-tree', 'already-ordered']);

    runUntil(world, w => w.stockpile.stock.timber > 0);
    order(world, 3);
    expect(tick(world).filter(event => event.kind === 'order-rejected').map(event => event.reason)).toEqual(['already-felled']);

    const crowded = createWorld();
    for (let id = 0; id <= MAX_JOBS_PER_VILLAGER; id++) order(crowded, id);
    expect(tick(crowded).filter(event => event.kind === 'order-rejected').map(event => event.reason)).toEqual(['queue-full']);
  });

  it('cancels a queued order and releases an assigned one', () => {
    const world = createWorld();
    order(world, 8);
    order(world, 9);
    tickTimes(world, 30);
    expect(jobForTree(world, 8)!.state).toBe('assigned');

    world.inbox.push({ kind: 'cancel-harvest', treeId: 9 });
    world.inbox.push({ kind: 'cancel-harvest', treeId: 8 });
    const events = tick(world);
    expect(kinds(events).filter(kind => kind === 'order-cancelled')).toHaveLength(2);
    expect(world.villagers[0].jobId).toBeNull();
    expect(findTree(world, 8)!.reservedBy).toBeNull();
    expect(findTree(world, 8)!.state).toBe('standing');

    tickTimes(world, 600);
    expect(world.stockpile.stock.timber).toBe(0);
  });

  it('lets a carried log come home even after the order is cancelled', () => {
    const world = createWorld();
    order(world, 4);
    runUntil(world, w => w.villagers[0].carrying !== null);
    world.inbox.push({ kind: 'cancel-all' });
    world.inbox.push({ kind: 'cancel-harvest', treeId: 4 });
    runUntil(world, w => w.stockpile.stock.timber > 0);
    expect(world.stockpile.stock.timber).toBe(1);
  });
});

describe('more hands', () => {
  it('shares work out and never books two villagers onto one tree', () => {
    const world = createWorld();
    addVillager(world, 'Wren', { x: HOME.x + 1, z: HOME.z - 1 });
    for (const id of [10, 11]) order(world, id);
    tickTimes(world, 2);
    const assignees = world.jobs.map(job => job.assignee);
    expect(new Set(assignees).size).toBe(2);
    expect(world.trees.filter(tree => tree.reservedBy !== null)).toHaveLength(2);

    runUntil(world, w => w.stockpile.stock.timber === 2, 6000);
    expect(world.stats.treesFelled).toBe(2);
    expect(world.villagers.every(villager => villager.activity.kind !== 'harvest')).toBe(true);
  });
});

describe('living in the meantime', () => {
  it('putters about near the clearing when there is nothing to do', () => {
    const world = createWorld();
    let wandered = 0, rested = 0, furthest = 0;
    for (let i = 0; i < 1800; i++) {
      tick(world);
      const villager = world.villagers[0];
      if (villager.activity.kind === 'travel') wandered++; else rested++;
      furthest = Math.max(furthest, distance(villager, HOME));
      expect(onLand(villager.x, villager.z)).toBe(true);
    }
    expect(wandered).toBeGreaterThan(100);
    expect(rested).toBeGreaterThan(100);
    expect(furthest).toBeLessThan(2.5);
  });

  it('drops a stroll the moment an order arrives', () => {
    const world = createWorld();
    tickTimes(world, 90);
    order(world, 12);
    tickTimes(world, 2);
    expect(world.villagers[0].jobId).not.toBeNull();
    const activity = world.villagers[0].activity;
    expect(activity.kind === 'travel' && activity.purpose).toBe('harvest');
  });

  it('abandons a job whose tree disappears', () => {
    const world = createWorld();
    order(world, 13);
    tickTimes(world, 30);
    findTree(world, 13)!.state = 'felled';
    const events = tick(world);
    expect(kinds(events)).toContain('job-abandoned');
    expect(world.villagers[0].jobId).toBeNull();
    expect(world.trees.every(tree => tree.reservedBy === null)).toBe(true);
  });
});
