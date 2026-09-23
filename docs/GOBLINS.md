# Goblin village — the design to date

Status: **the working reference for the game's design, assuming the goblin fork is taken.**
It combines [RESOURCES.md](RESOURCES.md), [PRODUCTION.md](PRODUCTION.md),
[GOBLIN_FORK.md](GOBLIN_FORK.md), [LINEAGE.md](LINEAGE.md) and [WIDELANDS.md](WIDELANDS.md) into one
place, and reads them all on one premise: the villagers are goblins, elders raise the
children, and the economy runs on patience, rot and fermentation.

Written 2026-09-23. It is a synthesis, not new design. Every claim below comes from one of
those documents, the commit history, or the code. Where this document and an older one
disagree, this one says which way the goblin premise settles it and why.

## How to read this

Every section marks how settled it is:

- **Decided.** Settled in conversation with the designer. Build on it.
- **Carried over.** Decided in the human-villager brief (RESOURCES.md) and not changed by
  the goblin premise. Build on it.
- **Suggested.** Proposed by an agent in writing and never confirmed. Treat it as a
  proposal to react to, not a spec.
- **Open.** Not settled. **Do not guess. Ask.** This rule comes from every earlier design
  doc and still applies.

If a mechanic isn't mentioned here, it hasn't been designed. Don't infer one from genre
convention.

## The pitch

A small, cozy settlement game about goblins on an island. Goblins are weak, so labour is
precious and the settlement gets ahead by setting things up and letting time do the work:
fungus on spent logs, a crock of something fermenting in a dug cellar, a fish weir that
fishes while nobody watches. There's no tech tree. Knowledge lives only in bodies. A goblin
who saws for years becomes sawyer-shaped, and she can hand that shape on only by raising a
child as an elder. The player's real job is to protect those lines of skill against this
week's shortage, and to keep the old goblins comfortable enough to teach well.

Reference points: The Settlers 2, Widelands and Outlanders 2 for calm, readable, physical
logistics. Timberborn for goods that move physically, and for eventual scale. T.
Kingfisher's *Nine Goblins* for character. GURPS Goblins for the idea that goblins have a
whole society.

## Tone

**Decided.**

- **Kingfisher for character.** Found family. A crew who grumble all the time and look
  after each other completely. Competence that doesn't look like competence but muddles
  through. Nobody is a hero, and everybody is a bit put-upon.
- **GURPS for society.** Trades, institutions, professions and civic life, not a monster
  entry. But that book is Hogarthian black comedy, and **this game drops its cruelty.**
- **Cozy** is the instruction that reconciles the two.

The framing that makes it work:

> **A well-run larder, not a garbage dump.**

Goblins aren't disgusting. They're **unfussy**. Nothing goes to waste, and they're rather
pleased about it: frugality read as warmth. A tidy pantry and a well-organised junk pile
mark a *successful* settlement, and it should look like one.

**What cozy forbids.** Failure is an inconvenience, never a catastrophe. A settlement that
overreaches gets tired and grumpy, never dead. That rules out:

- starvation spirals
- punishment for experimenting
- losing an hour's work to an event the player couldn't see coming
- goblins dying on screen

The failure register for every system is the same: *a season is lost, everyone is put out,
and somebody mentions it for a week.*

**No combat, no weapons, no raiding.** Carried over and absolute. Snares and traps are
tools, not arms. Nothing in the production graph makes weapons.

**No coercion as flavour.** The quern's monopoly story (grinding obligations enforced by
confiscation) was deliberately left out as off-tone. Apply the same test to any borrowed
historical practice.

**Cultural practices are framed with respect.** Low-intensity burning is a living
Indigenous practice that's being revived now, not a curiosity. If it ships, it should read
as skilled land management.

## Four theses

These explain why the individual mechanics fit together. When a new idea comes up, test it
against them.

### 1. The patience thesis

**Decided.** Goblins are weak, so **labour is the scarce resource.** Anything that turns
*time* into value, rather than *effort* into value, is worth far more to a goblin
settlement than to a human one. A ferment, a weir, a clam bed, a coppice rotation, a log
growing mushrooms, a crock in a cellar: none of them need a worker while they run.

> Humans push a plough. Goblins set something up and let the world do the work.

**The heuristic:** if two mechanics do the same job, prefer the patient one.

**The caution:** a game of pure waiting is boring. If time does the work, the *setting up*
has to carry the interest (where a thing goes, what it sits next to, what it will become),
and the labour that does exist has to stay legible and physical. Patience is the shape of
the economy, not the player's experience of it. This is the biggest unresolved risk in the
design (see Open questions).

### 2. Knowledge exists only in bodies

**Decided.** There's no tech tree, no library and no research building. There are only
goblins who have done the thing, and the goblins they raised. See "Lineage" below.

### 3. The productive landscape is the worked one

**Decided for goblins.** RESOURCES.md parked this as a future direction. The goblin fork
promotes it to *the* farm system. Land you don't tend degrades: it gets harder to walk
through, poorer to forage, emptier of game, and eventually dangerous. Tending makes it
better than it started. Nothing in the design assumes pristine wilderness is the ideal.

