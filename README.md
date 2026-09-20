# Little Island

A small, tactile browser settlement prototype: orbit a handmade procedural island, mark a tree, and watch Robin walk, chop, carry a log, and deliver it to the clearing. Mark several and they become a list of work.

Underneath is a rule engine that knows nothing about the screen: plain JSON state, commands in, events out, a rulebook a tick. See [docs/RULE_ENGINE.md](docs/RULE_ENGINE.md).

## Local development

```sh
cd ~/proj/little-island
bin/setup   # first time, or after package-lock.json changes
bin/dev     # open http://localhost:5173
```

Press `Ctrl-C` in that terminal to stop the server. To use another port, run `PORT=4173 bin/dev`. Before committing, run:

```sh
bin/check
```

That runs the simulation tests, typechecks the project, creates `dist/` for static hosting, and plays the built site in a headless Chromium with every third-party request blocked. `bin/e2e` runs that browser pass alone — clicking a tree, watching the log come home, reloading. It needs `npx playwright install chromium` once per machine; a sandbox that already ships a browser can point `CHROMIUM_PATH` at it instead. What the tests cover, and the classes of bug they are aimed at, is in [docs/TESTING.md](docs/TESTING.md). `bin/play` opens the same island in a terminal. While the page is open, `window.island` exposes the live simulation and scene for console poking and browser tests. The scripts work from any current directory because they resolve the project root themselves. No backend, secrets, model API, external asset download, or runtime asset pipeline is required. Google Fonts load from the document, so a blocked or unreachable font host costs typography and nothing else.

## Controls

- Click a tree: add it to the work list. Click a marked tree again to call it off. Orders are accepted while paused, and a carried log always comes home even if its order is cancelled.
- Drag: orbit. Right drag: pan. Scroll/pinch: zoom.
- Space or pause: pause simulation. 1×: cycle through 1×, 2×, and 3×.
- Home icon: find Robin up close. Island title: reset the camera. Sound icon: toggle synthesized sound effects.
- Help: controls. Reset: confirm a fresh island.

The island saves to localStorage every five seconds, on deliveries and on leaving. Reload resumes the job, the work list, and any order still waiting in the inbox. All geometry is procedural.

## Play it in a terminal

```sh
bin/play                      # a fresh island
bin/play --seed 12            # a different one
echo 'chop 0; until' | bin/play
```

The same rule engine, drawn in text. No build step: Node 22.18 and newer run the
TypeScript directly, so the headless game starts in a third of a second.

```text
   ....·▲······♣······················▲······....
   .....······▲········⌂@··············♣····.....
    .....································▲·.....

Little Island  00:00   timber 0   felled 0   standing 37
  Robin   taking it all in
  work list  empty
> trees 3
  oak #7     4.7 away  SE
  fir #22    5.0 away  NW
  oak #14    5.8 away  W
> chop 22
[00:00] #22 goes on the work list
[00:00] Robin sets off for #22
> trace on
  tracing decisions only
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

`help` lists the commands. The useful ones are `trees`, `chop <n>`, `cancel`,
`wait [seconds]`, `until`, `save`/`load`, `hash`, and `rules` to print the
rulebook. `trace on` narrates the engine's decisions and hides the rules that fire
every tick for anyone walking; `trace all` shows everything.

By default the terminal runs the `village` rulebook, which is where the economy
is being designed. A villager assigned to a lumberjack hut walks there at the
start of the day, picks up the axe, fells the nearest tree in range, hauls the
log back, and stops when the store is full. A sawmill asks the hut for logs and
saws them into planks:

```text
> wait 30
[00:00] the sawmill is waiting for a log
[00:01] Robin takes the axe from the hut
[00:01] Wren takes the saw from the sawmill
[00:07] #36 comes down
[00:07] a log is left lying where it fell
[00:07] Robin goes to fetch it
[00:09] a log goes into the hut — 1 of 5
[00:09] the sawmill asks the hut for a log
[00:11] a log goes into the sawmill — 1 of 8
[00:20] the sawmill turns out a plank — 1 in store
> buildings
  hut     #1 Robin    store 0/5  13 trees in range
  sawmill #2 Wren     store 2/8  (1 log, 1 plank)  log → plank
> check
  all sound  1 log, 1 plank
