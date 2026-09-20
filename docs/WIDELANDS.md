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
| Ware instance | `WarePile` on the ground (hauling rulebook) | Done, terminal only. Wares at rest are still counts in the stockpile. |
| Warehouse | `stockpile` (one, at HOME) | Make it a list and it becomes interesting immediately. |
| Request / Supply / Transfer | `Job` with an owner, `assign-jobs` | Two job kinds deep now: `harvest` and `haul`. |
| Economy matching | the `plan` phase | Same slot in the tick. Priorities would go here. |
| Production program | nothing; `chop` is a hardcoded rule | One interpreter rule plus data replaces every future "the sawmill rule". |
| Productivity % | `stats` counters | Cheap: count completed vs failed program runs. |
| Carrier on a road | a `carrier` role, walking a straight line | Tried it. The network turns out to be the point — see below. |
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

## Step 1, as built

Built in the terminal only (`bin/play --rules hauling`); the browser island still
runs the `settlement` rulebook and behaves exactly as before. A felled tree now
leaves a log where it fell, a rule notices loose wares and puts fetching them on
the work list, and villagers have a `role` so a carrier can be forbidden an axe.
One rule swapped, three added.

```text
> chop 22
[00:00] #22 goes on the work list
[00:00] Robin sets off for #22
> until
[00:07] #22 comes down
[00:07] a log is left lying where it fell
[00:07] Robin goes to fetch it
[00:08] Robin picks up a log
[00:11] a log reaches the clearing — timber 1
```

### What it cost

Same island, same orders, same seed; time for the last log to reach the clearing.

| Workers | Rulebook | 4 logs | 8 logs |
| --- | --- | --- | --- |
| 1 generalist | settlement | 26s (3 logs) | — |
| 1 generalist | hauling | 27s (3 logs) | — |
| 2 generalists | settlement | 24s | — |
| 2 generalists | hauling | 25s | — |
| 1 feller + 1 carrier | hauling | 41s | — |
| 4 generalists | settlement | — | 21s |
| 4 generalists | hauling | — | 22s |
| 2 fellers + 2 carriers | hauling | — | 40s |
| 3 fellers + 1 carrier | hauling | — | 59s |

### What we learned

- **Wares as objects are nearly free.** About a second a log: the short walk back
  to the trunk, plus one tick for somebody to notice it. Worth paying, because it
  is the substrate a building needs — a sawmill's planks have to land somewhere.
- **Dedicated carriers are much worse, and that is the interesting part.** A
  generalist never walks empty: chop, pick up at your feet, walk home. A carrier
  walks out empty and back loaded, so a log costs three trips instead of two.
  Specialising also halves the felling capacity at these team sizes.
- **Which is exactly why Widelands has flags and roads.** Their carrier does not
  fetch. A ware is set down at a flag and relayed by carriers who each own one
  road segment and wait in the middle of it, so travel is shared infrastructure
  rather than a personal errand. Fetch-from-anywhere is the expensive version of
  transport, and it is what we just measured. Roads are not decoration; they are
  what makes a carrier cheaper than a generalist.
- **A generalist will always out-compete a specialist for nearby work**, because
  assignment is distance-first. The first attempt at the experiment put one
  generalist beside one carrier, and the carrier never lifted a finger — the
  feller was always the closest pair of hands to their own log.
- **Priority is the knob that changes the feel.** `JOB_PRIORITY` decides whether
  fetching beats felling. Fetching first keeps the clearing tidy. Set them equal
  and the forest fills with logs while the axe keeps swinging, which looks far
  more like The Settlers and is a legitimate thing to want.

### What this changes about the plan

Do not put roles in the game yet, and do not add carriers without the network
that makes them pay. The cosy answer stands: generalists who physically carry
things, which is what the browser island already does.

Keep the haul job kind, though. It becomes necessary rather than optional at step
2, from the other direction: a worker who is inside a building cannot fetch their
own inputs, so somebody has to. That is the same lesson Widelands learned,
arrived at by building a sawmill rather than by drawing a road.

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