The genre has two verbs, *build* and *harvest*. This game adds a third: **improve**.

### 4. Preservation moves goods through time

**Decided for goblins.** Every other logistics idea moves goods through *space*. Cheese,
ferments, salt fish, bog butter and a stocked clamp move them through *time*. They're
batteries, not upgrades. A patient economy is a preserving economy by definition, so under
goblins this is **the spine of the economy**, not a footnote. Elders are the same idea
applied to skill.

## The goblins

**Decided.** Small humanoids. Compared with humans they are:

- **weaker**, so loads are awkward and labour is scarce
- **hardier**, so they endure conditions that would break a person, and don't need a
  hearth to survive the night
- **much wider in diet**, eating fungi, grubs, carrion, bark, offal, bone marrow and raw
  acorns

Consequences, all decided:

- **Named persons, not units.** "Gnarlfoot is cross because he's hauled all week," never
  "worker 37: idle." The prototype already names Robin.
- **Buildings are shops with proprietors.** Not "sawpit" but Grubwick's sawpit, and
  Grubwick has opinions about elm. It costs a name and a line of flavour, and it buys a lot.
- **The unit of organisation is the crew**, not the assignment: small groups who work
  together, walk together and look out for each other.
- **Goblins dig.** Stores go underground. The pit and the clamp come before the granary,
  and cold storage arrives without an ice house.
- **A goblin is a record, never a count.** `villagers: number` would rule out everything in
  this document.

### Teamwork is required: awkward loads

**Decided.** Weakness doesn't mean "carries less." It means **awkward loads**. A log isn't
heavy for a goblin, it's *unwieldy*. It takes two, one at each end, staggering. Two goblins
carrying one log is a friendship.

- Some goods need a **pair** to carry them. That gates hauling on available labour in a
  lumpy, visible way.
- The **handcart or travois** becomes an exciting early invention rather than a late
  optimisation.
- **Containers do double duty.** A pot or barrel makes an awkward load carryable as well as
  keeping it, so it moves goods through space *and* time.
- **Avoid the uncharming version** of weakness, where everything just takes longer. (Open:
  how much "weaker" costs in practice.)

### Felling

**Decided.** Early goblins can't bring down a great tree. The forest reads as *deadfall and
saplings, yes; mature oak, no*. Gathering what's already down, a **deadfall and windthrow
economy**, is the main early strategy rather than a footnote. When felling does arrive, it
comes as **fire and wedge** rather than a big axe, which ties it to burning (see "Tending").

## Lineage: how skill exists

**Decided unless marked.** This is the settlement-skill concept RESOURCES.md said the
design was missing. LINEAGE.md has the full argument.

### Shape

*Suggested model:* a goblin's **shape** is a small set of integers, one per axis. Doing a
kind of work adds to the relevant axes, tick by tick. The same numbers drive two things:

- **efficiency** at work that uses those axes
- **the mesh**: stoop, arm length, hand size, ear size, eye size, colouring

Using one set of numbers for both is the point. **The readout is the goblin.** You don't
need a skill panel to spot the sawyer. A glance at the village tells you what it has been
doing for the last decade.

This is the goblin fork's scavenging pillar applied to people: *Murray's adze, mended
twice* and *Murray's adze-arm* are the same idea. Things carry their history and wear
toward their use, the way a tool handle wears smooth. GURPS reshapes goblins through
cruelty. Here they're shaped by practice and care.

**Mush** is the low, even shape: a bit of everything, nothing deep. A mush village works,
eats and is reasonably content. It never excels and never unlocks practices that need
depth. **Mush is a plateau, not a failure**, which is what cozy requires.

**No genetics.** No hidden genes, no recombination. A shape is copied, at a discount, from
the elder who raised you. **Heritable bloodlines were rejected:** they drift toward castes
and determinism. You take the shape of whoever raised you, not whoever bore you, which is
Kingfisher's found family again.

### Three ages

**Decided:** child, worker, elder.

- **Child.** Minded by one elder, and plastic. A child starts working life with a fraction
  of their elder's shape. With no elder available, they start as mush. **Too few elders
  means mush.**
- **Worker.** Keeps building shape through work and can overtake their teacher. This is the
  **Lamarckian ratchet**: each generation of a well-kept line starts a little higher and
  ends higher still.
- **Elder.** Shape freezes and becomes teachable. Elders stop producing goods. They mind
  children and want to be comfortable. They're both the **apex sink** and the **only store
  of skill**.

**Retirement is automatic** with age. The player can **promote a worker to elder early**.
That's a real trade: a master sawyer at the pit produces planks, but sat down she produces
sawyers. Early promotion also freezes her shape where it stands, so she teaches a
shallower one.

**Nobody dies on screen.** The workforce turns over because workers become elders, not
because goblins are lost. (Open: what eventually happens to very old elders.)

**Aging uses a per-goblin counter, not a calendar.** Lineage doesn't need a global
seasonal clock.