```

`buildings` lists them, `hire <name> [building]` puts somebody to work, `build
sawmill` puts one up, `wares` shows what is stored and what is lying about,
`spawn <name> [role]` adds another pair of hands, and `check` runs the invariants
against whatever you have played into.

`bin/play --rules settlement` runs the browser's rules instead, and `--rules
hauling` the intermediate experiment where logs lie on the ground but no building
gives out the work. `rulebook <id>` swaps between them mid-session without
touching the island — the clearest demonstration that rules are data. What the
hauling experiment measured, and why dedicated carriers turned out to be a bad
deal without roads, is in [docs/WIDELANDS.md](docs/WIDELANDS.md); the shared
vocabulary is at the top of [docs/RULE_ENGINE.md](docs/RULE_ENGINE.md).

## Architecture

`src/sim/` is the game: a rule engine with no renderer, no DOM and no Three.js import. It has two front ends — `src/cli/` in a terminal and `src/scene.ts` plus `src/game.ts` in a browser — and neither is allowed to hold game logic. The state is plain JSON, the host queues commands, the engine runs whole 1/30s ticks and hands back events, so the same elapsed time produces the same world whatever the display refresh rate and a stalled tab cannot bank hours of work. `serialize` / `deserialize` are the persistence boundary. `src/scene.ts` owns the Three.js objects and derives every frame from that state, interpolating between ticks. `src/game.ts` is the only file that touches the browser: clicks become commands, events become sound and messages. `src/main.ts` only chooses between the island and the lab. `src/cli/view.ts` does the same job in text, and `src/cli/play.ts` is a readline loop over the same commands. Terrain height is one function shared by both sides, so feet and props agree with the ground.

The rulebook, the tick, the command and event vocabulary, the save format and the known gaps are documented in [docs/RULE_ENGINE.md](docs/RULE_ENGINE.md).

Where production is going — foraging, depletion, multi-input recipes, upkeep and farms, and the one abstraction that covers them — is in [docs/PRODUCTION.md](docs/PRODUCTION.md), replying to the design brief in [docs/RESOURCES.md](docs/RESOURCES.md).

The convex mainland permits direct walking paths without navigation machinery; decorative tree foliage is not a path obstacle in this deliberately narrow prototype.

## Play and previews

[Play the island](https://kellan.github.io/little-island/). Pushes to main build, test, play the browser suite, and deploy to GitHub Pages; a failure in the browser run stops the deploy. Same-repository pull requests build a playable preview at /little-island/pr-preview/pr-N/; the Actions run summary has the link. The preview only builds, because the check workflow already tests the same commit. Closing a PR removes its preview. Fork PRs receive read-only build/test CI. Actions are pinned to commit SHAs and use only the repository's short-lived GITHUB_TOKEN.

## What the first iteration taught us

- **Three.js:** procedural meshes, warm directional light and damped OrbitControls make a convincing little world without models or an asset pipeline. A full library bundle is still roughly 135 KB gzipped; broad device performance is not established by this spike.
- **Terrain:** one height function keeps feet and props grounded. Triangle winding and shadow sides are visible correctness issues, not just geometry details. A flattened clearing fixed ground intersection with its surface patch. The island is intentionally convex; real roads and obstacles would need navigation.
- **Agent development:** Astra made the first complete slice quickly, but playing it revealed oversized HUD text, ground intersection, shadow artifacts and camera occlusion that compilation could not. Keep the loop: implement, build, play, inspect, fix, play again.
- **Instruments lie quietly:** the first frame-rate readout sampled the clamped simulation delta, so it could not report worse than 10 FPS or 100 ms however badly a frame ran. A benchmark that cannot express failure is worse than no benchmark. The lab now measures real elapsed time and a headless smoke test loads the built pages, because a page that compiles and then renders nothing passes every unit test.

## What the rule engine iteration taught us

- **The rules:** a state machine per villager was fine for one villager and stopped being fine the moment work could queue. Phases plus a job with an owner made the awkward cases — cancel an order mid-walk, fell a tree someone else already took, quit while carrying a log — ordinary rather than special. Eleven rules cover the whole game, and each one fits on a screen.
- **Commands in, events out:** the host used to notice a delivery by comparing a counter against last frame's copy, and time the chop sound by rounding world time into beats. Both are now events the rules emit, and the host got shorter as a result: it reacts instead of inferring.
- **Time:** quantising to whole 1/30s ticks and interpolating positions for rendering removed frame-rate dependence and, unexpectedly, made walking look better. Clamping the catch-up means a backgrounded tab resumes calmly instead of teleporting everyone.
- **Determinism is cheap if you pay early:** putting the seed inside the world made replay tests, save/load equivalence and "does this bug reproduce" all the same one-line check (`hashWorld`).
- **Three.js, again:** a blocked Google Fonts `@import` inside the bundled CSS made Vite's stylesheet preload reject and the dynamic import of the game never resolve — a blank island for anyone whose network dislikes that CDN. Fonts now load from a `<link>` that is allowed to fail. Rendering one villager or a hundred is the same code once the scene derives rigs from state.
- **Terrain:** moving `elevation` into the simulation package settled who owns the ground. The renderer asks the same question the walking rules do, and nothing floats.
- **Headless is fast:** with no renderer attached, 120 villagers felling 240 trees costs about 0.06 ms per tick against a 33 ms budget. Linear scans and re-sorting candidates are not the problem anyone thought they would be at settlement scale.
- **Agent development:** the headless tests were green while the built page was a blank screen, because nothing in a unit test loads a font from a CDN. Driving the real page — click a tree, wait for the log, reload, look at the screenshot — found the blank page, the too-pale order markers, and whether a work list reads as a work list. Write the engine headless, then go and play it.

## Scope and next-step notes

One villager, finite trees, one stockpile, two kinds of job. The engine is not limited to that: villagers are a list, jobs have owners and a `kind`, and the scale test runs 120 of them. The game deliberately does not. No buildings, needs, production chains, pathfinding, regrowth or time of day — the shape each of those would take is noted at the end of [docs/RULE_ENGINE.md](docs/RULE_ENGINE.md). The simulation persists data, not Three.js objects. The save format is at version 4; older saves are refused and a fresh island appears instead. Inspiration: Outlanders 2 and The Settlers 2 for calm readable work, Timberborn for physical resource movement, Widelands for economic concepts, SlimCity for web architecture, and Three.js Game for small examples. No source code or art is copied from those games. Widelands is the one we can read rather than infer: [docs/WIDELANDS.md](docs/WIDELANDS.md) works through its economy, what maps onto this engine, and the licensing line we do not cross.

## Technical proving ground

Run `bin/stress` to open the browser benchmark. It can scale an instanced forest to 50,000 trees, simulate up to 5,000 lightweight workers, burst-retarget paths, measure raycast picking, and verify deterministic JSON save/load. It reports real elapsed frame time, so a frame that misses the budget by 40x says so instead of flattening against a clamp. See [docs/STRESS_TESTING.md](docs/STRESS_TESTING.md) for scenarios, budgets, and measurements.
