# What we test, and what we still cannot

A rule engine fails differently from ordinary code. Every rule is small and
obviously right on its own; the bugs live in the company they keep — the order
they run in, the tick they run on, two rules with different ideas about the same
villager. Of the last five real bugs, four were of that kind, and none of them
would have been caught by testing a rule by itself.

So the tests are arranged by *what could be wrong*, not by file.

## 1. Does the rule do what it says?

Ordinary unit tests, one per behaviour, written in the game's words:
`rules.test.ts`, `hauling.test.ts`, `village.test.ts`. They catch wrong
conditions and typos, they document the intended behaviour, and they are the
cheapest place to pin down a bug once it has been found somewhere else.

## 2. Is the world still coherent?

`invariants.ts` holds what must be true of *any* world under *any* rulebook,
as named checks:

| Invariant | Says |
| --- | --- |
| `ware-counts-are-whole` | no fractional or negative wares, anywhere |
| `stores-within-capacity` | no building holds more than it can |
| `jobs-and-workers-agree` | a job and its worker point at each other, and no job has two |
| `jobs-point-at-something` | a live job has a target that exists |
| `reservations-are-mutual` | a claimed tree or pile has a live job to match |
| `workers-and-buildings-agree` | a worker and their building point at each other |
| `tools-come-from-buildings` | nobody holds a tool who works nowhere |
| `everyone-is-somewhere` | finite coordinates, still on the island |
| `activities-make-sense` | you cannot chop a tree that does not exist |
| `piles-go-somewhere-real` | a ware bound for a building has one |

They run after every tick in the soak test, and on demand from the terminal with
`check`. This is the class that catches a rule forgetting to release something.

## 3. Did anything appear or vanish?

Wares are created by exactly three events — `ware-gathered`, `ware-dropped`,
`ware-made` — and destroyed by exactly one, `ware-used`. Everything else moves
them. So after every tick, a census of every ware in the world (stores, piles,
arms) must have moved by exactly what the events claim. That check found the
settlement rulebook conjuring a log into somebody's arms with no event to say so.

## 4. Is it deterministic, and does a save mean anything?

Same seed plus same orders gives the same world, compared by `hashWorld`. A save
taken mid-stride, restored, and run forward must produce the identical future.
Both are checked in `engine.test.ts` and again on a randomised session in
`soak.test.ts`, which is the version that matters: a save is only worth having if
it survives the messy states, not the tidy ones.

## 5. Does it keep working?

The failure we hit twice is not a crash: it is a settlement that runs perfectly
and gets nothing done. Two guards:

- **Throughput.** "A log reaches the hut within a minute of a worker clocking
  on." This is what a lumberjack hut felling the whole forest and carrying none
  of it fails, and it failed for one line of rule order.
- **Liveness.** Over a long run, something must happen at least every few
  seconds while there is work left to do. Silence is only correct once the stores
  are full.

## 6. Is it fast enough?

`scale.test.ts` prints milliseconds per tick and fails well before the 33ms
budget at 30Hz. Currently about 0.06ms for 120 villagers.

## 7. Does the page actually work?

`e2e/` drives the built site in a real Chromium with Playwright (`bin/e2e`, or
`npm run e2e`). Every test runs with third-party requests blocked, so the suite
never depends on a font host being up and can never silently start to.

Six checks on the island, written as a person would play:

- the island opens, the villager is alive in it and putters about on their own
- clicking a tree sends Robin to fell it, and the log reaches the clearing —
  following the whole loop through the HUD: tooltip, cursor, chopping progress
  bar, status line, timber count, toast
- orders queue up, and clicking a marked tree calls it off
- the work list survives a reload
- the camera is steady under a drag and a zoom
- **the island still opens when the font CDN is unreachable**

That last one is a regression test for a bug that shipped: the fonts were an
`@import` inside the bundled CSS, so when the CDN was blocked Vite's stylesheet
preload rejected, the dynamic import of the game never resolved, and the page
stayed blank — with every unit test passing.

Both of the guards here were checked by putting the bug back. Restoring the CSS
`@import` fails the font test; renaming the activity the renderer looks for
fails the felling test at the progress bar. A test nobody has seen fail is a
test nobody should trust.

Three more cover the goblin dressing (`e2e/goblin.spec.ts`), because a theme that
quietly failed to build its scene would still pass every unit test: that the
island boots wearing it and is the same simulation underneath, that a goblin can
still be sent at a tree and the whole loop reads in her own words, and that the
switch changes the dressing without touching the save. What the dressing is and
what each of its decisions answers is at the end of [GOBLIN_FORK.md](GOBLIN_FORK.md).

`src/theme.test.ts` covers the part of a theme that has no pixels: which
dressing a URL and a remembered choice resolve to, and that neither theme is
missing a line of copy the other has — a missing one is a blank label on screen
and nothing else would catch it.

Four more cover the stress lab, which is the only thing that reports whether a
browser can hold a settlement at all: that it opens offline, that its frame,
simulation and instancing numbers read as numbers rather than dashes, that zero
counts in the URL are taken literally, and that its saved state round trips.

It runs on every pull request, and again before the deploy to Pages, because the
built page is the whole deliverable.

## What only playing catches

Legibility. Whether "the sawmill is waiting for a log" reads as information or as
a fault. Whether the settlement jamming with a full hut and a full mill feels
like a lesson or a bug. Every session has turned up something no test would have:
markers too pale to see, a blank page when a font CDN was unreachable, axe swings
credited to the wrong villager, a hut that fells and never hauls. The loop is:
play it, notice, write the test, fix it.

## What we do not test yet

Roughly in the order it will start to hurt.

- **Balance.** Nothing asserts the economy is *interesting*. We have no intended
  rate for anything, so we cannot notice when a change makes the sawmill starve.
  The fix is a throughput baseline — planks per minute for a given staffing —
  that fails on a large move in either direction.
- **Fairness.** Assignment is distance-first, so the nearest villager takes
  everything and a specialist can stand idle all day. We have watched this
  happen twice and nothing tests it.
- **Rule-order sensitivity.** The rule list *is* the scheduler, and we know two
  orderings are load-bearing only because they broke. A test that shuffles
  rules within a phase and reports which permutations change the outcome would
  tell us where the real dependencies are.
- **Save fuzzing.** We reject hand-written bad saves; we have never fed the
  validator a mutated real one. Every field flipped, one at a time, must give
  either `null` or a world that passes `checkWorld`.
- **The browser, more widely.** The end-to-end run covers one browser at one
  desktop size. No phone viewport, no Firefox or WebKit, no visual comparison of
  what the island actually looks like, and a failure in CI leaves its trace and
  screenshots on the runner rather than uploading them. Frame rate is not
  asserted at all, because CI renders in software.
- **Long horizons.** The soak covers ten minutes of world time, about five days.
  Nothing yet watches an hour for slow leaks: job lists that never shrink, piles
  that accumulate, float drift in positions.

## Running them

```sh
npm test     # the simulation, about a second
bin/check    # tests, typecheck, build
bin/e2e      # builds the site and plays it in a real browser, about a minute
bin/play     # then `check` at any point, on whatever you have played into
```

`bin/e2e` needs the browser binary once per machine: `npx playwright install chromium`.