### Apprenticeship

**Decided.** A child raised by an elder picks up that elder's shape. Apprentices are
**assigned automatically by default**. Left alone, that keeps the village running.
Improving generation over generation takes the player's active attention.

> The default produces adequate mush. Attention produces lineages.

### The first is self-taught

**Decided.** Nobody can teach a trade until somebody has muddled through a working life of
it. The first smelter is slow, grumbly and works from scavenged iron. Her apprentices are
the real thing. A lapsed line can be recovered: somebody can always be the first again.

### The core verb: protecting the line

**Decided.** It was chosen over two alternatives, listed below. A line is a chain of custody
for a shape. For the ratchet to turn, every link has to hold:

1. The child is raised by an elder who has the shape.
2. The child then works that trade,
3. for long enough to overtake their teacher,
4. and retires with time left to teach,
5. and is comfortable enough as an elder to teach well.

Short-term need can break any link. Hauling is short this week, so the sawyer-raised kid
gets sent to haul. The pit needs planks, so the master sawyer works until she has no
teaching years left. The village is cold, so the elders teach badly.

**The player's job is to defend long-term shape against this week's shortage:** output now
against capability later, at every life stage.

**Unconfirmed assumption.** This verb assumes labour is placed by an **automatic allocator
the player can override with a pin** ("keep her at the sawpit"). If assignment is fully
manual, protecting the line shrinks to "don't reassign people" and the mechanic gets much
thinner. The prototype today is manual: `hire <name> [building]` in `bin/play`. **This is
the first open question to settle. Ask before building on it.**

**Alternatives considered** (may be layered on later):

- **Matchmaking.** The player picks each child's elder, defaulting to the nearest free one.
  The scarce resource is the best teachers' attention.
- **Placement as upbringing.** No assignment at all. Children absorb whatever they spend
  time near, so the player steers by where the elders' bench stands. Blended shapes come
  free.

**Rejected:** heritable bloodlines, and a genetic model.

### The bench: elder wants

**Mechanic decided. The name "bench" and the fourth-sink framing are suggested.**

Each elder wants certain things in order to be comfortable, and the wants differ from elder
to elder. Meeting them turns two dials:

- **Capacity**: how many children the elder can mind.
- **Fidelity**: how much of their shape a child inherits.

Different goods feed different dials, and which good feeds which dial varies per elder. For
one, a hot drink buys capacity and a mended tool hung where she can see it buys fidelity.
For another it's the reverse.

The player steers by **prioritising an elder**, so comfort goods reach them first, and
possibly by **explicitly sending** an elder the thing they asked for. (Open: either or
both.)

So comfort stops being a village-wide meter and becomes **targeted investment**: you choose
whose knowledge the settlement carries forward, and how faithfully.

Elder wants are **voiced, not listed**. The elder says what she's missing.

*Suggested:* elder wants create **directed demand**, a specific good for a specific goblin.
Elders don't fetch, so under the pull model it's an errand, or better, **the children fetch
for their elder**, which puts the whole relationship on screen.

### What lineage unlocks

- **Practices that a settlement gets better at** arrive with enough depth of shape, not as
  buildings bought with planks. **Coppice**, the **mulberry-dike fish pond** and **clam
  gardens** were all parked on "no settlement-skill concept." Now they're gated on shape
  depth. No separate system.
- **The bloomery graduation is generational.** See "Tools and metal."
- **A mature village looks different, not just bigger:** old goblins on benches, and
  workers visibly shaped by their trades.
- **The cost of reassignment is grumbling, not a number.** A hauler-shaped goblin put on the
  loom says something about it.
- **Tools become heirlooms.** Murray's adze outlives Murray's working life and goes to his
  apprentice.

## Comfort: what a settlement grows toward

**Decided.** **Comfort replaces meal variety as the growth currency.** This is the biggest
change from the human brief. Meal variety is the Outlanders mechanic and it works for fussy
humans, but it's *cheap* for something that eats anything, so it can't be what a goblin
settlement strives for.

Comfort is a dry place, a hot drink, your friends nearby, your things mended.

- **The hearth changes job**, from nutrition to small comforts. Goblins don't need it to
  survive the night or to eat.
- **The ale, tea and cider slot becomes the actual sink**, not flavour. A comfort good does
  nothing for survival and everything for morale, which is what the goblin economy should
  produce at its apex.
- **Mending counts as comfort.**
- **Fermenting a staple is a comfort upgrade.** Goblins can eat raw acorns, and fermented
  ones are *nicer*.

**Shape of comfort.** It's a **per-goblin state, concentrated in elders**, with the two
dials above (decided in LINEAGE.md). Its job is to turn the settlement's past into its
future. Whether workers and children also carry comfort, and how it drives arrivals, is
open.

### The sinks

**Carried over:** every chain ends in exactly one sink, and keeping sinks distinct is what
lets a settlement be well-fed but toolless, or well-equipped but hungry, and have those read
as different failures.

