# The lineage fork

Status: **a forked exploration, not a decision.** This branches off [GOBLINS.md](GOBLINS.md)
(not in this repo yet) and assumes the goblin fork is taken. It asks what happens if goblins
are Lamarckian: shaped by their work, and able to hand that shape on. Nothing here is
implemented. Where it says "open", do not guess — ask.

It is written up because the idea turned out to supply something [RESOURCES.md](RESOURCES.md)
says the design is missing — a settlement skill concept — and to give comfort, the goblin
fork's growth currency, an actual mechanism.

The doc separates what was decided in conversation from what is only suggested. Suggestions
are marked. Treat them as proposals to react to, not as spec.

## The premise

Goblins are shaped by what they do. A goblin who saws for years becomes sawyer-shaped: the
stoop, the forearms, the squint. That shape makes them better at the work, and it is visible
on the model. A glance at the village tells you what it has been doing for the last decade.

The mechanism is borrowed from GURPS Goblins, where goblins are born alike and their
upbringing and trade remake them. That book does it through cruelty. This does not. Here
goblins are shaped by practice and care, the way a tool handle wears smooth.

It is pillar 4 of the goblin fork applied to people. *Murray's adze, mended twice* and
*Murray's adze-arm* are the same idea: things carry their history and wear toward their use.

The single framing that makes the rest work:

> **Knowledge exists only in bodies.**

There is no tech tree, no library, no research building. There are only goblins who have done
the thing, and the goblins they raised.

## Decided in conversation

- **Children and growing up are core.** The genre wants them, and childhood is where the
  shaping matters most.
- **Three ages: child, worker, elder.** Elders are both the apex sink (they want comfort and
  produce no goods) and the repository of skill (they are the only way a shape gets handed
  on).
- **Apprenticeship.** A child raised by an elder picks up that elder's shape.
- **Automatic by default, improvement by attention.** Apprentices are assigned
  automatically. Left alone, that keeps the village running. Getting better generation after
  generation requires the player's active engagement.
- **The core verb is protecting the line** (see below), chosen over two alternatives recorded
  later in this doc.
- **Retirement is automatic**, with the option to promote a worker to elder early.
- **Too few elders means mush.** Children with no elder to mind them grow up as generalists.
- **Elders have wants**, and meeting them is how the player steers. See "The bench".

## Shape

*Suggested model.*

A goblin's shape is a small set of integer values, one per axis. Doing a kind of work adds to
the relevant axes, tick by tick. Shape drives two things from the same numbers:

- efficiency at work that draws on those axes
- the mesh: stoop, arm length, hand size, ear size, eye size, colouring

One set of numbers for both is the point. **The readout is the goblin.** No skill panel is
needed to know who the sawyer is.

**Mush** is the low, even shape: a bit of everything, nothing deep. Mush is adequate. A
village of mush goblins works, eats, and is reasonably content. It never excels and never
unlocks the practices that need depth. Mush is a plateau, not a failure, which is what the
cozy register requires.

No genetic model is needed. There are no hidden genes and no recombination. A shape is
copied, at a discount, from the elder who raised you.

## Three ages

**Child.** Minded by one elder. Plastic. A child starts their working life with a fraction of
their elder's shape. With no elder available, they start as mush.

**Worker.** Keeps accumulating shape through work, and can pass their teacher. This is the
Lamarckian ratchet: each generation of a well-kept line starts a little higher than the last
and ends higher still.

**Elder.** Shape freezes and becomes teachable. Elders stop producing goods. They mind
children, and they want to be comfortable.

Nobody dies on screen. The workforce rolls over because workers become elders, not because
goblins are lost. *Suggested:* what eventually happens to very old elders is left open below.

Retirement happens on its own with age. The player may also **promote a worker to elder
early**. That is a real trade: a master sawyer still at the pit produces planks; sat down,
she produces sawyers. Early promotion also freezes her shape where it stands, so an elder
promoted young teaches a shallower shape than she would have reached.

