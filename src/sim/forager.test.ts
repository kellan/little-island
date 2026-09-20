/**
 * The forager's hut: the first building that takes from the world without felling
 * anything, and the first ware that comes home in the worker's own hands.
 */
import { describe, expect, it } from 'vitest';
import { VILLAGE } from './rules.ts';
import { tick, tickTimes } from './engine.ts';
import { checkWorld } from './invariants.ts';
import { HOME, distance } from './terrain.ts';
import { SITE_KINDS } from './tuning.ts';
import { addBuilding, addVillager, createWorld, findBuilding, heldIn, hire, liveSites, secondsToTicks } from './world.ts';
import type { SimEvent, World } from './types.ts';

const rules = VILLAGE.rules;
const run = (world: World, count: number) => tickTimes(world, count, { rules });
const kinds = (events: SimEvent[]) => events.map(event => event.kind);
const until = (world: World, done: (world: World) => boolean, limit = 6000) => {
  const events: SimEvent[] = [];
  for (let i = 0; i < limit && !done(world); i++) events.push(...run(world, 1));
  return events;
};

function withForager() {
  const world = createWorld();
  const hut = addBuilding(world, 'foragers-hut', { x: HOME.x + .6, z: HOME.z + 2.6 });
  hire(world, world.villagers[0], hut);
  return { world, hut, forager: world.villagers[0] };
}

describe('the forager’s hut', () => {
  it('picks up a basket and brings it home in hand, leaving nothing on the ground', () => {
    const { world, hut } = withForager();
    // Sampling between ticks is no good here: a patch right by the door is gathered
    // and stored inside one tick. The event stream is what says how it travelled.
    let everLeftLying = false;
    const events = until(world, w => { everLeftLying ||= w.piles.length > 0; return heldIn(findBuilding(w, hut.id)!) > 0; });
    const order = kinds(events);
    expect(order).toContain('ware-gathered');
    expect(order.indexOf('ware-gathered')).toBeLessThan(order.indexOf('ware-stored'));
    expect(order, 'nothing was left for somebody else to fetch').not.toContain('ware-dropped');
    expect(order).not.toContain('ware-collected');
    expect(everLeftLying).toBe(false);
    expect(hut.stock.forage).toBeGreaterThan(0);
    expect(world.villagers[0].carrying).toBeNull();
  });

  it('empties the nearest patch, then ranges further for the next one', () => {
    const { world, hut } = withForager();
    const nearest = liveSites(world, 'patch').sort((a, b) => distance(a, hut) - distance(b, hut))[0];
    const startedWith = nearest.amount;
    until(world, w => w.sites.find(site => site.id === nearest.id)!.amount === 0, 20000);
    expect(startedWith).toBeGreaterThan(1);
    expect(nearest.amount).toBe(0);

    // With the near patch spent, the work moves to a further one rather than stopping.
    const events = until(world, w => w.villagers[0].activity.kind === 'work', 4000);
    const assigned = events.filter(event => event.kind === 'job-assigned');
    expect(assigned.length).toBeGreaterThan(0);
    expect(assigned.at(-1)!.targetId).not.toBe(nearest.id);
  });

  it('lets a picked-over patch come back', () => {
    const { world } = withForager();
    const patch = liveSites(world, 'patch')[0];
    patch.amount = 0;
    run(world, secondsToTicks(SITE_KINDS.patch.regrowSeconds) + 2);
    expect(patch.amount).toBe(1);
    expect(patch.amount).toBeLessThanOrEqual(patch.max);
  });

  it('never grows a patch past what it holds', () => {
    const { world } = withForager();
    run(world, secondsToTicks(SITE_KINDS.patch.regrowSeconds * 8));
    for (const patch of world.sites.filter(site => site.kind === 'patch')) {
      expect(patch.amount).toBeLessThanOrEqual(patch.max);
    }
    expect(checkWorld(world)).toEqual([]);
  });

  it('refuses an order to fell a berry patch', () => {
    const world = createWorld();
    const patch = liveSites(world, 'patch')[0];
    world.inbox.push({ kind: 'order-fell', siteId: patch.id });
    const events = tick(world, { rules });
    expect(events.filter(event => event.kind === 'order-rejected').map(event => event.reason)).toEqual(['unknown-site']);
    expect(world.jobs).toHaveLength(0);
  });

  it('costs one new rule and no new machinery', () => {
    // The hut and the mill were already here; the forager is a row in the table.
    const { world, hut } = withForager();
    addBuilding(world, 'sawmill', { x: HOME.x - 2.6, z: HOME.z + 1.2 });
    const lumberjack = addBuilding(world, 'lumberjack-hut', { x: HOME.x + 2.4, z: HOME.z - 1.5 });
    hire(world, addVillager(world, 'Wren', HOME), lumberjack);
    until(world, w => heldIn(findBuilding(w, hut.id)!) > 0 && w.stats.treesFelled > 0, 20000);
    expect(hut.stock.forage).toBeGreaterThan(0);
    expect(world.stats.treesFelled).toBeGreaterThan(0);
    expect(checkWorld(world)).toEqual([]);
  });
});