- **The table**: food. Under goblins it's no longer the growth currency.
- **The site**: construction materials. Capital.
- **The hand**: tools. Tools gate labour: a woodcutter without an axe isn't a woodcutter.
- **The bench**: comfort goods for elders. *Suggested* as a fourth sink.

**Open:** does the bench sit beside the table, or replace it as the growth sink?

### The firewood tax moves onto industry

**Decided for goblins.** RESOURCES.md made firewood a universal operating tax, mostly on
cooking. Goblins don't need a hearth to eat, but smelting, pottery and charcoal still need
fire. So the universal cost falls on **industry, not dinner**.

Carried over otherwise:

- Firewood is a **separate good from logs**. It's gathered free off the forest floor early
  on, and only later made from logs at a wood chopper.
- It should be nearly invisible in a small settlement and a real logistics problem at
  twenty buildings.
- It's the first thing to **break the pull model** (see "Logistics").

## Economy structure

**Carried over**, and mostly already built.

- **Authored chains.** Production chains are data: inputs, outputs, building, time. The
  pleasure is logistical: watching a bottleneck form and fixing it. A Jane Jacobs model,
  with chains discovered at runtime, was **rejected**. Don't build toward it.
- **Buildings have an operating cost**, not just a build cost: a `construction` cost and an
  ongoing `upkeep` draw. A settlement that overbuilds doesn't hit a wall, it slowly **browns
  out**, which is exactly right for cozy. That's also what earns the demolish verb.
- **Raw resources are biome-locked**, so the map generator mustn't make them uniform, even
  though trade doesn't exist yet.
- **Scarcity comes from land use**, not tuning numbers. Game and logs come from the same
  forest.
- **Forest state is per-patch, never one global count.** A single "trees remaining" number
  rules out brush, burning, coppice, pollarding, game that follows browse, and fungus on
  stumps.
- **Goods move physically.** Villagers carry them. No transfers by instantaneous stockpile
  arithmetic.

### One model for every building: tasks on sites

**Built** (PRODUCTION.md). A **site** is a place in the world with an amount and a state: a
tree, a forage patch, a bog, and later a shoal, a plot, a coppice stool, a clam bed. A
**task** is a row of data: a site query, the wares it takes, how long it lasts, its effect
on the site, and its yields. A building is a name, a footprint, costs, a tool, a radius and
an ordered list of tasks. It performs the first task whose preconditions hold.

- **Depletion** is `amount` going down.
- **Regrowth** is one rule. Stone's regrowth is zero.
- **Foraging turns into walking time** with no extra machinery. The nearest sites go first,
  and the forager ranges further as they empty. There's never a "you may not" message.
- A building's input queue (`wants`) is **derived from its tasks**, not authored.
- `note-shortage` reports *which* precondition failed, which is the difference between an
  idle building and a stuck one.

Every goblin building in this document should be expressible as rows in this table. A
patient building is a task whose `seconds` is long and which holds no worker while it runs.
How to model "no worker while it runs" is not yet designed. (Open.)

### Logistics: pull, loads, errands

**Carried over, built and measured.**

- **Pull by default.** A building's stationed worker fetches its own inputs. Nobody
  delivers. **Placement becomes the gameplay:** throughput falls smoothly with distance, and
  there's no error state.
- **Fetch a load, not an ingredient.** Carry capacity is a real number (`CARRY_LOAD` is 4
  today). That's what gives baskets, pots, barrels and the handcart a job. Under goblins,
  some loads also need **two carriers** (see "Awkward loads").
- **Errands are narrower:** goods with no consuming building waiting on them, like
  construction materials, a harvest lump heading for the store, or a log lying where it
  fell. Pull came first; errands are the second mechanism.
- **Firewood breaks pull first, and that's the design.** When five buildings send workers to
  the same forest floor, the player builds a woodpile and someone stocks it. That someone is
  the first hauler. Logistics arrives as the fix for a problem the player has *felt*. Don't
  add haulers before that.
- **Any two-input recipe strains pull.** The bloomery showed this one stage earlier than
  predicted.
- **Dedicated carriers lose without roads** (measured in WIDELANDS.md). A generalist never
  walks empty. Don't add carrier roles without a network that makes them pay. If walking
  distance becomes the interesting decision, roads may arrive later as speed multipliers on
  paths people already walk.

**Open (carried over):** does fetching stay visible forever at Timberborn scale, or does
local storage eventually replace the trip with a draw?

## Food: the decay layer

**Decided.** The wide diet rewrites the food ladder from the bottom. The goblin food economy
**runs on decomposition**, so it runs on everyone else's byproducts:

- **Fungi on spent logs and sawpit waste. This is the flagship:** a food chain whose input
  is another chain's rubbish, and the fastest cycle in the tending system. It's already
  drawn in the goblin dressing: a worked-out stump grows the next crop.
- **Grubs and insects** from deadfall and rot.
- **Bones and offal** from hunting, which a human chain throws away.
- **Acorns, eaten raw.** Humans must leach out the tannins over days. This **un-parks the
  mast year:** an irregular, multi-year glut of the *main food* is a first-class event, not
  a curiosity.

