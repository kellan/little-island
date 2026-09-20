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

2. **Fishing — steady, water-locked, and two different verbs.** The stock is a shared
   pool that depletes under pressure and recovers when rested; overfishing should be
   possible *and recoverable*, legible on the map. Two structures, which are **not
   tiers** — a settlement wants both:

   - **Fish weir** — a stake-and-wattle trap set in a channel. It fishes whether or not
     anyone is there. No labor to run, low yield, and **capped**: once full it stops, and
     the surplus is lost. Placement is restricted to rare sites (river mouth, tidal
     narrows). Cost `log x2, reed x6`, no tool. Buildable on day one, before a sawpit
     exists — the one piece of food infrastructure a settlement with nothing can raise.
   - **Fishing pier** — active. Higher yield, scales with workers, but costs a villager's
     whole day. Cost `plank x6, log x2, cordage x4`, plus a **net** (`cordage x3`). Sits
     behind a sawpit and a cordage source, so it is a real tech step rather than a free
     upgrade.

   The weir is insurance; the pier is production. The weir keeps a settlement alive during
   the week everyone is busy building, and it never becomes obsolete because it never
   costs labor. Note the pressures differ in kind: forage degrades into **walking time**,
   the weir degrades into **waste**. Neither is a failure message.

   Weirs are tidal. If a clock ever lands, "empty at low tide" gives them a daily rhythm
   for free. Do not require it.

   Later, the weir's stakes become *poles* from coppice rather than whole logs — a small
   efficiency that gives coppice something to do the day it arrives.

3. **Hunting — forest-coupled.** Lodge plus snares and traps. Game population is a
   function of standing forest: clear-cut the woods for planks and the deer leave. First
   real land-use dilemma, and cheap to implement — a density lookup against forest cover.

4. **Farming — the one that is actually a system.** See below.

Hunting and fishing are **distinct systems**, not one "protein" building with two skins.

**Meal variety is the growth currency.** A meal assembled from several distinct food
categories (forage / protein / grain / dairy) is worth more than the same calories from
one source. This is the Outlanders 2 mechanic and it is worth keeping: it is what stops
the player from solving food once and forgetting it.

## Cooking, and why forage is really the floor

Split food goods by preparation:

- **Eat raw** — berries, fruit, nuts, milk, some roots. Zero infrastructure. This is why
  foraging is the baseline: not merely weak, but the only food that needs *nothing at all*.
- **Must cook** — fish, meat, grain, most vegetables. Requires a **hearth** and
  **firewood**.

So the food ladder and the firewood tax are the same problem. The moment a settlement
graduates from berries to fish, it has signed up for fuel — gathered off the forest floor
early, and later logs through a wood chopper. That is a ladder rung with a cost attached
rather than just a bigger number.

It also gives meal variety a physical home. Raw forage can be eaten where it is picked; a
*proper meal* is assembled at the hearth from several categories, and the hearth burns
firewood every day it runs. The first hearth is therefore a real milestone: before it, the
settlement eats cold berries, survives, and does not grow.

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

## How goods reach the buildings that consume them

**Default: pull.** A building's stationed worker fetches its own inputs. Nobody delivers
to them.

The cook is the worked example. The hearth needs fish (or meat, or crops) and firewood, and
the cook is the one who goes and gets both — walks to the weir, walks to the woodpile,
walks back, cooks. The entire food chain is **one visible loop performed by one person**,
which is the thing this prototype already does well with Robin and a log, scaled up rather
than replaced by stockpile arithmetic.

What this buys:

- **Placement becomes the gameplay.** A hearth far from water and far from woods means the
  cook spends the day walking and produces two meals. Throughput degrades smoothly with
  distance — no error state, no "missing input" message, just a curve the player can read
  by watching.
- **No hauler concept is needed to ship the first version.** That is a large simplification.

### Fetch a load, not an ingredient

Required, or the model is pathological: a cook who walks to the weir once per meal makes
the pacing absurd. The worker fetches a **load** — N fish — and works through it.

This gives a readable batch-trip rhythm, and it makes **carry capacity a real number**.
Carry capacity is in turn what later justifies baskets, pots, barrels, and a handcart, so
the container goods get a job rather than existing for their own sake.

