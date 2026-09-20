# Technical proving ground

The stress lab is a synthetic benchmark around the prototype. It does not add settlement gameplay. It exercises the browser, Three.js renderer, simulation boundary, deterministic state, input picking, and long-running lifecycle separately.

Start it with:

```sh
bin/stress
```

Or open a scenario while the development server is running:

```text
http://localhost:5173/?lab&scenario=balanced
http://localhost:5173/?lab&scenario=render
http://localhost:5173/?lab&scenario=agents
http://localhost:5173/?lab&scenario=soak
```

Counts can be reproduced in the URL:

```text
?lab&scenario=balanced&trees=10000&agents=500
```

## What it measures

- FPS, p95 and worst frame time over rolling one-second samples, from real elapsed time
- Simulation time per frame, and the instance-transform upload it used to hide
- Three.js draw calls and triangles
- Raycast picking latency across the instanced forest
- JSON save/load time, payload size, and exact state hashes
- Deterministic simulation behavior under test
- Repeated save/load during the soak scenario

The sliders extend to 50,000 trees and 5,000 synthetic workers. Trees and workers use `InstancedMesh`; five draw calls are typical with shadows off. Rebuilding a scenario disposes the old geometry, materials **and** the `InstancedMesh` itself, because Three frees a per-instance matrix buffer only from the mesh's own `dispose()`. Disposing geometry and material alone stranded 3 MB per mesh per rebuild at 50,000 trees.

Two properties the lab depends on are covered by unit tests rather than by eye: `src/frame-metrics.test.ts` pins the frame statistics, including that a 1,400 ms frame reports 1,400 ms, and `src/dispose.test.ts` fails if the instance buffer stops being released.

## Reading the numbers

These are observations, not universal targets. Browser window size, pixel ratio, thermal state, and other tabs affect them.

Until the frame readout was fixed it sampled the *clamped* simulation delta, so it could not report worse than 10 FPS or 100 ms however long a frame took. Figures below those limits were never distorted and still stand; anything that was over budget was not being measured at all. On a GPU-less software renderer the old panel read a confident `10 FPS / 100.0 ms` while frames genuinely took 1,365 ms. The same run now reports p95 within a frame of an independent measurement:

| Load | Independent rAF sample | Panel |
| --- | --- | --- |
| 300 trees, 300 workers | 10.8 FPS, p95 166.7 ms | 10 FPS, p95 166.7 ms |
| 4,000 trees, 800 workers | 3.4 FPS, p95 666.7 ms | 3.1 FPS, p95 633.3 ms |

| Scenario | Load | Observation |
| --- | --- | --- |
| Render cliff | 25,000 trees, 50 workers | About 60 FPS, roughly 18.5 ms p95, five draw calls |
| Agent load | 1,000 trees, 1,000 workers | Roughly 54 FPS and 33 ms p95; simulation near 0.2 ms/tick |
| Soak sample | 5,000 trees, 500 workers | About 60 FPS; 74 KB state round-tripped exactly in roughly 2 ms |

The first result supports instancing for dense decoration. The second says the worker simulation is still cheap at 1,000 agents. Measured directly, the simulation is nowhere near the bottleneck: `stepStress` costs 0.15 ms at 5,000 agents and 0.58 ms at 20,000, and rebuilding 5,000 instance transforms costs a further 0.42 ms per frame with a 313 KB upload. Moving simulation to a worker would buy roughly half a millisecond; the draw side is where the budget actually goes. The soak scenario needs a longer 30–60 minute run before making a memory-stability claim.

Serialization is the costlier boundary: 5,000 agents is a 742 KB payload at about 4.6 ms to write and 3.8 ms to read, round-tripping exactly. Well inside budget, but it is JSON of full-precision floats and it will be the first thing to squeeze.

## Budgets

The lab marks the rolling frame result green at 16.7 ms or faster, amber through 33 ms, and red above 33 ms. The working budgets are:

- 60 FPS on a current desktop, 30 FPS on an ordinary phone
- Simulation below 5 ms per frame, including the instance upload
- Picking feedback below 50 ms
- Save/load below 250 ms
- No continuing resource growth after warm-up in a 30-minute soak

Use the browser performance and memory panels for a formal soak capture. JavaScript heap readings are browser-specific, so the in-game overlay does not pretend to provide a portable memory measurement. GPU-side allocation is invisible to the page entirely, which is why the instance-buffer release is pinned by a unit test instead of by watching a graph.

## Fixed timestep

Both the island and the lab advance simulation through `src/timestep.ts` in fixed 1/60 increments. The same elapsed time therefore produces the same world whatever the frame pacing: 600 frames at 60 Hz and 300 at 30 Hz end on an identical state hash, which `src/timestep.test.ts` asserts. Before this, "deterministic" only meant "reproducible given an identical sequence of frame deltas" — the two worlds in the old determinism test were fed the same fixed delta, so they could not have diverged. Replays, lockstep networking and reproducible bug reports all need the stronger property.

The accumulator caps catch-up work at twelve steps per speed multiple. The cap bounds the work a single frame can inherit from a stalled tab; scaling it with the multiplier keeps 3x honest, because three times speed is genuinely three times the work. Holding the cap fixed made the 3x button deliver 1.6x on a display running at 8 FPS.