**The ladder inverts.** For humans, forage → fish → hunt → farm is a climb toward control.
For goblins, the baseline is decomposition (abundant, reliable, unfussy), and the
*aspirational* food is what humans eat.

**Carried over, re-read:**

- **Forage never turns off.** Patches deplete locally and regrow slowly, so the cost is
  walking time. Built.
- **Fishing** is a shared stock that depletes under pressure and recovers when rested. It
  has two verbs that **aren't tiers**:
  - The **fish weir** is passive, cheap (`log x2, reed x6`, no tool), capped, and only
    sited at a river mouth or tidal narrows. It's the purest early patience building. It
    degrades into *waste*, not walking.
  - The **fishing pier** is active, higher-yield, and costs a worker's day.
- **Hunting** is forest-coupled: game density depends on standing forest cover. Hunting and
  fishing are separate systems.
- **Clam beds** on the shore (see "Tending").

**Cooking is probably moot for goblins.** RESOURCES.md required a hearth and firewood for
fish, meat and grain. The fork says goblins don't need the hearth to eat. *Implied but never
stated:* cooking becomes a comfort upgrade (a hot meal) rather than a requirement. Confirm
before building it.

**Open:** does the decay layer **replace** the human food ladder, or sit underneath it as a
rugged baseline a settlement can climb off?

## Tending, not tilling: the farm system

**Decided.** Goblins don't till. Ploughing means destroy what's growing, plant one thing,
defend it, take all of it, start over: high control, high yield, high fragility. **Tending**
means nudging a system that's already running toward more of what you want.

So there's **no separate agriculture chapter**. Coppice, clam beds, tended root patches,
hazel and oak woodland, fungi on logs, and burning to keep the ground open *are* the
farming. **Wood pasture** is probably the name for the goblin landscape as a whole: trees
kept open, livestock beneath, nothing that looks like a field.

**The farm-depth question in RESOURCES.md (fields as a building, with fertility, or with
seasons and rotation) is moot.** Soil depletion, fallow and rotation have nothing to attach
to. What replaces them is **patch state**: maturity, tending level, and which species are
coming up. That's the same per-patch state burning needs, so the two systems merge.

The crops:

- **Hazel is the perfect goblin crop.** A hazel coppice yields poles *and* nuts on the same
  rotation.
- **Oak is the long game:** mast for pigs and goblins, tanbark for the tannery, and
  eventually timber.
- **Fungi on logs** is the fastest cycle, and nothing else in the genre has it.
- **Clam beds and clam gardens:** build a rock wall at the low-tide line and the shoreline
  becomes a farm. It's a sibling of the weir, but husbandry rather than a trap. Gated on
  shape depth.
- **Coppice** is a stand re-cut on rotation forever. It yields firewood and poles, never a
  timber log. It splits "forest" into two land uses. It's **gated on depth of forester
  shape**. Once it exists, weir stakes can be coppice poles instead of logs.
- **The tending continuum** replaces "forage is untended by definition": a patch you visit,
  then a patch you weed and burn, then a patch you plant. Camas beds are the historical
  case.

**Open:** do goblins ever get to annual crops, or is tillage permanently foreign to them, a
human thing admired or pitied from a distance?

### Burning

**The mechanic is carried over from RESOURCES.md. The tuning is changed by the goblin
fork.**

- **State: brush**, one accumulating value per forest patch that grows with elapsed time
  and needs no seasons. High brush slows walking (the hook, since walking is what the player
  watches), shades out berries, starves browse, and builds up fuel.
- **The verb:** a goblin walks out with a firebrand and sets a patch alight, with the same
  click-a-target interaction as chopping. It costs almost nothing in materials and a little
  nerve, because the patch yields nothing while it recovers.
- **Burn small and often.** A fire on low-brush ground is gentle. The lesson comes out of
  the mechanic without a tutorial.
- **Burned ground grows the best forage:** hazel, berries, oak mast, camas. Foraging becomes
  "make the land produce."
- **Ash feeds potash.** Brush is fuel that isn't firewood.
- **Ignition comes from your own industry.** Kilns and bloomeries next to a brushy forest
  are a risk from the settlement's own economy.
- It connects to **fire-and-wedge felling**, and to **mead**, because bees want flowers,
  which want open ground, which wants burning.

**Retuned for goblins (decided):** the human brief's catastrophe curve, where built-up fuel
leads to a destructive wildfire, is a punishment mechanic and **out of register**. Retune it
toward "the burn got away and made a mess, and everyone is put out for a season." Risk
should still be a smooth, visible function of neglect, and never random.

Other land-improvement practices in the same family, all real and none designed yet:
terra preta / biochar (runs on kiln charcoal), zai pits, chinampas, dew ponds, lazy beds.

## Livestock: pigs and goats

**Decided.** Both are the right animals for an economy without fields, for the same
historical reason they were the poor household's animals: **neither needs grain.** And
**your livestock threatens your farm.**

