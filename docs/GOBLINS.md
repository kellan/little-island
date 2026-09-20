# The goblin fork

Status: **a forked exploration, not a decision.** This branches off
[RESOURCES.md](RESOURCES.md) and asks what changes if the villagers are goblins rather
than people. It is written up because the fork turned out to change the economy, not just
the art — and because several things in the main brief read *better* under it.

Nothing here supersedes RESOURCES.md. The last section lists precisely which decisions
the fork would overturn if it were taken, so the two documents can be read together
without confusion.

## The premise

Goblins: small humanoids, **weaker** than humans, **hardier** (they endure conditions that
would break a person), and possessed of a **much wider diet**.

Tone is the load-bearing decision, and it is a specific one:

- **T. Kingfisher's *Nine Goblins*** for character. Found family. A squad who grumble
  incessantly and look after each other completely. Competence that does not look like
  competence, and muddles through anyway. Nobody is a hero; everybody is a bit put-upon.
- **GURPS Goblins** for the idea that goblins have an entire *society* — trades,
  institutions, professions, civic life — rather than being a monster entry. But that
  book is Hogarthian black comedy, and this is not that.
- **Cozy** is the instruction that reconciles them: keep GURPS's society, drop its cruelty.

The single framing that makes the whole thing work:

> **A well-run larder, not a garbage dump.**

Goblins are not disgusting. They are **unfussy**. Nothing goes to waste and they are
rather pleased about it. Frugality read as warmth. A goblin settlement with a tidy pantry
and a well-organised junk pile is a *successful* one, and it should look it.

**What cozy forbids.** Failure is inconvenience, not catastrophe. A settlement that
overreaches gets tired and grumpy, never dead. No starvation spirals, no punishment for
experimenting, no losing an hour's work to an event you could not see coming.

## The five pillars

### 1. Teamwork is required, not optional

Goblins are weak, so hauling changes — and the good version is not "carries less" but
**awkward loads**. A log is not heavy for a goblin, it is *unwieldy*. It takes two, one at
each end, staggering.

Some goods therefore require a **pair**, which gates hauling on labour availability in a
lumpy, visible way, and makes the handcart or travois a genuinely exciting early invention
rather than a late optimisation.

Under Kingfisher's tone this stops being a constraint and becomes the thing you watch.
Two goblins carrying one log is a friendship. So the unit of organisation is the **crew**,
not the assignment: small groups who work together, walk together, and mind each other.

It also means goblins cannot fell a great tree early on. The forest reads as *deadfall and
saplings yes, mature oak no*, which promotes a **deadfall and windthrow economy** — 
gathering what is already down — from a footnote to the primary early strategy. When
felling does arrive it arrives as **fire and wedge** rather than a big axe, which is how it
was done before good steel, and which hooks directly into the land-improvement section of
the main brief.

### 2. Comfort is the goal

**This replaces meal variety as the growth currency**, and it is the most consequential
change in the fork.

Meal variety is the Outlanders mechanic and it works beautifully for fussy humans. It does
not work for goblins, because variety is *cheap* for something that eats anything. It
cannot be the thing a settlement strives for.

**Comfort** can. A dry place. A hot drink. Your friends nearby. Your things mended. Comfort
is what a goblin settlement accumulates instead of cuisine, and it is a far better fit for
the tone besides.

Consequences:

- The **hearth changes job** — from nutrition to small comforts. Goblins do not need it to
  survive the night or to eat.
- The **ale / tea / cider slot stops being flavour and becomes the actual sink.** A
  comfort good does nothing for survival and everything for morale, which is exactly what
  a goblin economy should be producing at its apex.
- **Mending counts as comfort.** See pillar 4.

### 3. Fungi, and the decay layer

The wide diet rewrites the food ladder from the bottom. Goblins eat what humans discard:
fungi, grubs, carrion, bark, offal, bone marrow, acorns.

So the goblin food economy **runs on decomposition**, which means it runs on the byproducts
of everything else:

- **Fungi cultivated on spent logs and sawpit waste.** The sawmill's offcuts become a food
  building. This is the flagship: a production chain whose input is another chain's rubbish.
- **Grubs and insects** from deadfall and rot — the same rotting wood a human settlement
  would merely find untidy.
- **Bones and offal** from hunting, which a human chain throws away.
- **Acorns.** Humans must leach the tannins out over days before acorns are edible. Goblins
  simply eat them.

That last one **un-parks mast.** RESOURCES.md files mast years as interesting but
un-incorporable, because an irregular multi-year acorn glut had nothing to attach to. If
oak woodland is a direct staple rather than a pig-feed detour, an unpredictable glut of the
*primary food* is a first-class event, not a curiosity.

