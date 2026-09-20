import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { createWorld, tick, tickTimes, type SimEvent } from '../sim/index.ts';
import { describeVillager, palette, renderEvents, renderMap, renderTrees, renderWorkList } from './view.ts';

const paint = palette(false);
const ordered = (treeId: number) => {
  const world = createWorld();
  world.inbox.push({ kind: 'order-fell', siteId: treeId });
  return world;
};

describe('the island in text', () => {
  it('draws land, the clearing and the villager', () => {
    const world = createWorld();
    world.villagers[0].x = 6;
    const map = renderMap(world, paint);
    expect(map.split('\n')).toHaveLength(21);
    expect(map).toContain('@');
    expect(map).toContain('\u2302');
    expect(map).toMatch(/[\u25b2\u2663]/);
    expect(map.startsWith(' ')).toBe(true); // Sea in the corners.
  });

  it('marks ordered trees and leaves stumps behind', () => {
    const world = ordered(1);
    tick(world);
    expect(renderMap(world, paint)).toContain('\u25c6');
    expect(renderWorkList(world, paint)).toContain('#1');
    tickTimes(world, 900);
    expect(renderMap(world, paint)).toContain(',');
    expect(renderMap(world, paint)).not.toContain('\u25c6');
    expect(renderWorkList(world, paint)).toBe('empty');
  });

  it('names the nearest trees and says which are spoken for', () => {
    const world = ordered(8);
    tickTimes(world, 2);
    const lines = renderTrees(world, paint, 4).split('\n');
    expect(lines).toHaveLength(4);
    expect(lines.filter(line => line.includes('marked'))).toHaveLength(1);
    const distances = lines.map(line => Number(line.match(/([\d.]+) away/)![1]));
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('says what a villager is up to at each step of a job', () => {
    const world = ordered(1);
    const seen = new Set<string>();
    for (let i = 0; i < 900; i++) { tick(world); seen.add(describeVillager(world, world.villagers[0]).split(',')[0].split('  ')[0]); }
    expect([...seen].some(text => text.startsWith('walking to fir #1') || text.startsWith('walking to oak #1'))).toBe(true);
    expect([...seen].some(text => text.startsWith('chopping'))).toBe(true);
    expect(seen).toContain('carrying a log home');
  });

  it('turns events into prose and collapses the axe swings', () => {
    const world = ordered(1);
    const events: SimEvent[] = tickTimes(world, 900);
    const lines = renderEvents(world, events, paint).map(line => line.replace(/^\[\d\d:\d\d\] /, ''));
    expect(lines).toEqual([
      '#1 goes on the work list',
      'Robin sets off for #1',
      expect.stringMatching(/^Robin swings the axe \u00d7\d+$/),
      '#1 comes down',
      'a log is left lying where it fell',
      'Robin picks up a log',
      'a log reaches the clearing \u2014 log 1',
    ]);
  });
});

describe('the terminal client', () => {
  it('plays a whole day at the hut from piped commands', () => {
    const transcript = execFileSync('node', ['src/cli/play.ts', '--no-color'], {
      input: 'huts\nuntil\nhuts\nquit\n', encoding: 'utf8', timeout: 30000,
    });
    expect(transcript).toContain('takes the axe from the hut');
    expect(transcript).toContain('a log goes into the hut \u2014 1 of 5');
    expect(transcript).toContain('the hut is full');
    expect(transcript).toContain('store 5/5 full');
  }, 30000);
});