- **Pigs** turn waste and mast into meat. **Pannage**, turning pigs into the oak woods on the
  mast, links woodland to protein. But pigs *root*: a loose pig wrecks a fungus bed, a root
  patch or young coppice. Aimed at ground you *want* cleared and manured, the same behaviour
  improves the land. **Hurdles** (portable woven fence panels) are core, because fencing is
  how you point a pig.
- **Goats** browse young trees, bark and regrowth, so they're the classic enemy of coppice.
  In return they work rough, steep, rocky ground nothing else can use, and give **milk →
  cheese → comfort**.
- **Pollarding is the answer to goats.** Cut above browsing height and the herd grazes
  underneath without killing the regrowth. Pollard where the goats are and coppice where
  they aren't. It's a real spatial decision, and it makes wood pasture readable.
- **Silage** (fermented fodder) is how they eat through winter.

**The trouble stays cozy.** A goat in the mushroom shed, pigs in the nut coppice. Nobody
dies. A season's regrowth is lost, and somebody mentions it for a week.

## Fermentation, vessels and keeping

**Decided.** **Fermentation is controlled rot**, the same instinct as the fungus beds at a
different scale. Goblins don't fight decomposition, they steer it, as they steer woodland.
It's the **purest patience building**: set it up, walk away, and time does the work.

### The ferments

None of them need grain.

| Ferment | From | Why it matters |
| --- | --- | --- |
| **Mead** | honey | Bees want flowers, flowers want open ground, and open ground wants burning. The loop closes. |
| **Cider** | orchard and hedgerow fruit | A comfort good. |
| **Cheese** | goat milk | Really a storage building that renames the good: milk keeps a day, cheese keeps a year. |
| **Pickles, krauts** | vegetables in brine | Finally gives coastal **salt** a domestic job. |
| **Silage** | fodder | Feeds the livestock that feed the ground. |
| **Fermented fish** | fish | Historically near-universal and *extremely* pungent. A beloved building nobody wants to live downwind of, with a negative amenity radius like the retting pond. |
| **Koji** or similar | a cultivated mould | Fungi and fermentation in one building. A settlement that farms a mould on purpose is the most goblin thing available. |
| **Bog butter** | butter buried in peat | Real, and sometimes recovered centuries later. Underground keeping is already the goblin idiom. |
| **Fermented acorns** | acorns | A **comfort upgrade to a staple**, not a necessity. The comfort axis working as intended. |

### Vessels are the precondition for patience

**Decided.** You can't turn time into value without something to keep it in. Every ferment
lives in a vessel, so **`clay → kiln → pot` is the enabling technology of the whole goblin
economy**, not a minor branch of the earth chain. Position the kiln accordingly.

The keeping progression starts *before* pottery:

1. **Pit, clamp, bog.** Goblins dig, so underground keeping comes first and costs only
   labour. A **clamp** is roots heaped under straw and earth, near-free storage that loses a
   steady percentage.
2. **Pot.** Clay and a kiln. The first real vessel, and the point where ferments become
   controllable rather than opportunistic.
3. **Barrel.** Cooperage needs planks and hoops. Bigger, longer-keeping, movable.

Containers also solve awkward loads (see above).

### What makes it sing

- **The culture is an heirloom.** A starter, a mother, a barm: the crock in the corner that
  has to be fed. It's alive, it has a name, and somebody frets about it. It fills the same
  emotional slot as Murray's adze.
- **Failure is cozy.** A batch goes wrong, everyone is disappointed, and somebody mentions
  it for a week.
- **Terroir is a reason to trade that isn't scarcity.** Different valleys make different
  cheese. When trade eventually arrives, goblins trade because the neighbours' things are
  *different and good*, not because they lack iron. It's an alternative to the biome-locking
  rationale. Trade itself is still out of scope.

## Tools, salvage and metal

**Decided.** Scavenging is identity, not poverty. Goblins patch, repurpose and make do, and
they're **proud of it**. The larder framing keeps this on the right side of destitution.

- **Salvage is a resource:** worked metal, rope, nails and timber from coastal wreckage,
  ruins, and whatever the world left lying about. Goblins can use things they can't yet
  make.
- **Tools have history.** Not fungible gating items but *Murray's adze, mended twice*. Tools
  **wear and get repaired**, not replaced. **Mending is care, not attrition.** That revives
  the upkeep treadmill the human brief set aside: the tone rescued a mechanic the original
  tone had rejected. Mending counts as comfort.
- **Tools are heirlooms** and pass to an apprentice.
- **The bloomery is a graduation, and a generational one.** You scavenge iron you can't
  produce for a long time. Then one day a first smelter muddles through a working life of
  it, and *her apprentices* are the real thing. Smelting is a moment, not a tier on a tech
  tree.
- **Metal goes to tools only** (carried over): axe, saw, hoe, pick, net needle. Nothing
  becomes arms.

The iron chain is **built**, under human names: tree → log → kiln → 2 charcoal; bog → ore
pit → ore; ore + 2 charcoal → bloomery → iron bloom. It's what proved the task model.

