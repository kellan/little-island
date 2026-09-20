# The rule engine

The simulation is a separate program that happens to share a tab with a renderer.
It has no imports from Three.js or the DOM, it runs headless in tests at hundreds
of times real speed, and it would run unchanged in a worker or on a server.

```text
src/sim/
  types.ts      plain JSON state: trees, villagers, jobs, stockpile, inbox
  tuning.ts     every number a designer would want to nudge
  terrain.ts    ground height and distance, shared with the renderer
  rng.ts        the world's only randomness, stored in the state
  world.ts      construction, queries, and a state hash
  rules.ts      the rulebook
  engine.ts     the clock: commands in, ticks run, events out
  serialize.ts  the persistence boundary
```

## A rule

A rule is three small parts. What it looks at, whether it applies, and what it
changes. Nothing else: rules never call each other, never reach for a renderer,
and never invent their own clock.

```ts
const fellTree = defineRule<Villager>({
  id: 'fell-tree',
  phase: 'resolve',
  about: 'Drops the tree when the chop completes and puts a log in the villager’s arms.',
  subjects: (world) => world.villagers.filter(v => v.activity.kind === 'harvest'),
  when: (_world, villager) => villager.activity.progress >= villager.activity.duration,
  then: (world, villager, ctx) => { /* ...change the world, emit an event... */ },
});
```

Behaviour is added by writing a rule and putting it in the `RULES` list. Nothing
in the rest of the codebase needs to know it exists.

## The tick

Every tick is the same five phases in the same order, and inside a phase the
rules run in the order they are listed. That ordering is the whole scheduler.

| Phase | Rule | Book | What it does |
| --- | --- | --- | --- |
| intake | `accept-commands` | both | Applies the orders the player queued since the last tick, one at a time, in order. |
| plan | `drop-impossible-jobs` | both | Cancels any job whose tree or ware has gone, freeing whoever was sent for it. |
| plan | `list-loose-wares` | hauling | Notices a ware lying on the ground and adds fetching it to the work list. |
| plan | `assign-jobs` | both | Hands the most pressing queued job to the nearest free villager whose role takes that work. |
| act | `walk` | both | Moves a travelling villager toward their destination and turns them to face it. |
| act | `chop` | both | Advances a chop and emits one swing event per axe stroke, so sound and dust follow the work. |
| resolve | `arrive-at-tree` | both | Turns a walk into work once the villager is within arm's reach of their tree. |
| resolve | `fell-tree` | settlement | Drops the tree when the chop completes and puts a log in the villager's arms. |
| resolve | `fell-tree-to-ground` | hauling | Drops the tree when the chop completes and leaves a log lying where it fell. |
| resolve | `collect-ware` | hauling | Picks a ware up off the ground and sets off for the stockpile with it. |
| resolve | `store-delivery` | both | Adds a carried ware to the stockpile the moment the villager reaches the clearing. |
| resolve | `finish-roaming` | both | Ends a wander at its destination and buys the villager a moment of rest. |
| upkeep | `wander-when-idle` | both | Sends a rested villager with nothing left to do on a short stroll near the clearing. |
| upkeep | `forget-finished-jobs` | both | Prunes done and cancelled jobs a second after they end, keeping saved state small. |

## Two rulebooks

A rulebook is an ordered list of rules and nothing else, so an experiment is a
second list rather than a second codebase.

- **`SETTLEMENT`** is what the browser island runs. One villager sees a job
  through: walk, chop, carry the log home.
- **`HAULING`** is the economy experiment, reachable only from the terminal
  (`bin/play --rules hauling`). A felled tree leaves a log on the ground; noticing
  it and fetching it are separate work, which is how a building's output will
  reach a stockpile later.

They differ by one rule swapped and three added. `bin/play` can switch between
them mid-session with `rulebook <id>`, which is the clearest demonstration that
rules are data: the island does not change, only what happens on it.

That is the entire game so far: fourteen rules across two rulebooks, two wares, two kinds of job.

## Watching it think

