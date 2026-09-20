/**
 * The engine has no renderer, so it can be run flat out. This is both a test and
 * the cheapest performance answer we have: how much settlement can one browser
 * tab's simulation budget hold? Numbers print with `npm test`.
 */
import { describe, expect, it } from 'vitest';
import { tickTimes } from './engine.ts';
import { HOME } from './terrain.ts';
import { addVillager, createWorld, hashWorld, standingTrees } from './world.ts';
import type { World } from './types.ts';

function crowd(villagers: number): World {
  const world = createWorld(5);
  // A wider forest than the prototype island, planted on a grid so the test is stable.
  world.trees = [];
  for (let i = 0; i < 300; i++) {
    const x = (i % 20 - 10) * 1.2 + .3, z = (Math.floor(i / 20) - 7) * 1.1;
    world.trees.push({ id: i, x, z, scale: 1, kind: 0, state: 'standing', reservedBy: null });
  }
  world.villagers = [];
  world.nextVillagerId = 1;
  for (let i = 0; i < villagers; i++) addVillager(world, `Worker ${i}`, { x: HOME.x + (i % 8) * .3, z: HOME.z + Math.floor(i / 8) * .3 });
  return world;
}

describe('at scale', () => {
  it('keeps a crowd of villagers working, and stays quick enough to be worth trying', () => {
    const world = crowd(120);
    for (let i = 0; i < 240; i++) world.inbox.push({ kind: 'order-fell', treeId: i });
    const started = performance.now();
    tickTimes(world, 1800);
    const perTick = (performance.now() - started) / 1800;
    console.log(`120 villagers, 300 trees: ${perTick.toFixed(3)} ms/tick (budget at 30 Hz is 33 ms)`);

    expect(world.stockpile.stock.log).toBe(240);
    expect(standingTrees(world)).toHaveLength(60);
    expect(world.villagers.every(villager => villager.jobId === null)).toBe(true);
    expect(perTick).toBeLessThan(33);
  });

  it('stays deterministic with many hands in the same forest', () => {
    const build = () => {
      const world = crowd(40);
      for (let id = 0; id < 60; id++) world.inbox.push({ kind: 'order-fell', treeId: id });
      tickTimes(world, 900);
      return world;
    };
    expect(hashWorld(build())).toBe(hashWorld(build()));
  });
});
