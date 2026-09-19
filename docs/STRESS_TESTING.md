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

- FPS and p95 frame time over rolling one-second samples
- Simulation time per tick
- Three.js draw calls and triangles
- Raycast picking latency across the instanced forest
- JSON save/load time, payload size, and exact state hashes
- Deterministic simulation behavior under test
- Repeated save/load during the soak scenario

The sliders extend to 50,000 trees and 5,000 synthetic workers. Trees and workers use `InstancedMesh`; five draw calls are typical with shadows off. Rebuilding a scenario disposes its old geometry and materials so the controls do not manufacture a GPU-memory leak.

## Initial read on this laptop

These are observations, not universal targets. Browser window size, pixel ratio, thermal state, and other tabs affect them.

| Scenario | Load | Observation |
| --- | --- | --- |
| Render cliff | 25,000 trees, 50 workers | About 60 FPS, roughly 18.5 ms p95, five draw calls |
| Agent load | 1,000 trees, 1,000 workers | Roughly 54 FPS and 33 ms p95; simulation near 0.2 ms/tick |
| Soak sample | 5,000 trees, 500 workers | About 60 FPS; 74 KB state round-tripped exactly in roughly 2 ms |

The first result supports instancing for dense decoration. The second says the worker simulation is still cheap at 1,000 agents; frame variability and uploading instance transforms deserve attention before moving simulation to a worker. The soak scenario needs a longer 30–60 minute run before making a memory-stability claim.

## Budgets

The lab marks the rolling frame result green at 16.7 ms or faster, amber through 33 ms, and red above 33 ms. The working budgets are:

- 60 FPS on a current desktop, 30 FPS on an ordinary phone
- Simulation below 5 ms per tick
- Picking feedback below 50 ms
- Save/load below 250 ms
- No continuing resource growth after warm-up in a 30-minute soak

Use the browser performance and memory panels for a formal soak capture. JavaScript heap readings are browser-specific, so the in-game overlay does not pretend to provide a portable memory measurement.