Rules report what they touched, so the terminal client (`bin/play`) can narrate a
tick. This is the clearest view of the engine there is, and the browser cannot
show it:

```text
> chop 22
  tick 1
    intake  accept-commands      ×1
    plan    assign-jobs          ×1
    [00:00] #22 goes on the work list
    [00:00] Robin sets off for #22
> until
  tick 54
    resolve arrive-at-tree       ×1
  tick 217
    resolve fell-tree            ×1
    [00:07] #22 comes down
  tick 276
    resolve store-delivery       ×1
    [00:09] a log reaches the clearing — timber 1
```

Tracing is an optional callback on the tick context. Passing nothing costs nothing.

## Commands in, events out

The host never writes to the world. It queues commands, which are applied at the
next tick boundary by a rule like anything else, and it reads the events that
come back.

```ts
const sim = createSimulation();
enqueue(sim, { kind: 'order-harvest', treeId: 12 });
for (const event of advance(sim, deltaSeconds)) {
  if (event.kind === 'chop-swing') playAxeSound();
}
```

| Commands | Events |
| --- | --- |
| `order-harvest` · `cancel-harvest` · `cancel-all` | `order-queued` · `order-rejected` · `order-cancelled` · `job-assigned` · `job-abandoned` · `chop-swing` · `tree-felled` · `ware-dropped` · `ware-collected` · `ware-delivered` |

Every rejection carries a reason, so the interface can explain itself without
re-deriving the rules: `unknown-tree`, `already-felled`, `already-ordered`,
`queue-full`.

Events are the reason the host does not diff state. A delivery sound plays
because a delivery happened, not because a number went up between two frames.

## Time

The world moves in whole ticks of 1/30s. `advance(sim, seconds)` banks real time
and runs as many whole ticks as it has paid for, so a 30fps machine and a 144fps
machine reach the same world. Long gaps — a backgrounded tab, a breakpoint — are
clamped rather than simulated in one lurch, so the island quietly waits for you.

Villagers keep their previous position, and the renderer interpolates between
ticks with `alpha(sim)`. A 30 Hz world moves smoothly on a 60 Hz screen.

## Determinism

The world owns its random number generator; the seed lives in the state and every
draw advances it. Same seed plus same commands gives the same world, byte for
byte. `hashWorld` produces a short fingerprint used by the tests to compare a live
world against one that has been saved, reloaded, and stepped forward.

## Saving

`serialize` is `JSON.stringify`, because the state is already plain data.
`deserialize` is the careful half: it checks the version, every number, every
enum, and then referential integrity — a job pointing at a tree that does not
exist, or a villager holding a job id that was pruned, is rejected. Anything
suspect returns `null` and the player gets a fresh island instead of a crash.
Queued orders are part of the saved state, so a save never loses a click.

## How much does it hold?

`npm test` prints the number, and `bin/play` will run a day of settlement in a
second if you ask it to. On this machine 120 villagers felling 240 trees in
a 300-tree forest costs about **0.06 ms per tick**, against a 33 ms budget at
30 Hz. The naive parts — linear scans for trees and villagers, re-sorting
candidates during assignment — are nowhere near mattering yet. Indexes can wait
until the profile asks for them.

## Notes for later

Things that came up while building this and were deliberately left out:

- **Needs and moods.** A villager has no hunger, warmth or sleep. The `upkeep`
  phase is where those rules would go, and `restUntil` is the shape they would take.
- **Buildings and production chains.** `Job` already has a `kind` field with one
  value. A sawmill is a second job kind plus a recipe, not a new architecture.
- **Several stockpiles, and hauling between them.** `stockpile` is a single
  record today. Making it a list is the moment a real logistics game starts.
- **Pathfinding.** Villagers walk in straight lines because the island is convex
  and empty. Obstacles, roads, or water crossings mean a path in the `plan` phase
  and a follow rule in `act`; nothing else would move.
- **Tree regrowth and seasons.** There is no world clock beyond `tick`.
- **Rule conflicts.** At this size, order is enough. If two rules ever want
  the same villager in the same tick, that is the moment to add priorities or a
  proper agenda rather than hope.
