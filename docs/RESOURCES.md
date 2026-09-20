# Resources and production — design brief

Status: **design notes, nothing implemented.** Output of a brainstorming session, written
for the agent prototyping the rules engine. It records what was decided, what was
deliberately rejected, and what is still open. Where it says "open", do not guess — ask.

Today the whole economy is `World.logs: number` in `src/simulation.ts`: one good, one
stockpile, one villager. Everything below is the target to grow toward, not a spec to
implement in one pass. The last section names the first slice.

## The shape: authored chains

Production chains are **authored data**, not emergent. A recipe graph written down in a
data file: inputs, outputs, the building that performs the conversion, and time. The
pleasure is logistical — watching a bottleneck form and fixing it. Reference points are
The Settlers 2, Widelands, and Outlanders 2.

An alternative was considered and **rejected for now**: a Jane Jacobs "import
replacement" model where chains are discovered at runtime rather than authored. That
belongs to a much later phase, alongside trade, if ever. Do not build toward it.

## Three sinks, plus a tax

Every chain terminates in exactly one of three sinks. Keeping them distinct is what lets
a settlement be well-fed and toolless, or well-equipped and starving, and have those read
as different failures.

- **The table** — meals. The daily clock, and the primary growth currency.
- **The site** — construction materials. Capital.
- **The hand** — tools. Tools gate labor: a woodcutter without an axe is not a woodcutter.

There are **no weapons and no combat**. Hunting gear is snares and traps — a tool, in the
third category, not an armament. Nothing in the graph produces arms.

Cutting across all three:

- **Firewood** is a universal operating tax. It is a *separate good from logs*: gathered
  free off the forest floor early on, and only later worth manufacturing from logs at a
  wood chopper. Many buildings consume it just to run. It should be nearly invisible when
  the settlement is small and a genuine logistics problem at twenty buildings. This
  follows Outlanders 2 directly.

## Buildings have operating cost, not just build cost

The main departure from Outlanders. A building costs materials to raise **and consumes
goods every day it runs**. A settlement that overbuilds does not hit a wall; it slowly
browns out. This is also what earns the demolish verb.

The rules engine should therefore model a building as having both a `construction` cost
and an ongoing `upkeep` draw, not a single cost field.

## Raw resources

Gathered directly from the map. Roughly twelve at full build.

| Good | Source | Notes |
|---|---|---|
| log | forest | softwood/hardwood split deferred |
| firewood | forest floor, or wood chopper from logs | the operating tax; cheap and abundant early |
| stone | outcrop | finite, no regrowth |
| clay | riverbank, bluff | |
| sand | beach | |
| reed | marsh | thatch and cordage |
| grain | tilled soil | see farming below |
| fish | water | renewable, depletable under pressure |
| game | forest | meat and hides |
| forage | scrub, woodland | fruit, mushrooms, berries, nuts, roots |
| salt | coastal pan | biome-locked |
| bog iron | marsh, upland | biome-locked |
| milk / wool | pasture + livestock | needs a structure; semi-raw |

Two tensions are deliberate and should survive into the map generator: **game and logs
come from the same forest**, and **grain and pasture want the same flat ground**. Scarcity
that comes from land use rather than from a tuning number is what makes a map worth
reading.

**Raw resources are biome-locked.** If every island has clay, nobody ever trades. This
decision matters now even though trade does not exist yet, because it constrains world
generation. Trade between settlements is a known future direction — the world is
eventually Timberborn-sized with multiple settlements — but it is explicitly **not to be
designed or built against yet**. Just do not make the raws uniform.

## Processed and finished goods

Sketch, not final. Target is roughly thirty goods at full build.

- **Wood:** log → sawpit → plank. log → wood chopper → firewood. log → kiln → charcoal.
- **Earth:** clay → kiln → brick, or pot. Pots matter more than they look: containers are
  what make goods storable.
- **Stone:** stone → masonry → block. Later: lime + sand → mortar, for advanced buildings.
- **Shore:** seawater → salt pan → salt. reed → cordage → net. fish + salt → salt fish
  (keeps).
- **Field:** grain → mill → flour → bakery → bread. Bran to pigs — the first time a waste
  output becomes an input.
- **Herd:** milk → dairy → cheese. wool → loom → cloth. hides → tannery → leather.
- **Metal:** bog iron + charcoal → bloomery → iron bloom → smithy → **tools only**
  (axe, saw, hoe, pick, net needle).

## The food ladder

Four systems that **overlap rather than replace each other**. A settlement running all
four at once is normal, not a sign it failed to upgrade.

1. **Forage — the baseline, never turns off.** Fruit, mushrooms, berries, nuts, roots. No
   building required to start. The key property: it does not hard-stop, it **degrades into
   walking time**. Patches deplete locally and regrow slowly, so the forager ranges further
   and further until a hut near a fresh patch is obviously worth building. Self-limiting
   with no "you may not" message, and it makes walking distance the cost — which the
   existing simulation already models well.

