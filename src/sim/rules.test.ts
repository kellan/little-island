import { describe, expect, it } from 'vitest';
import { tick, tickTimes } from './engine.ts';
import { HOME, distance, onLand } from './terrain.ts';
import { MAX_JOBS_PER_VILLAGER } from './tuning.ts';
import { addVillager, createWorld, findSite, jobForSite } from './world.ts';
import type { SimEvent, World } from './types.ts';

const order = (world: World, treeId: number) => world.inbox.push({ kind: 'order-fell', siteId: treeId });
const kinds = (events: SimEvent[]) => events.map(event => event.kind);
const runUntil = (world: World, done: (world: World) => boolean, limit = 3000) => {
  const events: SimEvent[] = [];
  for (let i = 0; i < limit && !done(world); i++) events.push(...tick(world));
  return events;
};

describe('the one true loop', () => {
  it('walks, chops, carries and delivers exactly one log', () => {
    const world = createWorld();
    order(world, 1);
    const events = runUntil(world, w => w.stockpile.stock.log > 0);

    expect(kinds(events)).toEqual(expect.arrayContaining(['order-queued', 'job-assigned', 'work-stroke', 'site-spent', 'ware-delivered']));
    expect(kinds(events).indexOf('site-spent')).toBeLessThan(kinds(events).indexOf('ware-delivered'));
    expect(findSite(world, 1)!.amount).toBe(0);
    expect(findSite(world, 1)!.reservedBy).toBeNull();
    expect(world.stats).toMatchObject({ treesFelled: 1, logsDelivered: 1, ordersQueued: 1 });
    expect(world.villagers[0].carrying).toBeNull();
    expect(distance(world.villagers[0], HOME)).toBeLessThan(.6);
  });

  it('never hands the stockpile a log the villager is still carrying', () => {
    const world = createWorld();
    order(world, 3);
    runUntil(world, w => w.villagers[0].carrying !== null);
    expect(world.stockpile.stock.log).toBe(0);
    runUntil(world, w => w.stockpile.stock.log > 0);
    expect(world.villagers[0].carrying).toBeNull();
  });
});

describe('the job queue', () => {
  it('works a stack of orders one at a time, oldest first', () => {
    const world = createWorld();
    for (const id of [6, 7, 8]) order(world, id);
    const events = runUntil(world, w => w.stockpile.stock.log === 3, 9000);
    const felled = events.filter(event => event.kind === 'site-spent').map(event => event.siteId);
    expect(felled).toEqual([6, 7, 8]);
    expect(world.villagers[0].jobId).toBeNull();
    tickTimes(world, 60);
    expect(world.jobs).toHaveLength(0);
  });

  it('refuses orders it cannot honour, and says why', () => {
    const world = createWorld();
    order(world, 999);
    order(world, 4);
    order(world, 4);
    const reasons = tick(world).filter(event => event.kind === 'order-rejected').map(event => event.reason);
    expect(reasons).toEqual(['unknown-site', 'already-ordered']);

    runUntil(world, w => w.stockpile.stock.log > 0);
    order(world, 4);
    expect(tick(world).filter(event => event.kind === 'order-rejected').map(event => event.reason)).toEqual(['already-spent']);

    const crowded = createWorld();
    for (let id = 1; id <= MAX_JOBS_PER_VILLAGER + 1; id++) order(crowded, id);
    expect(tick(crowded).filter(event => event.kind === 'order-rejected').map(event => event.reason)).toEqual(['queue-full']);
  });

  it('cancels a queued order and releases an assigned one', () => {
    const world = createWorld();
    order(world, 9);
    order(world, 10);
    tickTimes(world, 30);
    expect(jobForSite(world, 9)!.state).toBe('assigned');

    world.inbox.push({ kind: 'cancel-fell', siteId: 10 });
    world.inbox.push({ kind: 'cancel-fell', siteId: 9 });
    const events = tick(world);
    expect(kinds(events).filter(kind => kind === 'order-cancelled')).toHaveLength(2);
    expect(world.villagers[0].jobId).toBeNull();
    expect(findSite(world, 9)!.reservedBy).toBeNull();
    expect(findSite(world, 9)!.amount).toBe(1);

    tickTimes(world, 600);
    expect(world.stockpile.stock.log).toBe(0);
  });

  it('lets a carried log come home even after the order is cancelled', () => {
    const world = createWorld();
    order(world, 5);
    runUntil(world, w => w.villagers[0].carrying !== null);
    world.inbox.push({ kind: 'cancel-all' });
    world.inbox.push({ kind: 'cancel-fell', siteId: 5 });
    runUntil(world, w => w.stockpile.stock.log > 0);
    expect(world.stockpile.stock.log).toBe(1);
  });
});

describe('more hands', () => {
  it('shares work out and never books two villagers onto one tree', () => {
    const world = createWorld();
    addVillager(world, 'Wren', { x: HOME.x + 1, z: HOME.z - 1 });
    for (const id of [11, 12]) order(world, id);
    tickTimes(world, 2);
    const assignees = world.jobs.map(job => job.assignee);
    expect(new Set(assignees).size).toBe(2);
    expect(world.sites.filter(tree => tree.reservedBy !== null)).toHaveLength(2);

    runUntil(world, w => w.stockpile.stock.log === 2, 6000);
    expect(world.stats.treesFelled).toBe(2);
    expect(world.villagers.every(villager => villager.activity.kind !== 'work')).toBe(true);
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
    order(world, 14);
    tickTimes(world, 2);
    expect(world.villagers[0].jobId).not.toBeNull();
    const activity = world.villagers[0].activity;
    expect(activity.kind === 'travel' && activity.purpose).toBe('work');
  });

  it('abandons a job whose tree disappears', () => {
    const world = createWorld();
    order(world, 14);
    tickTimes(world, 30);
    findSite(world, 14)!.amount = 0;
    const events = tick(world);
    expect(kinds(events)).toContain('job-abandoned');
    expect(world.villagers[0].jobId).toBeNull();
    expect(world.sites.every(tree => tree.reservedBy === null)).toBe(true);
  });
});