## The antagonist: animal pressure

**Decided.** With weak goblins and no combat, pressure comes from **wildlife**: something in
the stores, crows at the food, something at the goats. You can't fight it, so you design
around it with fences, raised stores, **staddle stones** (now core, not a footnote), dogs
and noise. It's a non-violent antagonist that makes the whole storage and preservation layer
matter. Livestock damaging their own farm is the other half of the same register.

## The interface: grumbling is the HUD

**Decided.** Kingfisher's goblins complain constantly and affectionately. **Instead of an
alert panel, somebody says something.** Not `FOOD SHORTAGE`, but a goblin muttering that
there's been nothing but mushrooms for a week, and she's not complaining, mind, she's just
saying.

- Complaints are **specific and attributable** (who, and about what), **funny**, and
  **never nag the player**.
- Grumbling scales: mild grumbling is ambient texture, and the intensity and subject of the
  complaints *are* the status readout.
- It solves a real genre problem, readable settlement state without dashboards, and fits
  the minimal HUD.
- **Elder wants are voiced, not listed.**
- **Reassignment costs grumbling**, not a stat penalty.
- **The readout is the goblin.** Shape on the mesh replaces a skill panel.

Visual direction, **built as a dressing** (`?goblin`, or the swap button; see the end of
GOBLIN_FORK.md):

- peat light and close fog, with the camp ember the brightest thing on the island
- trees twice as tall and no wider, because goblins can't fell them
- shelf fungus and toadstools, so a tree reads as food before timber
- the bog and patch sites drawn, and spent stumps growing fungus
- a settlement that's a covered pit, a lean-to, a drying rack, hurdles and a fire
- a carried log longer than the goblin
- every line of copy grumbling ("Wedge. Mallet. Mutter. Repeat.")

The dressing is visual only. Crews, comfort, mending, livestock, ferments and lineage have
no simulation state yet.

## Out of scope

**Carried over, still out:**

- Combat, weapons, raiding.
- **Trade between settlements.** The only constraint for now: don't make raw materials
  uniform, and keep **shape as data that belongs to the goblin**, so it could travel.
  *Parked:* **fostering as trade**, where a child is sent to be raised by another
  settlement's elders, moving skill rather than goods.
- Jacobs-style runtime chain discovery.
- Flag-by-flag road building, tribes, and Widelands' numbers or data (licensing; see
  WIDELANDS.md).

**Parked, not rejected:**

- **Wants as small quests.** The lineage cycle throws off quest-shaped situations with no
  quest system: *the first* (nobody has the skill yet), *the successor* (she won't sit
  down until someone can hang a saw properly), *the last one who knows*, *the teacher from
  away* (a wandering elder stays a season if the village is comfortable enough), and *the
  odd kid* (raised by the sawyer, wants the goats). Whether wants come from rules or a
  hand-written table was deliberately deferred.
- **The global seasonal clock.** Nothing above needs one. Mast years, tides, the ice house
  and transhumance would want it. Build so it can be added later, and don't add it.
- The rest of the RESOURCES.md **vocabulary reservoir**. Entries that fit goblins
  especially well: clamp, staddle stones, hurdles, pannage and mast, retting pond, tanbark,
  potash, charcoal burner's watch, bodger, quern, warren. **Selection criterion for any new
  entry:** it's real and specific, it carries a mechanic, it teaches something by existing,
  and ideally it makes terrain or timing matter.

## What the goblin premise overturns in RESOURCES.md

Read RESOURCES.md for anything not listed here. It still holds.

| RESOURCES.md said | Under goblins |
| --- | --- |
| Meal variety is the growth currency | **Comfort**, per goblin, concentrated in elders |
| The hearth is for survival and cooking | The hearth is for small comforts |
| Firewood taxes eating | Firewood taxes **industry** |
| Carry capacity is a shrinking number | **Awkward loads** needing two carriers |
| Forage means gathering what grows | Eating the **decay layer** |
| Mast years can't be incorporated | Mast is a first-class event |
| Tools are replaced when worn | Tools are **mended** and carry identity |
| Wildfire catastrophe curve | Retuned to "the burn got away, a season is lost" |
| Land improvement is a parked direction | Land improvement **is** the farm system |
| Farm depth (a/b/c) is open | Moot. Patch state replaces fertility and rotation |
| Preservation is a reservoir footnote | Preservation is the **spine** |
| Pots are a minor earth-chain branch | Pots are the **enabling technology** |
| Trade rationale is biome scarcity | **Terroir** and difference (trade still deferred) |
| No progression or skill model | **Shape and lines** |
| Coppice, mulberry-dike pond, clam gardens parked on skill | Gated on depth of shape |
| Three sinks | Possibly four, with **the bench** |
| Bloomery unlocked as a building | A **generational graduation** |
| A fixed cast of villagers | A population with **life stages** and arrivals |

PRODUCTION.md's farm plan (till / sow / reap, field with fertility) is therefore **not the
goblin plan**. Its task model still is: plots become coppice stools, fungus logs, clam beds
and tended patches, with the same site-and-task machinery.