2. **Fishing — steady, water-locked.** Pier or hut, plus a net. Best yield per worker of
   the early options. The stock is a shared pool that depletes under pressure and recovers
   when rested; overfishing should be possible *and recoverable*, legible on the map.

3. **Hunting — forest-coupled.** Lodge plus snares and traps. Game population is a
   function of standing forest: clear-cut the woods for planks and the deer leave. First
   real land-use dilemma, and cheap to implement — a density lookup against forest cover.

4. **Farming — the one that is actually a system.** See below.

Hunting and fishing are **distinct systems**, not one "protein" building with two skins.

**Meal variety is the growth currency.** A meal assembled from several distinct food
categories (forage / protein / grain / dairy) is worth more than the same calories from
one source. This is the Outlanders 2 mechanic and it is worth keeping: it is what stops
the player from solving food once and forgetting it.

## Farming, and why it needs logic

The first three sources are **continuous trickles**. Farming is a **periodic lump**:
nothing for a whole season, then a wagon-load at once.

That single property is the reason farming deserves special handling. It is what drags
granaries, pots, and spoilage into existence, and it turns "build a farm" into a
commitment with a failure mode that is not merely "too slow" — it is "I harvested and had
nowhere to put it."

On top of that, soil: fields draw down fertility, restored by fallow, manure, or rotation.
That is what makes farmland a *place* rather than a building.

**OPEN DECISION — how deep the farm goes.** Not resolved in the session. Three options
were on the table:

- **(a) Farm as a building.** Claims a field footprint, fixed yield, no soil state. Cheap
  and honest, roughly two days' work.
- **(b) Field with fertility.** Per-tile soil value that depletes and is restored by
  fallow or manure. Makes land worth caring about. This was the recommended pick.
- **(c) Seasons and rotation.** (b) plus a calendar, crop types, and a winter that must be
  stored across.

(c) is probably where the game ends up, but it drags a **global seasonal clock** into the
rules engine, and that decision has fingerprints on everything else. Whether the seasonal
clock goes in from the start is an open question put to the user and **not yet answered**.
Do not assume it either way — if the engine can be built so the clock is addable later
without a rewrite, that is the safest path.

## Notes for the rules engine

- `src/simulation.ts` is rendering-independent, deterministic, plain JSON, driven on a
  fixed 1/60 step. Resources must not break that: no floats accumulating differently per
  frame rate, and `serialize`/`deserialize` stays the persistence boundary.
- `World.logs: number` wants to become a record keyed by good id. Expect the version field
  to bump and `deserialize` to reject or migrate old saves.
- Recipes, building costs, and upkeep should be **data**, not code branches. The whole
  point of choosing authored chains is that the graph is a table someone can edit.
- Goods move physically — carried by villagers, as Robin already carries a log. Do not
  model transfers as instantaneous stockpile arithmetic.

## First slice

Do not build the whole table. A defensible first increment:

- goods: **log, firewood, forage, fish, plank, stone**
- buildings: **sawpit** (log → plank, consumes firewood), **forager's hut**, **fishing pier**
- one sink working end to end: villagers eat daily from forage and fish, and meal variety
  is visible in the UI
- firewood gathered free from the forest floor, no wood chopper yet

That exercises the three sinks, the upkeep draw, depletion-and-regrowth, and the
data-driven recipe table without committing to soil, seasons, metal, or trade.

## Parked: coppice, and settlement skill

Not for now, but on the roadmap and worth not designing around.

**Coppice** is a woodland cut on rotation: fell a hazel or ash at the base and it does
not die, it throws up a stand of poles that is re-cut every 7-15 years, indefinitely. A
coppice yields firewood and poles forever but never yields a timber log. High forest
yields timber, slowly.

The reason it is interesting here is that it splits "forest" into two distinct land uses
and gives the firewood tax a landscape of its own. The player stops asking "how much
woodland do I have" and starts asking "what kind of woodland am I keeping".

**It is gated on a concept the game does not have yet: settlement skill.** Coppicing is
something a settlement gets *better at* — it should arrive as forestry practice matures,
not as a building unlocked by paying planks. There is no progression or skill model in
the design at all right now, and inventing one just to justify coppice would be the tail
wagging the dog.

So: park it. When a settlement-skill concept does exist, coppice is the first thing to
hang off it. Until then, do not build forest state that would make the split impossible
to add later — a single global "trees remaining" count would.

## Explicitly out of scope right now

- Combat, weapons, raiding.
- Trade between settlements, and anything designed around it beyond biome-locking raws.
- Jacobs-style runtime chain discovery.
