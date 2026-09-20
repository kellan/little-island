/**
 * Drawing the island in text. Pure functions from world to strings: no readline,
 * no node imports, nothing to stop a test rendering a frame and reading it.
 */
import {
  HOME, distance, elapsedSeconds, findPile, findTree, findVillager, jobForTree, loosePiles,
  onLand, tuning, type Job, type SimEvent, type Tree, type Villager, type WareId, type World,
} from '../sim/index.ts';

export type Paint = (text: string) => string;
export type Palette = ReturnType<typeof palette>;

export function palette(color: boolean) {
  const style = (code: string): Paint => color ? (text) => `\u001b[${code}m${text}\u001b[0m` : (text) => text;
  return {
    plain: ((text: string) => text) as Paint,
    dim: style('2'), bold: style('1'),
    grass: style('32'), leaf: style('92'), sand: style('33'),
    amber: style('38;5;214'), bark: style('38;5;137'),
    water: style('36'), person: style('1;97'), warn: style('31'),
  };
}

const MAP_COLUMNS = 52, MAP_ROWS = 21, MAP_X = 17, MAP_Z = 13.6;
const GLYPH = { conifer: '▲', broadleaf: '♣', marked: '◆', stump: ',', home: '⌂', person: '@', timber: '=', stone: 'o' };

const column = (x: number) => Math.round((x + MAP_X) / (2 * MAP_X) * (MAP_COLUMNS - 1));
const row = (z: number) => Math.round((z + MAP_Z) / (2 * MAP_Z) * (MAP_ROWS - 1));
const worldX = (col: number) => col / (MAP_COLUMNS - 1) * 2 * MAP_X - MAP_X;
const worldZ = (r: number) => r / (MAP_ROWS - 1) * 2 * MAP_Z - MAP_Z;

