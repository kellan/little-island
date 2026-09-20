/**
 * Little Island, played in a terminal.
 *
 * The same rule engine the browser runs, with text instead of Three.js. It exists
 * so the economy can be designed and argued about at the speed of typing, and so
 * the rules can be watched firing, which no amount of looking at the 3D island
 * will show you.
 *
 *   bin/play            a fresh island
 *   bin/play --seed 12  a different one
 *   echo 'chop 0; until; status' | bin/play
 */
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  HOME, RULEBOOKS, VILLAGE, addBuilding, addVillager, createSimulation, createWorld,
  census, checkWorld, deserialize, dropWare, enqueue, findBuilding, hashWorld, hire, ROLES,
  serialize, tickTimes,
  tuning, WARES, type BuildingKind, type Role, type Rulebook, type SimEvent, type WareId, type World,
} from '../sim/index.ts';
import * as view from './view.ts';

const argv = process.argv.slice(2);
const option = (name: string) => { const at = argv.indexOf(name); return at < 0 ? undefined : argv[at + 1]; };
const colour = !argv.includes('--no-color') && !process.env.NO_COLOR && !!process.stdout.isTTY;
const paint = view.palette(colour);
const say = (text = ''): void => { process.stdout.write(`${text}\n`); };
const SAVE_FILE = 'island.json';

