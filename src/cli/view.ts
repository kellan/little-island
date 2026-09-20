/**
 * Drawing the island in text. Pure functions from world to strings: no readline,
 * no node imports, nothing to stop a test rendering a frame and reading it.
 */
import {
  HOME, distance, elapsedSeconds, findBuilding, findPile, findSite, findVillager, heldIn,
  hasRoom, jobForSite, liveSites, onLand, standingTrees, tasksFor, totalWare, tuning,
  type Building, type Job, type SimEvent, type Site, type Villager, type WareId, type World,
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
const GLYPH = { conifer: '▲', broadleaf: '♣', marked: '◆', stump: ',', home: '⌂', hut: 'H', person: '@', log: '=', stone: 'o' };

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

export function label(site: Site): string {
  return `${site.variant === 0 ? 'fir' : 'oak'} #${site.id}`;
}

/** A building's short name: "hut", "sawmill". */
export function shortKind(building: Building | undefined): string {
  return building ? building.kind.replace('lumberjack-hut', 'hut') : 'store';
}

/** What a ware is called when it is one thing you can pick up. */
export function wareName(ware: WareId, amount = 1): string {
  return amount === 1 ? `a ${ware}` : `${amount} ${ware}s`;
}

/** What a job is for, in words: a numbered tree, or a ware on the ground. */
export function jobTarget(world: World, job: Job): string {
  if (job.kind === 'task') return job.siteId === null ? `${job.task} at the bench` : `#${job.siteId}`;
  if (job.kind === 'supply') {
    const to = findBuilding(world, job.to);
    return `${wareName(job.ware)} for the ${to ? to.kind.replace('lumberjack-', '') : 'store'}`;
  }
  const pile = findPile(world, job.pileId);
  if (pile) return wareName(pile.ware, pile.amount);
  // Already in somebody's arms: the pile is gone but the errand is not finished.
  const carrier = findVillager(world, job.assignee);
  return carrier?.carrying ? `${wareName(carrier.carrying.ware, carrier.carrying.amount)} in hand` : 'a lost ware';
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
  for (const site of world.sites) {
    if (site.amount <= 0) { put(site.x, site.z, paint.bark(GLYPH.stump)); continue; }
    if (jobForSite(world, site.id)) { put(site.x, site.z, paint.amber(GLYPH.marked)); continue; }
    put(site.x, site.z, paint.leaf(site.variant === 0 ? GLYPH.conifer : GLYPH.broadleaf));
  }
  for (const pile of world.piles) put(pile.x, pile.z, paint.bark(pile.ware === 'log' ? GLYPH.log : GLYPH.stone));
  put(world.stockpile.x, world.stockpile.z, paint.sand(GLYPH.home));
  for (const building of world.buildings) put(building.x, building.z, paint.bark(GLYPH.hut));
  for (const villager of world.villagers) put(villager.x, villager.z, paint.person(GLYPH.person));
  return cells.map(line => line.join('')).join('\n');
}

export function renderLegend(paint: Palette): string {
  return paint.dim(`${GLYPH.conifer} ${GLYPH.broadleaf} tree   ${GLYPH.marked} marked   ${GLYPH.stump} stump   ${GLYPH.log} ${GLYPH.stone} ware on the ground   ${GLYPH.home} clearing   ${GLYPH.hut} hut   ${GLYPH.person} villager`);
}

export function describeVillager(world: World, villager: Villager): string {
  const activity = villager.activity;
  if (activity.kind === 'work') {
    const site = findSite(world, activity.siteId);
    const done = activity.progress / activity.duration;
    const what = site ? `${activity.task === 'fell' ? 'chopping' : activity.task} ${label(site)}` : `${activity.task === 'saw' ? 'sawing' : activity.task} at the bench`;
    return `${what}  ${bar(done)} ${Math.round(done * 100)}%`;
  }
  if (activity.kind === 'travel') {
    const away = distance(villager, activity.to).toFixed(1);
    if (activity.purpose === 'clock-on') return `walking to the hut to start the day, ${away} away`;
    if (activity.purpose === 'deliver') return `carrying ${villager.carrying ? wareName(villager.carrying.ware, villager.carrying.amount) : 'something'} ${villager.workplace === null ? 'home' : 'to the hut'}, ${away} away`;
    if (activity.purpose === 'roam') return 'having a wander';
    const job = world.jobs.find(j => j.id === villager.jobId);
    if (activity.purpose === 'fetch') return `going to fetch ${job ? jobTarget(world, job) : 'a ware'}, ${away} away`;
    const site = job?.kind === 'task' ? findSite(world, job.siteId) : undefined;
    return `walking to ${site ? label(site) : 'work'}, ${away} away`;
  }
  const hut = villager.workplace === null ? undefined : findBuilding(world, villager.workplace);
  if (hut && villager.tool === null) return 'off the clock';
  if (hut && !hasRoom(hut)) return 'waiting; the hut is full';
  return villager.restUntil > world.tick ? 'taking a breather' : 'taking it all in';
}

/** One building: who works there, what is in the store, what is left to cut. */
export function renderBuilding(world: World, building: Building, paint: Palette): string {
  const worker = findVillager(world, building.workerId);
  const held = heldIn(building);
  const store = held === building.capacity ? paint.warn(`${held}/${building.capacity} full`) : `${held}/${building.capacity}`;
  const contents = Object.entries(building.stock).filter(([, count]) => count > 0).map(([ware, count]) => `${count} ${ware}${count === 1 ? '' : 's'}`).join(', ');
  const note = building.waiting ? paint.warn(`waiting for ${building.waiting}`)
    : building.radius > 0 ? paint.dim(`${standingTrees(world).filter(site => distance(site, building) <= building.radius).length} trees in range`)
    : paint.dim(tasksFor(building).map(task => {
      const takes = (task.takes ?? []).map(ingredient => ingredient.ware).join(' + ');
      const makes = (task.yields ?? []).map(yielded => yielded.ware).join(' + ');
      return takes && makes ? `${takes} \u2192 ${makes}` : task.id;
    }).join(', '));
  return `${paint.bark(shortKind(building).padEnd(7))} ${paint.dim(`#${building.id}`)} ${(worker ? worker.name : paint.dim('nobody')).padEnd(8)} store ${store}${contents ? paint.dim(`  (${contents})`) : ''}  ${note}`;
}

export function renderBuildings(world: World, paint: Palette): string {
  if (!world.buildings.length) return paint.dim('  no buildings yet');
  return world.buildings.map(building => `  ${renderBuilding(world, building, paint)}`).join('\n');
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
    `${paint.bold('Little Island')}  day ${world.day} ${clock(world)}   logs ${paint.bold(String(totalWare(world, 'log')))}   felled ${world.stats.treesFelled}   standing ${liveSites(world, 'tree').length}${world.piles.length ? `   ${paint.bark(`${world.piles.length} on the ground`)}` : ''}`,
  ];
  for (const villager of world.villagers) {
    const role = villager.role === 'hand' ? '' : paint.dim(`${villager.role} `);
    const tool = villager.tool ? paint.dim(`[${villager.tool}] `) : '';
    lines.push(`  ${paint.person(villager.name.padEnd(7))} ${role}${tool}${describeVillager(world, villager)}`);
  }
  for (const building of world.buildings) lines.push(`  ${renderBuilding(world, building, paint)}`);
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
  const standing = liveSites(world, 'tree')
    .map(site => ({ site, away: distance(site, HOME) }))
    .sort((a, b) => a.away - b.away)
    .slice(0, limit);
  if (!standing.length) return paint.dim('  not a tree left standing.');
  return standing.map(({ site, away }) => {
    const marked = jobForSite(world, site.id) ? paint.amber('  marked') : '';
    return `  ${label(site).padEnd(8)} ${away.toFixed(1).padStart(5)} away  ${compass(HOME, site).padEnd(2)}${marked}`;
  }).join('\n');
}

