/**
 * The long run. Every rulebook, thousands of ticks, a randomised stream of
 * orders, and after every single tick: the invariants must hold and the ware
 * ledger must balance. This is the test that catches what unit tests cannot —
 * a rule that only misbehaves in the company of another rule, three minutes in.
 */
import { describe, expect, it } from 'vitest';
import { HAULING, SETTLEMENT, VILLAGE, type Rulebook } from './rules.ts';
import { tick } from './engine.ts';
import { census, checkWorld, ledger } from './invariants.ts';
import { deserialize, serialize } from './serialize.ts';
import { HOME } from './terrain.ts';
import { addBuilding, addVillager, createWorld, hashWorld, hire, standingTrees } from './world.ts';
import { nextRandom } from './rng.ts';
import { WARES, type World } from './types.ts';

/** A village with something to do, built the same way every time. */
function village(seed: number): World {
  const world = createWorld(seed);
  const hut = addBuilding(world, 'lumberjack-hut', { x: HOME.x + 2.4, z: HOME.z - 1.5 });
  const mill = addBuilding(world, 'sawmill', { x: HOME.x - 2.6, z: HOME.z + 1.2 });
  hire(world, world.villagers[0], hut);
  hire(world, addVillager(world, 'Wren', HOME), mill);
  addVillager(world, 'Fen', HOME, 'carrier');
  return world;
}

/** A separate stream of randomness, so the world's own seed is untouched. */
function meddler(seed: number) {
  const state = { seed };
  return (world: World) => {
    const roll = nextRandom(state);
    const trees = standingTrees(world);
    if (roll < .55 || !trees.length) return;
    const tree = trees[Math.floor(nextRandom(state) * trees.length)];
    if (roll < .85) world.inbox.push({ kind: 'order-fell', siteId: tree.id });
    else if (roll < .95) world.inbox.push({ kind: 'cancel-fell', siteId: tree.id });
    else world.inbox.push({ kind: 'cancel-all' });
  };
}

function soak(book: Rulebook, world: World, ticks: number, meddle?: (world: World) => void) {
  let lastChange = 0;
  for (let i = 0; i < ticks; i++) {
    if (meddle && i % 90 === 0) meddle(world);
    const before = census(world);
    const events = tick(world, { rules: book.rules });
    const after = census(world);
    const claimed = ledger(events);

    const broken = checkWorld(world);
    if (broken.length) throw new Error(`${book.id} broke ${broken[0].invariant} at tick ${world.tick}: ${broken[0].detail}`);
    for (const ware of WARES) {
      if (after[ware] !== before[ware] + claimed[ware]) {
        throw new Error(`${book.id} lost track of ${ware} at tick ${world.tick}: ${before[ware]} + ${claimed[ware]} ≠ ${after[ware]}`);
      }
    }
    if (events.length) lastChange = i;
  }
  return { lastChange };
}

describe('the long run', () => {
  it('holds every invariant and balances every ware, under orders, for ten minutes', () => {
    for (const book of [SETTLEMENT, HAULING, VILLAGE]) {
      const world = book === VILLAGE ? village(7) : createWorld(7);
      soak(book, world, 18_000, meddler(4));
      expect(checkWorld(world)).toEqual([]);
    }
  }, 30_000);

  it('gets a plank out of a standing forest without being told to', () => {
    const world = village(3);
    soak(VILLAGE, world, 6_000);
    expect(world.buildings[1].stock.plank).toBeGreaterThan(0);
    expect(world.stats.treesFelled).toBeGreaterThan(2);
  });

  it('keeps working: something happens at least every few seconds while work remains', () => {
    const world = village(11);
    const { lastChange } = soak(VILLAGE, world, 9_000);
    // Once both stores fill, silence is correct. Before then, a long quiet
    // stretch means the settlement has deadlocked with work still to do.
    expect(lastChange).toBeGreaterThan(4_000);
  });

  it('comes back from a save mid-stride and runs the identical future', () => {
    const live = village(21);
    soak(VILLAGE, live, 3_000, meddler(9));
    const restored = deserialize(serialize(live));
    expect(restored).not.toBeNull();
    soak(VILLAGE, live, 2_000);
    soak(VILLAGE, restored!, 2_000);
    expect(hashWorld(restored!)).toBe(hashWorld(live));
  });

  it('replays a randomised session identically from the same seeds', () => {
    const run = () => {
      const world = village(5);
      soak(VILLAGE, world, 4_000, meddler(2));
      return hashWorld(world);
    };
    expect(run()).toBe(run());
  });
});
