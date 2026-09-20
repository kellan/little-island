import { describe, expect, it } from 'vitest';
import rulebookDoc from '../../docs/RULE_ENGINE.md?raw';
import { PHASES, RULEBOOKS, RULES } from './rules.ts';
import { advance, alpha, createSimulation, enqueue, tick, tickTimes } from './engine.ts';
import { createWorld, elapsedSeconds, hashWorld } from './world.ts';
import { deserialize, serialize } from './serialize.ts';
import { TICK_SECONDS } from './tuning.ts';
import type { SimEvent } from './types.ts';

const kinds = (events: SimEvent[]) => events.map(event => event.kind);

describe('rulebooks', () => {
  it('each have unique ids and run strictly in phase order', () => {
    expect(RULEBOOKS.map(book => book.id)).toContain('settlement');
    for (const book of RULEBOOKS) {
      expect(new Set(book.rules.map(rule => rule.id)).size).toBe(book.rules.length);
      const order = book.rules.map(rule => PHASES.indexOf(rule.phase));
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(book.rules.every(rule => rule.about.length > 10)).toBe(true);
    }
    expect(RULES).toEqual(RULEBOOKS[0].rules);
  });

  it('are written down: every rule in every book appears in the documentation', () => {
    for (const book of RULEBOOKS) {
      for (const rule of book.rules) expect(rulebookDoc).toContain(`| ${rule.phase} | \`${rule.id}\``);
    }
  });
});

describe('clock', () => {
  it('quantises real time into whole ticks and carries the remainder', () => {
    const sim = createSimulation();
    for (let frame = 0; frame < 10; frame++) advance(sim, 1 / 60);
    expect(sim.world.tick).toBe(5);
    expect(elapsedSeconds(sim.world)).toBeCloseTo(5 / 30, 10);

    advance(sim, TICK_SECONDS * 2.5);
    expect(sim.lastTicks).toBe(2);
    expect(alpha(sim)).toBeCloseTo(.5, 5);
    advance(sim, TICK_SECONDS / 4);
    expect(sim.lastTicks).toBe(0);
    expect(alpha(sim)).toBeCloseTo(.75, 5);
  });

  it('reaches the same world whether frames are smooth or ragged', () => {
    const smooth = createSimulation(createWorld(7));
    const ragged = createSimulation(createWorld(7));
    enqueue(smooth, { kind: 'order-harvest', treeId: 3 });
    enqueue(ragged, { kind: 'order-harvest', treeId: 3 });
    for (let i = 0; i < 600; i++) advance(smooth, 1 / 60);
    for (const slice of Array.from({ length: 100 }, (_, i) => (i % 5) * .02 + .02)) advance(ragged, slice);
    while (ragged.world.tick < smooth.world.tick) tick(ragged.world);
    expect(hashWorld(ragged.world)).toBe(hashWorld(smooth.world));
  });

  it('ignores nonsense time and refuses to lurch after a long pause', () => {
    const sim = createSimulation();
    advance(sim, Number.NaN);
    advance(sim, -5);
    expect(sim.world.tick).toBe(0);
    advance(sim, 3600);
    expect(sim.world.tick).toBeLessThanOrEqual(8);
  });
});

describe('determinism', () => {
  it('replays identically from the same seed and the same orders', () => {
    const run = () => {
      const world = createWorld(21);
      const events: SimEvent[] = [];
      for (const [at, treeId] of [[0, 2], [40, 5], [900, 8]] as const) {
        while (world.tick < at) events.push(...tick(world));
        world.inbox.push({ kind: 'order-harvest', treeId });
      }
      events.push(...tickTimes(world, 2400));
      return { hash: hashWorld(world), events };
    };
    const first = run(), second = run();
    expect(second.hash).toBe(first.hash);
    expect(JSON.stringify(second.events)).toBe(JSON.stringify(first.events));
    expect(kinds(first.events)).toContain('ware-delivered');
  });
});

describe('persistence', () => {
  it('restores a job in progress and continues into the identical future', () => {
    const world = createWorld();
    world.inbox.push({ kind: 'order-harvest', treeId: 1 });
    tickTimes(world, 200);
    const restored = deserialize(serialize(world))!;
    expect(restored).toEqual(world);
    tickTimes(world, 900);
    tickTimes(restored, 900);
    expect(hashWorld(restored)).toBe(hashWorld(world));
    expect(restored.stockpile.stock.timber).toBe(1);
  });

  it('keeps orders queued during the save', () => {
    const world = createWorld();
    world.inbox.push({ kind: 'order-harvest', treeId: 4 });
    const restored = deserialize(serialize(world))!;
    expect(restored.inbox).toHaveLength(1);
    expect(kinds(tickTimes(restored, 1))).toEqual(['order-queued', 'job-assigned']);
  });

  it('refuses anything that is not a world we can run', () => {
    const broken = [
      '{', '{}', 'null', '[]',
      JSON.stringify({ ...createWorld(), version: 1 }),
      JSON.stringify({ ...createWorld(), tick: -4 }),
      JSON.stringify({ ...createWorld(), villagers: [] }),
      JSON.stringify({ ...createWorld(), stockpile: { x: 0, z: 0, stock: { timber: -2 } } }),
    ];
    for (const raw of broken) expect(deserialize(raw)).toBeNull();

    const dangling = createWorld();
    dangling.jobs.push({ id: 9, kind: 'harvest', treeId: 999, state: 'queued', assignee: null, priority: 0, createdTick: 0, finishedTick: null });
    expect(deserialize(serialize(dangling))).toBeNull();

    const badActivity = createWorld();
    badActivity.villagers[0].activity = { kind: 'harvest', treeId: 12345, progress: 0, duration: 1 };
    expect(deserialize(serialize(badActivity))).toBeNull();
  });
});
