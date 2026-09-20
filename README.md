# Little Island

A small, tactile browser settlement prototype: orbit a handmade procedural island, select a tree, and watch Robin walk, chop, carry a log, and deliver it to the clearing.

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

That runs the simulation tests, typechecks the project, creates `dist/` for static hosting, and loads the built pages in a headless Chromium with every third-party request blocked. The browser pass needs `npx playwright install chromium-headless-shell` once; a sandbox that already ships a browser can point `CHROMIUM_PATH` at it instead. The scripts work from any current directory because they resolve the project root themselves. No backend, secrets, model API, external asset download, or runtime asset pipeline is required. Google Fonts load from the document, so a blocked or unreachable font host costs typography and nothing else.

## Controls

- Click a tree: issue a harvesting order. New orders may interrupt walking/chopping, but a carried log is delivered before accepting another order.
- Drag: orbit. Right drag: pan. Scroll/pinch: zoom.
- Space or pause: pause simulation. 1×: cycle through 1×, 2×, and 3×.
- Home icon: find Robin up close. Island title: reset the camera. Sound icon: toggle synthesized sound effects.
- Help: controls. Reset: confirm a fresh island.

The single villager and island state save to localStorage every five seconds, on orders/deliveries and on leaving. Reload resumes the job. All geometry is procedural.

## Architecture

`src/simulation.ts` is rendering-independent, deterministic, plain JSON data plus commands and bounded time steps. `src/timestep.ts` drives it on a fixed 1/60 step, so the same elapsed time produces the same world whatever the display refresh rate, and a stalled tab cannot bank hours of work. `serialize` / `deserialize` are the persistence boundary. `src/scene.ts` owns Three.js objects and derives visuals from simulation state. `src/game.ts` binds browser input, UI and saves to the simulation; `src/main.ts` only chooses between the island and the lab. Terrain height is shared by simulation and rendering. The convex mainland permits direct walking paths without navigation machinery; decorative tree foliage is not a path obstacle in this deliberately narrow prototype. There are no buildings, needs, production chains, networking or backend.

## Play and previews

[Play the island](https://kellan.github.io/little-island/). Pushes to main build, test, and deploy to GitHub Pages. Same-repository pull requests build a playable preview at /little-island/pr-preview/pr-N/; the Actions run summary has the link. The preview only builds, because the check workflow already tests the same commit. Closing a PR removes its preview. Fork PRs receive read-only build/test CI. Actions are pinned to commit SHAs and use only the repository's short-lived GITHUB_TOKEN.

## What the first iteration taught us

- **Three.js:** procedural meshes, warm directional light and damped OrbitControls make a convincing little world without models or an asset pipeline. A full library bundle is still roughly 135 KB gzipped; broad device performance is not established by this spike.
- **Terrain:** one height function keeps feet and props grounded. Triangle winding and shadow sides are visible correctness issues, not just geometry details. A flattened clearing fixed ground intersection with its surface patch. The island is intentionally convex; real roads and obstacles would need navigation.
- **Agent development:** Astra made the first complete slice quickly, but playing it revealed oversized HUD text, ground intersection, shadow artifacts and camera occlusion that compilation could not. Keep the loop: implement, build, play, inspect, fix, play again.
- **Instruments lie quietly:** the first frame-rate readout sampled the clamped simulation delta, so it could not report worse than 10 FPS or 100 ms however badly a frame ran. A benchmark that cannot express failure is worse than no benchmark. The lab now measures real elapsed time and a headless smoke test loads the built pages, because a page that compiles and then renders nothing passes every unit test.

## Scope and next-step notes

One villager, finite trees, one timber stockpile. No buildings, needs, production chains or additional villagers. Time of day is fixed; trees do not regrow. The simulation persists data, not Three.js objects. Inspiration: Outlanders 2 and The Settlers 2 for calm readable work, Timberborn for physical resource movement, Widelands for future economic thinking, SlimCity for web architecture, and Three.js Game for small examples. No source code or art is copied from those games.

## Technical proving ground

Run `bin/stress` to open the browser benchmark. It can scale an instanced forest to 50,000 trees, simulate up to 5,000 lightweight workers, burst-retarget paths, measure raycast picking, and verify deterministic JSON save/load. It reports real elapsed frame time, so a frame that misses the budget by 40x says so instead of flattening against a clamp. See [docs/STRESS_TESTING.md](docs/STRESS_TESTING.md) for scenarios, budgets, and measurements.