### Firewood breaks it first, and that is the design

Pull works well at three buildings and strains as the settlement grows. The useful part is
*where* it strains: **firewood**, because it is the one good that nearly everything
consumes. Food inputs are specific to the cook; firewood is universal. So the failure is
localized and legible:

1. **Cook fetches everything.** Fine at small scale.
2. **Firewood breaks it** — five buildings sending workers to the same forest floor for the
   same good, crossing paths all day.
3. **Build a woodpile** (local store) and someone stocks it. That someone is the first
   hauler.

Logistics then arrives as the solution to a problem the player has *felt*, instead of as a
system handed over in a tutorial. This costs nothing now: simply do not build haulers yet,
and let the strain happen.

### What errands are actually for

An earlier draft of this brief claimed the fish weir proved a need for an errand queue.
That was wrong — pull covers the weir, since the cook fetches from it like any other input.

Errands still earn a place, but for a narrower case: goods with **no consuming building
waiting on them**. Construction materials going to a build site. A farm's harvest lump that
must reach a granary before it spoils while nobody is eating it yet. Those have no
stationed worker whose job is to come and get them.

So: build pull first. Errands are a second, smaller mechanism, not a co-equal one.

**OPEN QUESTION — does fetching stay visible forever?** Keeping every fetch as real walking
at Timberborn scale means hundreds of agents pathing for ingredients. `bin/stress` suggests
5,000 lightweight workers is achievable, so it is likely affordable, but it is a design
commitment as much as a performance one. The alternative is that local storage eventually
*replaces* the trip with a draw rather than merely shortening it. Not resolved — ask.

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
- **Two kinds of work.** *Stationed* work means a villager belongs to a building, fetches
  its inputs, and works there. *Errands* are one-off jobs any free villager can claim.
  See "How goods reach the buildings that consume them" above for which is which — most
  hauling is stationed pull, and errands are a narrower category than they first appear.

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

## Parked: a reservoir of weird historical vocabulary

**Not for now.** At some point this game will want to go somewhere that feels new and
surprising rather than like a well-made Settlers homage. When that happens, the most
useful thing to have on hand is a stock of real preindustrial practices that are strange
to a modern player but were ordinary to the people doing them. This section collects them.

**The selection criterion matters more than the list.** An entry earns its place when it
is:

1. **Real and specific** — an actual practice with an actual name, not invented flavor.
2. **Carrying a mechanic** — the word implies a rule. A name that is only decoration is a
   worse version of the plain word.
3. **Teaching something by existing** — the player ends up knowing a true thing.
4. Ideally, making **terrain or timing matter**, since those are the two axes a settlement
   game can express.

`bloomery` passes on all four. Add to the list only things that do.

**Reshaping land use**

- **Assarting** — clearing woodland into new arable, often illegally at the forest edge.
  A verb that *permanently converts land type*, distinct from harvesting from it.
- **Transhumance / shieling** — herds moved between lowland winter pasture and high summer
  pasture, with a hut occupied only part of the year. A seasonal building, and a settlement
  holding both kinds of ground beats one holding twice as much of either.
- **Lazy beds (feannagan)** — raised ridges built on rocky ground out of seaweed and turf.
  Farming where farming should not work, at a high labor price. Makes bad land a choice.
- **Dew pond** — a clay-lined hollow on porous high ground that gathers condensation and
  rain. Makes streamless upland habitable.
- **Coppice** — see its own section above.

**Timing and irregularity**

- **Mast year** — oak and beech drop a huge acorn crop only every few years, irregularly.
  A resource that *spikes unpredictably* rather than accruing evenly.
- **Pannage** — the right to turn pigs into the woods in autumn to fatten on fallen mast.
  Free feed, but only in one season, and only under the right species. Pairs with mast
  years into an occasional bonanza, and makes tree *species* matter.
- **Tide mill** — a mill on the tide rather than the sun, running roughly twice a day and
  drifting fifty minutes later each day. Intermittent production on a non-solar clock.

**Same good, different recipe by place**

This is the most under-used idea in the genre and the most promising.

- **Salt pan vs. salt cote** — sun-evaporated brine where the climate allows; boiled over
  fire where it does not. The same salt, nearly free in the south and fuel-hungry in the
  north.
