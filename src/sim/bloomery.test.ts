/**
 * The bloomery: the first recipe that takes two different inputs, and the first
 * time two buildings want the same thing at once.
 *
 * The chain is tree → log → (kiln) charcoal, bog → ore, and ore + charcoal →
 * bloom. Four stages, and the claim under test is that it took no new rules.
 */
import { describe, expect, it } from 'vitest';
import { VILLAGE } from './rules.ts';
import { tickTimes } from './engine.ts';
import { census, checkWorld, ledger } from './invariants.ts';
import { HOME } from './terrain.ts';
import { TASKS } from './tuning.ts';
import {
  addBuilding, addVillager, createWorld, findBuilding, hire, liveSites, shortages,
  spare, taskIsReady, wantsOf,
} from './world.ts';
import type { Building, SimEvent, World } from './types.ts';

const rules = VILLAGE.rules;
const run = (world: World, count: number) => tickTimes(world, count, { rules });
const kinds = (events: SimEvent[]) => events.map(event => event.kind);

/** The iron chain, staffed. The bog is put where the pit can reach it. */
function ironworks() {
  const world = createWorld();
  const bog = liveSites(world, 'bog')[0];
  const hut = addBuilding(world, 'lumberjack-hut', { x: HOME.x + 2.4, z: HOME.z - 1.5 });
  const kiln = addBuilding(world, 'kiln', { x: HOME.x + 3.4, z: HOME.z + 1.8 });
  const pit = addBuilding(world, 'ore-pit', { x: bog.x + 1.5, z: bog.z });
  const bloomery = addBuilding(world, 'bloomery', { x: HOME.x - 1.2, z: HOME.z - 3.4 });
  hire(world, world.villagers[0], hut);
  hire(world, addVillager(world, 'Cass', HOME), kiln);
  hire(world, addVillager(world, 'Bryn', HOME), pit);
  hire(world, addVillager(world, 'Dov', HOME), bloomery);
  return { world, hut, kiln, pit, bloomery };
}

const until = (world: World, done: (world: World) => boolean, limit = 40000) => {
  const events: SimEvent[] = [];
  for (let i = 0; i < limit && !done(world); i++) events.push(...run(world, 1));
  return events;
};

describe('a recipe with two inputs', () => {
  it('waits for both, not either', () => {
    const { world, bloomery } = ironworks();
    const smelt = TASKS.smelt;
    expect(smelt.takes).toHaveLength(2);
    expect(taskIsReady(world, bloomery, smelt)).toBe(false);

    bloomery.stock.ore = 1;
    expect(taskIsReady(world, bloomery, smelt), 'ore alone is not enough').toBe(false);
    bloomery.stock.charcoal = 1;
    expect(taskIsReady(world, bloomery, smelt), 'one sack short').toBe(false);
    bloomery.stock.charcoal = 2;
    expect(taskIsReady(world, bloomery, smelt)).toBe(true);
  });

  it('keeps a queue of each input, derived from the recipe', () => {
    const { bloomery } = ironworks();
    // Two on hand of each ingredient's worth: one ore and two charcoal per bloom.
    expect(wantsOf(bloomery)).toEqual({ ore: 2, charcoal: 4 });
  });

  it('fetches a shortage it can source, not only the first one it lists', () => {
    const { world, kiln, bloomery } = ironworks();
    kiln.stock.charcoal = 6;
    // Short of both, and nobody on the island has ore.
    expect(shortages(bloomery)).toEqual(['ore', 'charcoal']);
    expect(world.buildings.every(building => spare(world, building, 'ore') === 0)).toBe(true);

    const events = until(world, w => findBuilding(w, bloomery.id)!.stock.charcoal > 0, 4000);
    expect(kinds(events), 'it went for the charcoal instead of sitting still').toContain('supply-asked');
    expect(bloomery.stock.charcoal).toBeGreaterThan(0);
  });

  it('turns one ore and two charcoal into exactly one bloom', () => {
    const { world, bloomery } = ironworks();
    bloomery.stock.ore = 1;
    bloomery.stock.charcoal = 2;
    const before = census(world);
    const events = until(world, w => findBuilding(w, bloomery.id)!.stock.bloom > 0, 4000);
    const after = census(world);

    expect(bloomery.stock.bloom).toBe(1);
    expect(bloomery.stock.ore).toBe(0);
    expect(bloomery.stock.charcoal).toBe(0);
    // The ledger has to account for both what went in and what came out.
    const claimed = ledger(events);
    expect(after.bloom - before.bloom).toBe(claimed.bloom);
    expect(after.charcoal - before.charcoal).toBe(claimed.charcoal);
    expect(claimed.charcoal).toBe(-2);
  });
});

describe('two buildings, one log', () => {
  it('never sends two workers for the same one', () => {
    const { world, hut, kiln } = ironworks();
    const mill = addBuilding(world, 'sawmill', { x: HOME.x - 2.6, z: HOME.z + 1.2 });
    hire(world, addVillager(world, 'Wren', HOME), mill);
    hut.stock.log = 1; // Exactly one, and two workshops that want it.

    run(world, 400);
    const claims = world.jobs.filter(job => job.kind === 'supply' && job.from === hut.id
      && (job.state === 'queued' || job.state === 'assigned'));
    expect(claims.length, 'only one errand is out for the only log').toBeLessThanOrEqual(1);
    expect(spare(world, hut, 'log'), 'a log already spoken for is not spare').toBe(0);
    expect(findBuilding(world, kiln.id)).toBeTruthy();
  });
});

describe('the whole chain', () => {
  it('gets from a standing tree to an iron bloom, and stays sound throughout', () => {
    const { world, bloomery } = ironworks();
    let felled = false, burned = false;
    const events = until(world, w => findBuilding(w, bloomery.id)!.stock.bloom > 0);
    for (const event of events) {
      if (event.kind === 'site-spent' && event.siteKind === 'tree') felled = true;
      if (event.kind === 'ware-made' && event.ware === 'charcoal') burned = true;
    }
    expect(felled, 'a tree came down').toBe(true);
    expect(burned, 'a kiln turned a log into charcoal').toBe(true);
    expect(bloomery.stock.bloom).toBeGreaterThan(0);
    expect(checkWorld(world)).toEqual([]);
  });

  it('cost no new rules', () => {
    // The ore pit, the kiln and the bloomery arrived as three rows in the building
    // table and three in the task table. The rulebook did not move: 22 is what it
    // was before them, once the forager had added `regrow-sites`. If this number
    // grows when a building is added, the task model has stopped paying for itself.
    expect(VILLAGE.rules).toHaveLength(22);
  });
});