export function clock(world: World): string {
  const seconds = Math.floor(elapsedSeconds(world));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function compass(from: { x: number; z: number }, to: { x: number; z: number }): string {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  // Screen north is -z, and the map is drawn the same way up as the island.
  const angle = Math.atan2(to.x - from.x, -(to.z - from.z));
  return points[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
}

export function label(tree: Tree): string {
  return `${tree.kind === 0 ? 'fir' : 'oak'} #${tree.id}`;
}

/** What a ware is called when it is one thing you can pick up. */
export function wareName(ware: WareId, amount = 1): string {
  const one = ware === 'timber' ? 'log' : 'stone';
  return amount === 1 ? `a ${one}` : `${amount} ${one}s`;
}

/** What a job is for, in words: a numbered tree, or a ware on the ground. */
export function jobTarget(world: World, job: Job): string {
  if (job.kind === 'harvest') return `#${job.treeId}`;
  const pile = findPile(world, job.pileId);
  return pile ? wareName(pile.ware, pile.amount) : 'a lost ware';
}

function bar(fraction: number, width = 10): string {
  const full = Math.max(0, Math.min(width, Math.round(fraction * width)));
  return `${'█'.repeat(full)}${'░'.repeat(width - full)}`;
}

/** The island, one character per patch of ground. */
export function renderMap(world: World, paint: Palette): string {
  const cells: string[][] = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    cells.push(Array.from({ length: MAP_COLUMNS }, (_, col) => {
      const x = worldX(col), z = worldZ(r);
      if (onLand(x, z)) return paint.grass(paint.dim('·'));
      if ((x / 15.4) ** 2 + (z / 12.4) ** 2 <= 1) return paint.sand(paint.dim('.'));
      return ' ';
    }));
  }
  const put = (x: number, z: number, glyph: string) => {
    const col = column(x), r = row(z);
    if (col >= 0 && col < MAP_COLUMNS && r >= 0 && r < MAP_ROWS) cells[r][col] = glyph;
  };
  for (const tree of world.trees) {
    if (tree.state === 'felled') { put(tree.x, tree.z, paint.bark(GLYPH.stump)); continue; }
    if (jobForTree(world, tree.id)) { put(tree.x, tree.z, paint.amber(GLYPH.marked)); continue; }
    put(tree.x, tree.z, paint.leaf(tree.kind === 0 ? GLYPH.conifer : GLYPH.broadleaf));
  }
  for (const pile of world.piles) put(pile.x, pile.z, paint.bark(pile.ware === 'timber' ? GLYPH.timber : GLYPH.stone));
  put(world.stockpile.x, world.stockpile.z, paint.sand(GLYPH.home));
  for (const villager of world.villagers) put(villager.x, villager.z, paint.person(GLYPH.person));
  return cells.map(line => line.join('')).join('\n');
}

export function renderLegend(paint: Palette): string {
  return paint.dim(`${GLYPH.conifer} ${GLYPH.broadleaf} tree   ${GLYPH.marked} marked   ${GLYPH.stump} stump   ${GLYPH.timber} ${GLYPH.stone} ware on the ground   ${GLYPH.home} clearing   ${GLYPH.person} villager`);
}

export function describeVillager(world: World, villager: Villager): string {
  const activity = villager.activity;
  if (activity.kind === 'harvest') {
    const tree = world.trees.find(t => t.id === activity.treeId);
    const done = activity.progress / activity.duration;
    return `chopping ${tree ? label(tree) : 'a tree'}  ${bar(done)} ${Math.round(done * 100)}%`;
  }
  if (activity.kind === 'travel') {
    const away = distance(villager, activity.to).toFixed(1);
    if (activity.purpose === 'deliver') return `carrying ${villager.carrying ? wareName(villager.carrying.ware, villager.carrying.amount) : 'something'} home, ${away} away`;
    if (activity.purpose === 'roam') return 'having a wander';
    const job = world.jobs.find(j => j.id === villager.jobId);
    if (activity.purpose === 'collect') return `going to fetch ${job ? jobTarget(world, job) : 'a ware'}, ${away} away`;
    const tree = job?.kind === 'harvest' ? findTree(world, job.treeId) : undefined;
    return `walking to ${tree ? label(tree) : 'work'}, ${away} away`;
  }
  return villager.restUntil > world.tick ? 'taking a breather' : 'taking it all in';
}

/** The stockpile, and anything still lying about outside it. */
export function renderWares(world: World, paint: Palette): string {
  const stock = Object.entries(world.stockpile.stock)
    .map(([ware, count]) => `${ware} ${count > 0 ? paint.bold(String(count)) : paint.dim('0')}`)
    .join(paint.dim(' · '));
  const loose = world.piles.length
    ? world.piles.map(pile => `${wareName(pile.ware, pile.amount)}${pile.reservedBy === null ? '' : paint.dim(' (spoken for)')}`).join(paint.dim(' · '))
    : paint.dim('nothing');
  return `  ${paint.dim('stockpile')}  ${stock}\n  ${paint.dim('on the ground')}  ${loose}`;
}

export function renderStatus(world: World, paint: Palette): string {
  const lines = [
    `${paint.bold('Little Island')}  ${clock(world)}   timber ${paint.bold(String(world.stockpile.stock.timber))}   felled ${world.stats.treesFelled}   standing ${world.trees.filter(t => t.state === 'standing').length}${world.piles.length ? `   ${paint.bark(`${world.piles.length} on the ground`)}` : ''}`,
  ];
  for (const villager of world.villagers) {
    const role = villager.role === 'hand' ? '' : paint.dim(`${villager.role} `);
    lines.push(`  ${paint.person(villager.name.padEnd(7))} ${role}${describeVillager(world, villager)}`);
  }
  lines.push(`  ${paint.dim('work list')}  ${renderWorkList(world, paint)}`);
  return lines.join('\n');
}

export function renderWorkList(world: World, paint: Palette): string {
  const jobs = world.jobs.filter(job => job.state === 'queued' || job.state === 'assigned');
  if (!jobs.length) return paint.dim('empty');
  return jobs.map(job => {
    const worker = findVillager(world, job.assignee);
    return `${paint.amber(jobTarget(world, job))}${worker ? ` ${paint.dim(worker.name)}` : paint.dim(' waiting')}`;
  }).join(paint.dim(' · '));
}

/** The trees worth naming: nearest first, standing only. */
export function renderTrees(world: World, paint: Palette, limit = 10): string {
  const standing = world.trees.filter(tree => tree.state === 'standing')
    .map(tree => ({ tree, away: distance(tree, HOME) }))
    .sort((a, b) => a.away - b.away)
    .slice(0, limit);
  if (!standing.length) return paint.dim('  not a tree left standing.');
  return standing.map(({ tree, away }) => {
    const marked = jobForTree(world, tree.id) ? paint.amber('  marked') : '';
    return `  ${label(tree).padEnd(8)} ${away.toFixed(1).padStart(5)} away  ${compass(HOME, tree).padEnd(2)}${marked}`;
  }).join('\n');
}

export function renderRules(rules: readonly { id: string; phase: string; about: string }[], paint: Palette): string {
  return rules.map(rule => `  ${paint.dim(rule.phase.padEnd(8))}${rule.id.padEnd(21)}${paint.dim(rule.about)}`).join('\n');
}

const REJECTION = {
  'unknown-tree': 'there is no such tree',
  'already-felled': 'that one is already down',
  'already-ordered': 'already on the list',
  'queue-full': 'that is plenty of work for now',
} as const;

function sentence(world: World, event: SimEvent): string | null {
  const who = (id: number) => findVillager(world, id)?.name ?? 'someone';
  switch (event.kind) {
    case 'order-queued': return `#${event.treeId} goes on the work list`;
    case 'order-rejected': return `#${event.treeId} — ${REJECTION[event.reason]}`;
    case 'order-cancelled': return `#${event.treeId} called off`;
    case 'job-assigned': {
      if (event.job === 'harvest') return `${who(event.villagerId)} sets off for #${event.targetId}`;
      // By the time this is read the ware is often already picked up, hence "it".
      const pile = findPile(world, event.targetId);
      return `${who(event.villagerId)} goes to fetch ${pile ? wareName(pile.ware, pile.amount) : 'it'}`;
    }
    case 'job-abandoned': return `${event.villagerId === null ? 'nobody' : who(event.villagerId)} gives up on ${event.job === 'harvest' ? `#${event.targetId}` : 'a ware'}`;
    case 'tree-felled': return `#${event.treeId} comes down`;
    case 'ware-dropped': return `${wareName(event.ware)} is left lying where it fell`;
    case 'ware-collected': return `${who(event.villagerId)} picks up ${wareName(event.ware, event.amount)}`;
    case 'ware-delivered': return `${wareName(event.ware, event.amount)} ${event.amount === 1 ? 'reaches' : 'reach'} the clearing — ${event.ware} ${event.total}`;
    case 'chop-swing': return null; // Counted, not narrated one swing at a time.
  }
}

/** Events as prose. Runs of axe swings collapse into one line per villager. */
export function renderEvents(world: World, events: SimEvent[], paint: Palette): string[] {
  const lines: string[] = [];
  const swings = new Map<number, { count: number; tick: number }>();
  const flushSwings = () => {
    for (const [villagerId, run] of swings) {
      lines.push(`${paint.dim(`[${stamp(run.tick)}]`)} ${findVillager(world, villagerId)?.name ?? 'someone'} swings the axe \u00d7${run.count}`);
    }
    swings.clear();
  };
  for (const event of events) {
    if (event.kind === 'chop-swing') {
      const run = swings.get(event.villagerId) ?? { count: 0, tick: event.tick };
      swings.set(event.villagerId, { count: run.count + 1, tick: run.tick });
      continue;
    }
    flushSwings();
    const text = sentence(world, event);
    if (text) lines.push(`${paint.dim(`[${stamp(event.tick)}]`)} ${text}`);
  }
  flushSwings();
  return lines;
}

function stamp(tick: number): string {
  const seconds = Math.floor(tick * tuning.TICK_SECONDS);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function renderTraceStep(step: { rule: string; phase: string; fired: number }, paint: Palette): string {
  return `    ${paint.dim(step.phase.padEnd(8))}${step.rule.padEnd(21)}${paint.dim(`×${step.fired}`)}`;
}