## Firsts are self-taught

Nobody can teach a trade until somebody has muddled through a working life of it. The first
smelter is slow and grumbly and works from scavenged iron. Her apprentices are the real
thing.

This makes the bloomery "graduation" in GOBLINS.md **generational**, which is a better moment
still. It also means a lapsed line is recoverable: someone can always be the first again.

## The core verb: protecting the line

A line is a chain of custody for a shape. For the ratchet to turn, every link has to hold:

1. the child is raised by an elder with the shape
2. the child then works that trade
3. for long enough to pass their teacher
4. and retires with time left to teach
5. and is comfortable enough, as an elder, to teach well

Each link can be broken by short-term need. Hauling is short this week, so the sawyer-raised
kid gets sent to haul. The pit needs planks, so the master sawyer is kept working until she
has no teaching years left. The village is cold, so the elders teach badly.

**The player's job is to defend long-term shape against this week's shortage.** It is the
same tradeoff at every life stage: output now against capability later.

This fits the frame RESOURCES.md already uses for preservation. Cheese, salt fish, and ice
move goods through time. Elders are the same thing for skill: batteries.

The default produces adequate mush. Attention produces lineages.

**ASSUMPTION, NOT CONFIRMED.** This section assumes labour is assigned by an automatic
allocator that the player can override, and that the override is something like a pin ("keep
her at the sawpit"). RESOURCES.md describes stationed work and errands but does not say who
does the stationing. If assignment is fully manual, protecting the line reduces to "do not
reassign people" and the mechanic is much thinner. **Ask before building on this.**

## The bench

*The mechanic is decided. The name and the fourth-sink framing are suggested.*

Each elder has things they want in order to be comfortable, and the wants differ from elder
to elder. Meeting them does two separate things:

- **Capacity** — how many children the elder can mind.
- **Fidelity** — how well they teach: how much of their shape the child inherits.

Different goods feed different dials, and which goods feed which dial differs per elder. For
one elder a hot drink buys capacity and a mended tool hung where she can see it buys
fidelity. For another it is the reverse, or different goods entirely.

The player engages in two ways:

- **Prioritising an elder**, so the settlement's comfort goods reach them first.
- Possibly **explicitly sending** an elder the thing they asked for.

This is how the player steers which lines grow. Comfort stops being a village-wide meter and
becomes targeted investment: you are choosing which old goblin's knowledge the settlement
carries forward, and how faithfully.

It also answers the open question in GOBLINS.md, "comfort needs a shape." Under this fork
comfort is a **per-goblin state**, concentrated in elders, and it has a job beyond being a
sink: it converts the settlement's past into its future.

*Suggested:* RESOURCES.md has three sinks, the table, the site, and the hand. This may be the
fourth: **the bench**. Whether it sits beside the table or replaces it is the same open
question GOBLINS.md already asks.

*Suggested:* elder wants create **directed demand** — a specific good to a specific goblin.
Elders do not fetch. Under the pull model that makes this an errand, or, more charmingly, the
children fetch for their elder, which puts the whole relationship on screen.

Per pillar 5, elder wants are **voiced, not listed**. The elder says what she is missing.

## Supporting consequences

- **This is the missing settlement-skill concept.** RESOURCES.md parks coppice, the
  mulberry-dike fish pond, and clam gardens because there is no way for a settlement to get
  better at something, and says inventing a skill system just for coppice would be the tail
  wagging the dog. Under this fork, coppice arrives when the settlement has enough depth of
  forester shape. No separate system.
- **A mature village looks different, not just bigger.** Old goblins on benches. Workers
  visibly shaped by their trades. RESOURCES.md asks for exactly this.
- **Reassignment cost is grumbling.** A hauler-shaped goblin put on the loom is not penalised
  by a number. She says something about it. Specific, attributable, funny.
- **Tools become heirlooms.** Murray's adze outlives Murray's working life and goes to his
  apprentice.
- **Aging needs a per-goblin counter, not a calendar.** This fork does not drag in the global
  seasonal clock that RESOURCES.md leaves open.

## Alternatives considered

Three ways of making apprenticeship an active decision were on the table. "Protecting the
line" was chosen. The other two are recorded because they may layer on later.

- **Matchmaking.** When a child arrives the player chooses their elder; the default is the
  nearest free one. The scarce resource is the best teachers' attention. Simple, rare, and
  weighty. A natural explicit override.
- **Placement as upbringing.** No assignment at all. Children absorb whatever they spend time
  near, so the player steers by where the elders' bench is built. Fits "placement becomes the
  gameplay" and the minimal HUD, and gives blended shapes for free. A natural ambient
  default.

Also considered and **rejected**:

- **Heritable bloodlines.** Children inheriting from parents drifts toward castes and
  determinism, which is out of register. Kingfisher's found family points the other way: you
  take the shape of who raised you, not who bore you.
- **A genetic model.** Unnecessary. See "Shape".

## Parked

- **Wants as small quests.** The cycle throws off quest-shaped situations without a quest
  system: the first (nobody has the skill yet), the successor (she will not sit down until
  someone can hang a saw properly), the last one who knows, the teacher from away (a
  wandering elder stays a season if the village is comfortable enough), and the odd kid
  (raised by the sawyer, wants the goats). Whether wants are generated from rules or drawn
  from a hand-written table was raised and deliberately deferred as orthogonal.
- **Fostering as trade.** Elders stay put; children can travel. Sending a child to be raised
  by another settlement's elders is a form of trade that moves skill rather than goods. Trade
  is out of scope in RESOURCES.md and stays out of scope here. One constraint only: shape
  must be data that belongs to the goblin, so that it can travel with them.

## What this fork would overturn or add

1. "There is no progression or skill model in the design" (RESOURCES.md) → shape and lines
   are one.
2. Coppice, mulberry-dike pond, clam gardens — parked on settlement skill → un-parked, gated
   on depth of shape.
3. Comfort — an open question about stock, rate, or state → a per-elder state with two dials,
   capacity and fidelity.
4. The three sinks → possibly four.
5. The bloomery graduation → generational rather than a single moment.
6. Villagers — a fixed cast → a population with life stages and arrivals.
7. Labour assignment → needs an allocator and a pin, if the assumption above holds.

## Notes for the rules engine

- Shape, age, and elder comfort must respect the existing constraints: deterministic, plain
  JSON, fixed 1/60 step, integers, no frame-rate-dependent accumulation.
- **A goblin is a record, never a count.** `villagers: number` would foreclose all of this,
  the same way a global `trees remaining` would foreclose brush and coppice.
- Shape wants to be a record keyed by axis id, so axes can be added without a rewrite.
- Elder wants, and which dial each good feeds, should be **data**, like recipes.

## Open questions

- **Who assigns labour?** Automatic allocator with a player pin, or manual? See the
  assumption above. This is the first thing to settle.
- **What are the axes?** One per trade, or a smaller set of shared body traits that several
  trades draw on? Shared traits give blends and hybrids; per-trade is simpler to read.
- How long is a working life in play time, and how long is childhood?
- What is the inheritance fraction, and does fidelity cap below the elder's full shape?
- How many children can an elder mind at base, and at best?
- Where do children come from? Presumably comfort brings arrivals, since comfort is the
  growth currency. Not discussed.
- What happens to elders eventually? If they accumulate forever, comfort demand grows without
  bound. That may be the intended slow brown-out pressure, or it may be a problem.
- Can adult workers retrain, and how much slower than a child?
- Prioritise, or explicitly send? Both were floated for elder wants. Either, or both?
- Are an elder's wants authored per elder, drawn from a table, or derived from the trade they
  worked?