export function renderRules(rules: readonly { id: string; phase: string; about: string }[], paint: Palette): string {
  return rules.map(rule => `  ${paint.dim(rule.phase.padEnd(8))}${rule.id.padEnd(21)}${paint.dim(rule.about)}`).join('\n');
}

const REJECTION = {
  'unknown-site': 'there is nothing there',
  'already-spent': 'that one is already done',
  'already-ordered': 'already on the list',
  'queue-full': 'that is plenty of work for now',
} as const;

function sentence(world: World, event: SimEvent): string | null {
  const who = (id: number) => findVillager(world, id)?.name ?? 'someone';
  switch (event.kind) {
    case 'order-queued': return `#${event.siteId} goes on the work list`;
    case 'order-rejected': return `#${event.siteId} — ${REJECTION[event.reason]}`;
    case 'order-cancelled': return `#${event.siteId} called off`;
    case 'job-assigned': {
      if (event.job === 'task') return event.targetId < 0 ? `${who(event.villagerId)} sets to work` : `${who(event.villagerId)} sets off for #${event.targetId}`;
      if (event.job === 'supply') return `${who(event.villagerId)} goes to the ${shortKind(findBuilding(world, event.targetId))} to fetch it`;
      // By the time this is read the ware is often already picked up, hence "it".
      const pile = findPile(world, event.targetId);
      return `${who(event.villagerId)} goes to fetch ${pile ? wareName(pile.ware, pile.amount) : 'it'}`;
    }
    case 'job-abandoned': return `${event.villagerId === null ? 'nobody' : who(event.villagerId)} gives up on ${event.job === 'task' ? `#${event.targetId}` : 'a ware'}`;
    case 'site-spent': return `#${event.siteId} comes down`;
    case 'ware-dropped': return `${wareName(event.ware)} is left lying where it fell`;
    case 'ware-collected': return `${who(event.villagerId)} picks up ${wareName(event.ware, event.amount)}`;
    case 'ware-delivered': return `${wareName(event.ware, event.amount)} ${event.amount === 1 ? 'reaches' : 'reach'} the clearing — ${event.ware} ${event.total}`;
    case 'shift-started': return `${who(event.villagerId)} takes the ${event.tool} from the ${shortKind(findBuilding(world, event.buildingId))}`;
    case 'ware-stored': {
      const hut = findBuilding(world, event.buildingId);
      return `${wareName(event.ware, event.amount)} goes into the ${shortKind(hut)} \u2014 ${event.stored} of ${hut?.capacity ?? event.capacity}`;
    }
    case 'store-full': return `the ${shortKind(findBuilding(world, event.buildingId))} is full; there is nowhere to put the next one`;
    case 'day-begins': return `\u2014 day ${event.day} \u2014`;
    case 'ware-taken': {
      const from = findBuilding(world, event.buildingId);
      return `${who(event.villagerId)} takes ${wareName(event.ware, event.amount)} from the ${shortKind(from)}`;
    }
    case 'ware-made': {
      const shop = findBuilding(world, event.buildingId);
      return `the ${shortKind(shop)} turns out ${wareName(event.ware, event.amount)} \u2014 ${event.stored} in store`;
    }
    case 'supply-asked': return `the ${shortKind(findBuilding(world, event.to))} asks the ${shortKind(findBuilding(world, event.from))} for ${wareName(event.ware)}`;
    case 'waiting-for': {
      const shop = findBuilding(world, event.buildingId);
      return `the ${shortKind(shop)} is waiting for ${wareName(event.ware)}`;
    }
    case 'ware-used': return null; // Implied by what the building turns out.
    case 'work-stroke': return null; // Counted, not narrated one stroke at a time.
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
    if (event.kind === 'work-stroke') {
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
