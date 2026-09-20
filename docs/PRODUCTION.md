# Production, structurally

A reply to [RESOURCES.md](RESOURCES.md), which was written against `main` and so
describes an older engine. On this branch three of its four "notes for the rules
engine" are already true: wares are a record keyed by ware id, recipes are data,
and goods move physically as piles that somebody carries. The tick is 1/30, not
1/60, and the save format is at version 5. The note that is *not* yet true is the
important one:

> Recipes, building costs, and upkeep should be **data**, not code branches.

The sawmill is data. The lumberjack hut is not — what it does lives in a rule
called `hut-picks-a-tree`. Everything below is about closing that gap in a way
that also admits foraging, fishing, quarrying, multi-input smelting and farms
without a new rule for each.

## The shapes, and how many mechanisms they need

The brief describes four kinds of building: one that takes from the world
(forager, lumberjack, fisher), one that converts a ware into another (sawpit),
one that consumes several wares to make one (bloomery), and a farm. They look
like four mechanisms. They are one mechanism varying along two axes:

- **Where the input comes from** — the building's own store, or a place in the world.
- **What the work leaves behind** — a ware, a changed place, or both.

Everything in the brief is a point in that space. So the engine needs one idea,
not four.

## The idea: a task

```ts
type Task = {
  id: string;                 // 'fell', 'forage', 'saw', 'sow', 'reap'
  site?: SiteQuery;           // a place in the world, within the building's radius
  takes?: Ingredient[];       // wares from the building's own store
  seconds: number;            // or a function of the site, as a tree's size is today
  effect?: SiteEffect;        // what the work does to the place
  yields?: Yield[];           // wares, landing in the store or on the ground
};
```

A building type is a name, a footprint, a construction cost, a daily upkeep
draw, a tool, a radius, and an ordered list of tasks. The building performs the
first task whose preconditions hold. That is the whole model.

### Every building in the brief, as data

| Building | site | takes | effect | yields |
| --- | --- | --- | --- | --- |
| lumberjack hut | tree, standing | — | fell it | log, on the ground |
| forager's hut | patch, amount > 0 | — | amount − 1 | forage, to store |
| fishing pier | shoal, amount > 0 | — | amount − 1 | fish |
| quarry | outcrop, amount > 0 | — | amount − 1 | stone |
| hunting lodge | game, amount > 0 | 1 snare | amount − 1 | game, hide |
| sawpit | — | 1 log | — | 1 plank |
| wood chopper | — | 1 log | — | 4 firewood |
| bakery | — | 1 flour, 1 firewood | — | 2 bread |
| bloomery | — | 1 bog iron, 2 charcoal | — | 1 bloom |
| farm · till | plot, fallow | — | → tilled | — |
| farm · sow | plot, tilled | 1 grain | → sown, ripens at T | — |
| farm · reap | plot, ripe | — | → stubble, fertility − | 4 grain |

Twelve buildings, one table, no new rules. That is the test the design has to
pass, and the reason to do the refactor before adding the third building type
rather than after the tenth.

## Trees become sites

The change that makes the gatherers free: generalise `Tree` into a **site** — a
thing in the world with a place, an amount, and a state. A tree is a site of kind
`tree` with amount 1 and no regrowth. So are forage patches, shoals, outcrops,
game, and farm plots.

Then four things the brief asks for stop being features and become properties:

- **Depletion** is `amount` going down. Stone never regrows because its regrowth
  is zero; nothing special-cases it.
- **Regrowth** is one rule in the `upkeep` phase. Forage comes back slowly; a
  fish pool recovers faster when it is fuller, which is one line and gives
  overfishing that is possible *and* recoverable.
- **"Clear-cut the woods and the deer leave"** is a rule that sets a game site's
  amount from the forest cover around it. Same shape as regrowth.
- **Foraging degrading into walking time** needs nothing at all. Sites nearest
  the hut are taken first because the task picks the nearest; as they empty, the
  forager ranges further. The cost is distance, which the simulation already
  models, and there is never a "you may not" message.

## What this does to the rulebook

The village rulebook has 24 rules. The refactor removes three and generalises
four:

| Now | After |
| --- | --- |
| `hut-picks-a-tree` + `start-crafting` | `pick-a-task` |
| `chop` + `craft` | `work` |
| `fell-tree-to-ground` + `finish-crafting` | `finish-work` |
| `arrive-at-tree` | `arrive-at-site` |
| `note-shortage` | reports *which* precondition failed |

21 rules, and the number stops growing with the number of buildings. The hauling,
job-assignment, clock-on and day machinery is untouched: a task that yields a log
on the ground is already served by `list-loose-wares` and `collect-ware`.

`note-shortage` is worth calling out. Today it says "waiting for a log". Once
preconditions are data it can say which one failed — *no tree in range*, *short
of charcoal*, *store full* — which is the difference between a building that is
idle and a building that is stuck, and it is the only diagnosis a player gets.

## Multiple inputs, and where the input queue comes from

`takes` is a list, so a bloomery is one row of data rather than a new concept.
The only real decision is where `wants` — the building's input queue depth —
comes from. It should be **derived from the tasks**, not authored: the wares a
building keeps on hand are exactly the wares its tasks take. Widelands does the
same, and it removes a whole class of "the recipe changed and the queue didn't"
bug. `fetch-inputs` then needs no change beyond "the first want that is unmet".

## Upkeep is an input with a different cadence

Firewood does not need new machinery. `upkeep: [{ ware: 'firewood', amount: 1 }]`
drawn from the building's own store at the day roll, which `fetch-inputs` already
keeps stocked. If it cannot pay, the building **browns out**: its tasks do not
start and it says why. That is the brief's "settlement that overbuilds slowly
browns out" for about fifteen lines, and it is what earns the demolish verb.

## Farms

I would build **(b), field with fertility**, and I think it is cheaper here than
the brief assumes, because plots are sites and till/sow/reap are tasks. Nothing
in the list above is farm-specific machinery:

- The farm creates plot sites over walkable ground in its footprint when it is
  raised. That is the "makes an area plantable" behaviour from Timberborn and
  Outlanders.
- Growth is `ripensAt` on the plot — a tick stamp set when it is sown.
- Fertility is a number on the plot that `reap` draws down and fallow restores,
  which is what makes the land a place rather than a building.
- The periodic lump falls out for nothing: a field sown together ripens together,
  so a dozen `reap` tasks appear at once, the hauling backs up, and the granary
  question asks itself.

**On the seasonal clock: build so it can be added, do not add it.** Per-plot
`ripensAt` needs no global calendar. Adding seasons later is a multiplier on
growth and a precondition on `sow` — tuning data and one line, not a rewrite.
That is the safest path the brief asks for, and it means the open question does
not have to be answered before this work starts.

## Two questions I can't answer

1. **Does a building hold one worker or several?** Everything above assumes one,
   as now. A farm is the first building where that is obviously wrong: sowing a
   field with one person is a season's work. Several workers per building is a
   change to job assignment, not to the task model — but it is a change, and the
   farm is where it becomes necessary.
2. **Does the first slice include eating?** The brief's first slice pairs the
   production structure with villagers eating daily and meal variety in the UI.
   Eating is a *demand* system — villagers with needs pulling from stores — which
   is a different axis from production and adds its own rules. I would land the
   task model first and eating second, so that when the food loop misbehaves it
   is clear which half is wrong.

## The order I would build it

1. ~~**Sites and tasks.**~~ **Done.** `Tree` is now a site, the work rules
   collapsed into `pick-a-task` / `work` / `finish-work`, and the lumberjack and
   the sawmill are rows in a task table. The village rulebook went from 24 rules
   to 21 while gaining the ability to hold any number of building types.
2. **A forager's hut**, with a patch that depletes and regrows. The proof: a third
   building type that costs zero new rules, and the first resource you can run out
   of locally.
3. **Multiple `takes`, derived `wants`.** A bloomery-shaped recipe, in tests only.
4. **Upkeep and brown-out**, with firewood gathered free from the forest floor.
5. **Farms (b)**, which is where multiple workers per building has to be settled.

Eating, meal variety and spoilage are a separate strand that should start after 1
and can run alongside 3 onwards.
