# Reading Widelands

Widelands is the closest thing we have to a reference implementation of the game
we are circling: a Settlers II descendant where the economy *is* the game, still
maintained, and open source. Unlike Outlanders 2 or Timberborn, we can read how
it actually decided things instead of inferring from play.

## The line

Widelands' source is GPL-2.0-or-later and its data files and artwork carry
various Creative Commons licences. Game mechanics and system designs are not
copyrightable; the code, the Lua data files, the art, the music, the tribe
fiction and the ware names are. So: read the documentation and the wiki freely,
read source to understand a mechanism, and then write our own. Nothing is pasted,
translated line by line, or renamed. Our island stays all-original procedural
geometry, and nothing in `src/` derives from a GPL file. If we ever want more than
inspiration — their tribe balance data, say — that is a licensing conversation
first, not a copy.

Little Island has no LICENSE file yet. Worth choosing one before this gets
interesting, precisely so the boundary above is legible to anyone reading.

## What Widelands actually does

Six mechanisms, roughly in order of how much they would change our engine.

**1. Wares and workers are objects, not numbers.** A log is a thing sitting at a
flag or in a warehouse or on someone's shoulder. Stock is a consequence of where
things are, not a counter that production edits. That is the difference between a
spreadsheet and a settlement you can watch.

**2. Buildings are programs.** A production site runs a small script of steps —
`sleep`, `consume`, `animate`, `playsound`, `produce`, `return` — declared as
data, not code. `consume` supports alternatives (this ware *or* that one), and
`return=completed|failed|skipped` feeds the building's productivity percentage.
A building that cannot get its inputs fails its program and says so, visibly, in
the interface. The building has no bespoke logic; the interpreter is shared.

**3. Input queues with capacity and priority.** Each building holds a small
buffer of each input ware. The player can shrink a building's allowed local
storage and raise or lower its priority for a ware, which is how competition
between several consumers of the same ware is resolved without micromanagement.

**4. Transport is work, not teleportation.** Flags, roads, and carriers who walk
them. Every ware's journey is simulated. This is where most of Widelands' texture
comes from — and most of its interface burden.

**5. Economy = the connected network.** Buildings post a Request for a ware; a
ware that exists posts a Supply; the Economy matches them and starts a Transfer
that attaches to the ware instance and moves it. Split a road network in two and
you have two economies that must be balanced separately.

**6. Target quantities.** Per economy, the player sets how much of a ware should
be kept in stock; a producer keeps working while the economy is below target and
idles above it. This is the closed loop that stops a settlement from drowning in
bread — economy-wide intent expressed as a number, not per-building orders.

## The mapping onto our rule engine

The pleasant surprise: the shape already lines up. Our `plan` phase is their
Economy, and our `Job` is their Request plus Transfer.

| Widelands | Little Island today | Distance |
| --- | --- | --- |
| Ware instance | nothing; `stockpile.stock.timber` is a count | The real work. Wares need identity and a location. |
| Warehouse | `stockpile` (one, at HOME) | Make it a list and it becomes interesting immediately. |
| Request / Supply / Transfer | `Job` with an owner, `assign-jobs` | Already the same idea, one job kind deep. |
| Economy matching | the `plan` phase | Same slot in the tick. Priorities would go here. |
| Production program | nothing; `chop` is a hardcoded rule | One interpreter rule plus data replaces every future "the sawmill rule". |
| Productivity % | `stats` counters | Cheap: count completed vs failed program runs. |
| Carrier on a road | villager walking a straight line | We have the walking; we lack the network. |
| Target quantity | nothing | Cheap and high value — the first real *management* verb. |

## A staged plan

Each step is a handful of rules and ends with something playable. None of them
requires rewriting what exists.

Design each one in the terminal client first (`bin/play`): wares, queues and
programs are exactly the kind of thing that is easier to read as text than to
watch a villager do, and a day of settlement runs in a second there.

**Step 1 — wares that exist.** Generalise `ResourceId` past `timber`, give
`carrying` a proper ware identity, and let a stockpile hold several kinds.
Add a second job kind (`haul`) so "fetch that thing and put it there" is a job
rather than a special case of chopping. Nothing visible changes except that the
engine stops being about one resource.

**Step 2 — buildings as programs.** A `ProductionSite` with an input queue, a
program declared as data, and one `run-program` rule in `act` that interprets
steps. The first chain is log → plank at a sawmill, and the first failure state
is "waiting for a log", shown in the interface. This is the step where Little
Island becomes a game about logistics rather than a game about one villager.

**Step 3 — transport, and how much of it.** Widelands' flags and roads are the
reason its economies feel alive and the reason new players bounce off it. The
cosy recommendation: keep the *physicality* — a villager carries one thing at a
time and the walk takes as long as it takes — but skip the road network at first.
One economy, the whole island, villagers as carriers claiming haul jobs. If
walking distance ever becomes the interesting decision, roads can arrive later as
speed multipliers on paths people already walk, which is a Timberborn-ish answer
rather than a Settlers one.

**Then — target quantities.** Once there are two producers and a shared input,
a per-ware target is the smallest possible management verb and the thing that
makes the settlement feel like it is being *run*.

## What we would not take

- **Flag-by-flag road building.** Lovely depth, wrong first impression for a game
  whose pitch is "a joy to pan around".
- **Tribes, military, training, seafaring.** Out of scope for a long time.
- **Their numbers.** Balance is content, it is licensed, and ours will want to be
  gentler anyway.
- **A ware-instance object for every log at scale.** Widelands is a desktop
  binary; we are a browser tab. Wares in transit are worth modelling as objects;
  wares at rest are probably still counts. Our headless budget (about 0.06 ms per
  tick at 120 villagers) says we have room, but not infinite room.

## Open questions

1. Do wares at rest need identity, or only wares in motion?
2. Is a building a villager's workplace (Widelands: a worker lives in the
   building) or a station villagers visit (Outlanders: people go where the work
   is)? This decides what a `Job` refers to.
3. Does the player order work (click a tree, as today) or set intent (a target
   quantity, and the settlement decides)? Widelands is firmly the second. The
   cosy answer is probably both, with orders as the tutorial and targets as the
   graduation.

## Sources

- [Widelands wiki: Description](https://www.widelands.org/wiki/Description/)
- [Productionsite Programs, Widelands documentation](https://www.widelands.org/documentation/autogen_tribes_productionsite_programs/)
- [Widelands wiki: Tips and Tricks](https://www.widelands.org/wiki/Tips%20and%20Tricks/) (economy targets, input queues, priorities)
- [widelands/widelands on GitHub](https://github.com/widelands/widelands) (GPL-2.0-or-later; assets under various Creative Commons licences)