## Where the code is today

The simulation lives in `src/sim/` and knows nothing about goblins. The goblin dressing is
`src/theme.ts` plus branches in `src/scene.ts`. As of this writing:

- **Rule engine:** deterministic, plain JSON, fixed **1/30 s tick**, seed in the state,
  commands in and events out, `serialize`/`deserialize` as the persistence boundary (format
  version 8). See [RULE_ENGINE.md](RULE_ENGINE.md).
- **Rulebooks:** `settlement` (the browser: one villager, click a tree), `hauling` (an
  experiment), and `village` (`bin/play` default: the economy).
- **Sites:** `tree`, `patch` (forage), `bog` (iron). Regrowth is per site kind.
- **Buildings:** lumberjack hut, forager's hut, sawmill, ore pit, kiln, bloomery. Each is a
  row in the task table in `src/sim/tuning.ts`.
- **Logistics:** pull (stationed worker fetches a load of up to `CARRY_LOAD` = 4), errands
  for loose wares, `spare` reserves in-flight fetches, and a day roll every 120 s where
  workers clock on and take their tool.
- **Labour:** assigned manually (`hire`). Roles `hand`, `feller` and `carrier` exist but
  aren't used in play.
- **Not built:** upkeep and brown-out, eating, comfort, any per-goblin state beyond
  position and job, ages, shape, crews and pair carries, patient buildings, vessels,
  livestock, brush and burning, mending.

### Constraints for anything new

- Deterministic, plain JSON, integers where possible, and no frame-rate-dependent
  accumulation. Anything new (shape, age, comfort, brush, ferment progress) must survive
  save and load and `hashWorld` equality.
- **A goblin is a record.** Shape is a **record keyed by axis id**, so axes can be added
  without a rewrite.
- **Recipes, upkeep, elder wants and the good-to-dial mapping are data**, like the task
  table.
- **Forest and land state are per site.**
- **Age is a per-goblin counter**, not a calendar.
- Rule names, wares and events follow the vocabulary in RULE_ENGINE.md: *ware*, *site*,
  *task*, *pile*, *job*. Don't say *resource* or *harvest*.
- Design in the terminal first (`bin/play`), then play the browser build. The project's
  standing lesson is that headless tests pass while the page is broken.

## Open questions, in priority order

1. **Who assigns labour?** An automatic allocator with a player pin, or manual? Protecting
   the line depends on the answer. **Settle this first.**
2. **How much of the game is waiting?** What carries moment-to-moment play: siting,
   hauling, crews, grumbling? The biggest design risk.
3. **What are the shape axes?** One per trade, or a small set of shared body traits several
   trades draw on? Shared traits give blends; per-trade is easier to read.
4. **Is the bench a fourth sink beside the table, or does it replace the table?** And do
   workers and children carry comfort, or only elders?
5. **Where do children come from?** Presumably comfort brings arrivals, but this was never
   discussed.
6. **What happens to very old elders?** If they pile up forever, comfort demand grows
   without bound. That may be the intended slow brown-out, or a problem.
7. **Timings:** length of a working life and a childhood in play time, the inheritance
   fraction, whether fidelity caps below the elder's full shape, and children per elder at
   base and at best.
8. **Can adult workers retrain**, and how much slower than a child?
9. **Prioritise an elder, send them their want, or both?** And are wants authored per
   elder, drawn from a table, or derived from the trade they worked?
10. **Does the decay layer replace the human food ladder** or sit beneath it? Do goblins
    ever reach annual crops?
11. **How much does "weaker" cost** beyond awkward loads? Avoid the "everything just takes
    longer" version.
12. **How does a patient building run** without a worker, and who loads and empties it?
    Never discussed. The pull and errand model is the obvious starting point.
13. **One worker per building, or several?** (From PRODUCTION.md.) Crews make this sharper.
    Several goblins per building may be the default rather than the exception.
14. **Does fetching stay visible forever** at scale? (From RESOURCES.md.)
15. **Is cooking a requirement for any food** under goblins, or purely a comfort?

## Sources

| Document | What it holds |
| --- | --- |
| [RESOURCES.md](RESOURCES.md) | The original human-villager brief: sinks, raw resources, food ladder, pull, burning, the vocabulary reservoir |
| [PRODUCTION.md](PRODUCTION.md) | The task-and-site model, the iron chain, pull measured, the human farm plan |
| [GOBLIN_FORK.md](GOBLIN_FORK.md) | The goblin premise, the patience thesis, five pillars, tending, livestock, fermentation, the visual dressing |
| [LINEAGE.md](LINEAGE.md) | Shape, three ages, apprenticeship, protecting the line, the bench |
| [WIDELANDS.md](WIDELANDS.md) | The reference economy, the carrier experiment, the licensing line |
| [RULE_ENGINE.md](RULE_ENGINE.md) | Vocabulary, rules, tick, commands, events, saving |

Keep this document current. When a question above is answered, move the answer into the
body, mark it **Decided**, and note which older document it overrides.