- **Corn drying kiln** — in wet climates grain must be kiln-dried before it can be milled
  or stored at all. A mandatory extra step that simply does not exist elsewhere.
- **Sweet chestnut flour** — bread from trees where grain will not grow. A forest that
  feeds a settlement the way a field would.

**Preservation as temporal logistics**

The most useful framing to come out of collecting these. Cheese, salt fish, smoked meat,
ale, cider, **chuno** (Andean freeze-dried potato, kept for years), and ice are not
upgrades to their fresh forms — they are **batteries**. Every other logistics idea in this
design moves goods through *space*; these move goods through *time*.

If a calendar ever lands, this becomes the second logistics system, and the goods for it
are already sitting in the resource table.

- **Ice house** — cut ice in winter, pack it underground in straw, and have cold storage
  all summer. Winter produces a resource whose entire payoff is in another season. The
  cleanest single illustration of the idea.
- Milk spoils in a day; cheese keeps for a year. The dairy is not a flavor building, it is
  a storage building that happens to change the good's name.

**Logistics**

- **Bodger** — an itinerant woodworker who turned chair legs on a pole lathe *in the wood
  where the tree fell*, because carrying legs is lighter than carrying logs. Processing at
  the source to cut haulage. A mobile workshop, which no building-based economy models.
- **Ropewalk** — rope is laid at full length, so ropewalks were absurdly long narrow sheds,
  some over 300 yards. A building with a *shape* requirement, not a footprint. Worth
  holding until buildings have real placement rules; wasted without them.
- **Clamp** — roots heaped under straw and earth, keeping through winter with no building
  at all. Near-free storage that loses a steady percentage.

**Nuisance and placement**

- **Retting pond** — flax soaked for weeks until the stem rots off the fiber, famously foul
  enough that towns banned it from common water. A long delayed conversion *plus* a
  negative amenity radius: zoning emerges without a zoning system.
- **Tannery** — wants running water, and stinks. Uses oak bark, a byproduct of felling.

**Closing loops**

- **Potash** — leached and boiled wood ash, for soap and glass. Every building paying the
  firewood tax already makes ash, so the universal cost becomes an input.
- **Tanbark** — tanning needs oak bark from felling. Logging feeds leather sideways.
- **Hurdles and the golden hoof** — portable woven fence panels. Fold sheep onto a fallow
  field at night, move the hurdles daily, and the flock manures the ground. The prettiest
  available answer to farm fertility, and it arrives as a *tool* connecting herd to field.
- **Lime kiln** — quicklime for mortar in construction **and** for sweetening sour fields.
  One good feeding two different sinks is rare and worth a lot.

**Husbandry wearing other clothes**

- **Warren and pillow mound** — artificial rabbit warrens, deliberately built and tended by
  a warrener. Looks like hunting, is actually farming.
- **Dovecote** — pigeons for meat and, more usefully, guano. In France the right to keep
  one was a seigneurial privilege.
- **Staddle stones** — the mushroom-shaped stone feet a granary stands on so rats cannot
  climb in. A granary without them quietly loses grain. Visible, charming, a real upgrade.

**Jobs with a failure state**

- **Charcoal burner's watch** — a collier slept beside the mound for days, because too much
  air loses the entire burn. A job that fails if the worker walks away, which is a good
  stress test for a villager who gets hungry.
- **Eel bucks and fish weirs** — passive traps that catch with no worker at all.

**Commons and obligation**

- **Quern** — a hand mill: two stones, turned by a person. Slow, free, needs no building,
  and works the day a settlement is founded. A watermill is fast but built and tolled, so
  the pair is already a decent choice on its own.

  What makes it a story is **mill soke**: the legal obligation to grind your grain at the
  lord's mill. Where it applied, querns were confiscated and smashed to enforce it. A
  monopoly maintained by breaking people's tools is a far more interesting way to gate a
  technology than making it expensive.

- **Souming** — the rule limiting how many animals each household may graze on the common,
  to stop overgrazing. A governance mechanic rather than a production one. Filed here
  because it is the shape of a genuinely different game.

## Explicitly out of scope right now

- Combat, weapons, raiding.
- Trade between settlements, and anything designed around it beyond biome-locking raws.
- Jacobs-style runtime chain discovery.