The ladder's aspiration also inverts. For humans, forage → fish → hunt → farm is a climb
toward control. For goblins the baseline is decomposition — abundant, reliable, unfussy —
and the aspirational food is the stuff humans eat. That is a much stranger shape than
"the same game, greener."

### 4. Scavenging, as identity rather than poverty

Goblins patch, repurpose, and make do, and are **proud of it**. Handled right this is the
warmest thing in the fork; handled wrong it reads as destitution. The larder framing is
what keeps it on the right side.

- **Salvage is a resource.** Worked metal, rope, nails, timber — from wreckage on the
  coast, from ruins, from whatever the world left lying about. Goblins can use things they
  cannot yet make.
- **Which gives the bloomery an arc.** You scavenge iron you cannot produce, for a long
  time, until one day you can. Smelting becomes a **graduation** rather than a tier on a
  tech tree. That is a much better moment than unlocking a building.
- **Tools have history.** Not fungible gating items but *Murray's adze, mended twice*.
  Tools **wear and are repaired**, not replaced.

That last point quietly revives the upkeep-treadmill idea that the main brief's first
conversation considered and set aside. In a cozy register the identical mechanic reads
completely differently: **mending is care, not attrition.** Worth noticing that the tone
rescued a mechanic the tone of the original had rejected.

### 5. Grumbling is the HUD

Kingfisher's goblins complain constantly and affectionately, and it is the warmest thing
about them.

So: **instead of an alert panel, somebody says something.** Not `FOOD SHORTAGE` but a
goblin muttering that there has been nothing but mushrooms for a week and she is not
complaining, mind, she is just saying.

This is charming, and it also solves a real genre interface problem — legible settlement
state without dashboards — which suits the minimal HUD this project is already aiming at.
Grumbling scales naturally, too: mild grumbling is ambient texture, and the intensity and
subject of complaints *is* the status readout.

Design notes: complaints should be specific and attributable (who, about what), should
never read as nagging the player, and should be funny. A goblin who has been hauling all
week should say so.

## Supporting consequences

- **Villagers are named persons, not units.** Kingfisher's goblins are individuals with
  grievances. The simulation should be legible as "Gnarlfoot is cross because he has
  hauled all week," never "worker 37: idle." The prototype already names Robin, so this is
  a push rather than a departure.
- **Buildings are shops with proprietors.** The GURPS half. Not "sawpit" but Grubwick's
  sawpit, and Grubwick has opinions about elm. Costs a name and a line of flavour; buys a
  great deal.
- **The firewood tax moves off food and onto industry.** Goblins do not need a hearth to
  survive or to eat, but smelting, pottery and charcoal still need fire. Arguably cleaner
  than the human version: the universal cost lands on industry rather than on dinner.
- **Animal pressure is the antagonist.** Weak, with no combat in the design, expresses
  itself as wildlife: something in the stores, crows in the grain, something at the goats.
  You cannot fight it, so you design around it — fences, elevated granaries, **staddle
  stones** (which stop being a charming footnote and become core), dogs, noise. A
  non-violent antagonist that makes the whole storage and preservation layer matter.
- **Goblins dig.** Stores go underground, so the **clamp** from the reservoir becomes a
  core mechanic and cold storage arrives without an ice house.

## What this fork would overturn in RESOURCES.md

Listed plainly, because these are written down as settled there:

1. **Meal variety → comfort** as the growth currency. The largest change.
2. **The hearth's job** — survival and nutrition → small comforts.
3. **Firewood** — a tax on eating → a tax on industry.
4. **Carry capacity** — a number that shrinks → **awkward loads** needing two carriers.
5. **The forage baseline** — gathering what grows → eating the decay layer.
6. **Mast** — parked as un-incorporable → viable, and a first-class event.
7. **Tools** — replaced when worn → mended, and carrying identity.
8. **The wildfire curve** — fuel accumulating to catastrophe is a punishment mechanic and
   is out of register. Re-tune toward "the burn got away and made a mess and everyone is
   put out for a season." Note that the slow brown-out from overbuilding is *already*
   exactly right for cozy and needs no change.

## Open questions

- Does the decay-layer economy **replace** the human food ladder, or sit underneath it as
  a rugged baseline the settlement can climb off?
- Do goblins farm at all, or is farming the aspirational human thing they are working
  toward? This decides whether the farm-depth question in the main brief still matters.
- How much does "weaker" cost in practice? Awkward loads are the charming version. There
  is presumably a less charming version where everything simply takes longer, and that is
  worth avoiding.
- Comfort needs a shape. Is it a stock, a rate, or a per-goblin state? The main brief's
  three sinks (table, site, hand) were built around meal variety; comfort may want a
  fourth, or may replace the table outright.