function load(file: string): World | null {
  try {
    return deserialize(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

const asked = Number(option('--seed'));
const seed = Number.isFinite(asked) ? asked : tuning.ISLAND_SEED;
const loaded = option('--load') ? load(option('--load')!) : null;
if (option('--load') && !loaded) say(paint.warn(`could not read a world from ${option('--load')}`));
const chosen = RULEBOOKS.find(book => book.id === option('--rules')) ?? VILLAGE;
const sim = createSimulation(loaded ?? createWorld(seed), chosen);
const origin = loaded ? 'a saved island' : `seed ${seed}`;

// A building with nobody in it does nothing, so a fresh village comes with a hut,
// a sawmill, and somebody in each.
if (chosen.id === 'village' && !sim.world.buildings.length) {
  const hut = addBuilding(sim.world, 'lumberjack-hut', { x: HOME.x + 2.4, z: HOME.z - 1.5 });
  const mill = addBuilding(sim.world, 'sawmill', { x: HOME.x - 2.6, z: HOME.z + 1.2 });
  hire(sim.world, sim.world.villagers[0], hut);
  hire(sim.world, addVillager(sim.world, 'Wren', HOME), mill);
}

const seconds = (text: string | undefined, fallback: number) => {
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 600) : fallback;
};
const ticks = (count: number) => Math.max(1, Math.round(count / tuning.TICK_SECONDS));

/**
 * Off, or showing the rules as they fire. `decisions` hides the rules that apply
 * every tick to anyone moving, leaving the engine's actual choices legible.
 */
let tracing: 'off' | 'decisions' | 'all' = 'off';

/** Runs ticks. Quiet by default; narrates rule by rule while tracing. */
function run(count: number): SimEvent[] {
  const collected: SimEvent[] = [];
  for (let i = 0; i < count; i++) {
    const steps: string[] = [];
    const events = tickTimes(sim.world, 1, {
      rules: sim.rulebook.rules,
      trace: tracing === 'off' ? undefined : (step) => {
        if (tracing === 'all' || step.phase !== 'act') steps.push(view.renderTraceStep(step, paint));
      },
    });
    if (tracing === 'off') { collected.push(...events); continue; }
    if (steps.length) say(`  ${paint.dim(`tick ${sim.world.tick}`)}\n${steps.join('\n')}`);
    // One tick holds at most one swing, so narrating them here is just noise.
    const lines = view.renderEvents(sim.world, tracing === 'all' ? events : events.filter(event => event.kind !== 'work-stroke'), paint);
    if (lines.length) say(lines.map(line => `    ${line}`).join('\n'));
  }
  return collected;
}

function report(events: SimEvent[]): void {
  if (tracing !== 'off') return;
  const lines = view.renderEvents(sim.world, events, paint);
  if (lines.length) say(lines.join('\n'));
  else say(paint.dim('  nothing much happens'));
}

/** Orders land on the next tick; running one makes the terminal feel answerable. */
function settle(): void {
  report(run(1));
}

/** True while a hut has room in its store and a tree left within reach. */
function hasWork(world: World, building: { x: number; z: number; radius: number; capacity: number; stock: Record<string, number> }): boolean {
  const held = Object.values(building.stock).reduce((total, count) => total + count, 0);
  if (held >= building.capacity) return false;
  return world.sites.some(site => site.amount > 0 && Math.hypot(site.x - building.x, site.z - building.z) <= building.radius);
}

/** Work still to do: a job open, a ware in someone's arms, or one lying about. */
function outstanding(world: World): boolean {
  return world.jobs.some(job => job.state === 'queued' || job.state === 'assigned')
    || world.villagers.some(villager => villager.carrying !== null)
    || world.piles.length > 0
    || world.inbox.length > 0
    || world.villagers.some(villager => villager.workplace !== null && villager.tool === null)
    || world.buildings.some(building => building.workerId !== null && hasWork(world, building));
}

type Command = { about: string; run(args: string[]): void };

const commands: Record<string, Command> = {
  look: { about: 'draw the island', run: () => { say(); say(view.renderMap(sim.world, paint)); say(); say(view.renderLegend(paint)); } },
  status: { about: 'the time, the stock, who is doing what', run: () => say(view.renderStatus(sim.world, paint)) },
  trees: { about: 'trees [n] — the nearest standing trees and their numbers', run: (args) => say(view.renderTrees(sim.world, paint, seconds(args[0], 10))) },
  chop: {
    about: 'chop <n...> — put trees on the work list',
    run: (args) => {
      if (!args.length) return say(paint.dim('  chop which tree? try: trees'));
      for (const raw of args) {
        const id = Number(raw.replace('#', ''));
        if (!Number.isInteger(id)) { say(paint.warn(`  ${raw} is not a tree number`)); continue; }
        enqueue(sim, { kind: 'order-fell', siteId: id });
      }
      settle();
    },
  },
  cancel: {
    about: 'cancel <n|all> — call off an order',
    run: (args) => {
      if (args[0] === 'all') enqueue(sim, { kind: 'cancel-all' });
      else if (args.length) for (const raw of args) enqueue(sim, { kind: 'cancel-fell', siteId: Number(raw.replace('#', '')) });
      else return say(paint.dim('  cancel which one? a tree number, or all'));
      settle();
    },
  },
  wait: {
    about: 'wait [seconds] — let the island get on with it (default 5)',
    run: (args) => { report(run(ticks(seconds(args[0], 5)))); say(view.renderStatus(sim.world, paint)); },
  },
  until: {
    about: 'until — wait for the work list to empty',
    run: () => {
      const events: SimEvent[] = [];
      for (let i = 0; i < ticks(600) && outstanding(sim.world); i++) events.push(...run(1));
      report(events);
      say(view.renderStatus(sim.world, paint));
    },
  },
  trace: {
    about: 'trace [on|all|off|n] — watch the rules fire. on hides the walking, all shows everything',
    run: (args) => {
      const word = args[0];
      if (word === 'off') { tracing = 'off'; return say(paint.dim('  tracing off')); }
      if (word === 'all') { tracing = 'all'; return say(paint.dim('  tracing every rule')); }
      if (word === 'on' || word === undefined) {
        tracing = tracing === 'off' ? 'decisions' : 'off';
        return say(paint.dim(`  tracing ${tracing === 'off' ? 'off' : 'decisions only'}`));
      }
      const was = tracing;
      tracing = 'all';
      run(Math.min(120, Math.max(1, Math.round(Number(word) || 1))));
      tracing = was;
    },
  },
  rules: {
    about: 'the rulebook this island runs, in order',
    run: () => {
      say(`  ${paint.bold(sim.rulebook.id)}  ${paint.dim(sim.rulebook.about)}`);
      say(view.renderRules(sim.rulebook.rules, paint));
    },
  },
  rulebook: {
    about: `rulebook [${RULEBOOKS.map(book => book.id).join('|')}] — swap the rules under the same island`,
    run: (args) => {
      if (!args.length) return say(`  ${paint.bold(sim.rulebook.id)}  ${paint.dim(sim.rulebook.about)}`);
      const next: Rulebook | undefined = RULEBOOKS.find(book => book.id === args[0]);
      if (!next) return say(paint.warn(`  no rulebook called ${args[0]}`));
      sim.rulebook = next;
      say(`  now running ${paint.bold(next.id)}  ${paint.dim(next.about)}`);
      if (next.id === 'settlement' && sim.world.piles.length) say(paint.dim('  (nothing in these rules fetches a ware off the ground, so what is lying about stays lying about)'));
    },
  },
  buildings: { about: 'who works where, what is in each store, what anything is waiting for', run: () => say(view.renderBuildings(sim.world, paint)) },
  hire: {
    about: 'hire <name> [building] — put somebody to work at a building',
    run: (args) => {
      const villager = sim.world.villagers.find(person => person.name.toLowerCase() === (args[0] ?? '').toLowerCase());
      if (!villager) return say(paint.warn(`  nobody here is called ${args[0] ?? 'that'}`));
      const building = findBuilding(sim.world, Number(args[1] ?? sim.world.buildings[0]?.id ?? NaN));
      if (!building) return say(paint.warn('  there is no such building'));
      hire(sim.world, villager, building);
      villager.tool = null;
      say(`  ${villager.name} now works at ${building.kind} #${building.id}`);
    },
  },
  build: {
    about: `build [${Object.keys(tuning.BUILDINGS).join('|')}] — put one up where the first villager stands`,
    run: (args) => {
      const kind = (Object.keys(tuning.BUILDINGS).includes(args[0]) ? args[0] : 'lumberjack-hut') as BuildingKind;
      const at = sim.world.villagers[0] ?? HOME;
      const building = addBuilding(sim.world, kind, at);
      say(`  ${building.kind} #${building.id} goes up at ${building.x.toFixed(1)}, ${building.z.toFixed(1)} — nobody works there yet`);
    },
  },
  wares: { about: 'what is in the stockpile, and what is still lying about', run: () => say(view.renderWares(sim.world, paint)) },
  drop: {
    about: `drop [${WARES.join('|')}] [n] — leave a ware at the villager's feet, to see who fetches it`,
    run: (args) => {
      const ware = (WARES.includes(args[0] as WareId) ? args[0] : 'stone') as WareId;
      const amount = Math.min(20, Math.max(1, Math.round(Number(args[1]) || 1)));
      const at = sim.world.villagers[0] ?? HOME;
      const pile = dropWare(sim.world, ware, at, amount);
      say(`  ${view.wareName(pile.ware, pile.amount)} left at ${pile.x.toFixed(1)}, ${pile.z.toFixed(1)}`);
    },
  },
  role: {
    about: `role <name> [${ROLES.join('|')}] — retrain somebody, to see what specialising costs`,
    run: (args) => {
      const villager = sim.world.villagers.find(person => person.name.toLowerCase() === (args[0] ?? '').toLowerCase());
      if (!villager) return say(paint.warn(`  nobody here is called ${args[0] ?? 'that'}`));
      if (!ROLES.includes(args[1] as Role)) return say(`  ${villager.name} is a ${villager.role}`);
      villager.role = args[1] as Role;
      say(`  ${villager.name} is now a ${villager.role}`);
    },
  },
  spawn: {
    about: `spawn [name] [${ROLES.join('|')}] — another pair of hands; a feller never carries, a carrier never chops`,
    run: (args) => {
      const role = (ROLES.includes(args[1] as Role) ? args[1] : 'hand') as Role;
      const villager = addVillager(sim.world, args[0] ?? `Villager ${sim.world.nextVillagerId}`, HOME, role);
      say(`  ${villager.name} arrives at the clearing${role === 'hand' ? '' : ` as a ${role}`}`);
    },
  },
  save: {
    about: `save [file] — write the world (default ${SAVE_FILE})`,
    run: (args) => {
      const file = args[0] ?? SAVE_FILE, text = serialize(sim.world);
      try {
        writeFileSync(file, text);
        say(`  saved ${file} — ${(text.length / 1024).toFixed(1)} kB, hash ${hashWorld(sim.world)}`);
      } catch (error) {
        say(paint.warn(`  could not write ${file}: ${(error as Error).message}`));
      }
    },
  },
  load: {
    about: `load [file] — read a world back (default ${SAVE_FILE})`,
    run: (args) => {
      const file = args[0] ?? SAVE_FILE, world = load(file);
      if (!world) return say(paint.warn(`  ${file} is not a world this engine can run`));
      sim.world = world;
      sim.accumulator = 0;
      say(`  loaded ${file} — hash ${hashWorld(world)}`);
      say(view.renderStatus(sim.world, paint));
    },
  },
  check: {
    about: 'run the invariants against the world as it stands',
    run: () => {
      const broken = checkWorld(sim.world);
      if (!broken.length) return say(`  ${paint.dim('all sound')}  ${Object.entries(census(sim.world)).filter(([, n]) => n > 0).map(([ware, n]) => `${n} ${ware}${n === 1 ? '' : 's'}`).join(', ') || 'nothing made yet'}`);
      for (const violation of broken) say(paint.warn(`  ${violation.invariant}: ${violation.detail}`));
    },
  },
  hash: { about: 'fingerprint the world, for comparing two runs', run: () => say(`  ${hashWorld(sim.world)}  tick ${sim.world.tick}`) },
  help: {
    about: 'this list',
    run: () => {
      for (const [name, command] of Object.entries(commands)) say(`  ${paint.bold(name.padEnd(8))}${command.about}`);
      say(paint.dim('  several at once: chop 3; wait 20; status'));
    },
  },
  quit: { about: 'leave the island as you found it', run: () => process.exit(0) },
};
const aliases: Record<string, string> = { l: 'look', s: 'status', w: 'wait', order: 'chop', fell: 'chop', huts: 'buildings', b: 'buildings', '?': 'help', exit: 'quit', q: 'quit', run: 'until' };

function perform(line: string): void {
  const [word, ...args] = line.trim().split(/\s+/);
  if (!word) return;
  const command = commands[aliases[word] ?? word];
  if (!command) return say(paint.dim(`  "${word}"? try help`));
  command.run(args);
}

say();
say(`${paint.bold('Little Island')} ${paint.dim(`— a settlement you type at. seed ${origin}, ${sim.world.sites.length} trees.`)}`);
say(paint.dim(`help for commands. trees, then chop 0, then until.`));
say(paint.dim(`rules: ${sim.rulebook.id} \u2014 ${sim.rulebook.about}`));
say();
say(view.renderMap(sim.world, paint));
say();
say(view.renderStatus(sim.world, paint));

// A terminal gets a live prompt; a pipe gets its commands echoed, so transcripts read back.
const interactive = !!process.stdin.isTTY;
const rl = createInterface({ input: process.stdin, output: interactive ? process.stdout : undefined, terminal: interactive, prompt: '> ' });
if (interactive) rl.prompt();
rl.on('line', (line) => {
  if (!interactive) say(`${paint.dim('>')} ${line.trim()}`);
  for (const part of line.split(';')) perform(part);
  if (interactive) rl.prompt();
});
rl.on('close', () => { say(); say(paint.dim('the island keeps turning without you.')); });
