# IDEAS — Age bands, callout generation, and IOL exposure

**Status:** captured for review in a new session. Nothing decided, nothing built.
**Recorded:** 2026-08-02 · **Origin:** brainstorm session following PR #18.

> These five ideas are saved **verbatim** as they were put to the user, together with
> the domain facts that produced them and the one open fork. Review them as a set —
> idea 1 is the enabler and the rest depend on it.

---

## The domain facts these rest on (from the user)

- Associates determine whether a pallet is dwelling, and for how long, using **tools
  external to this one**. The age data therefore already exists at the moment of counting.
- They **only record pallets 3 days or older**. The 3-day floor is already baked into what
  "dwelling" means here.
- Pallets **25 days or older** get an additional callout on the org's communication
  channels — done manually today.
- Inventory dwelling **30 days or more** populates/flags against the **IOL metric**.

## The reframe

That changes the shape of the whole tool. Three things fall out of what you just described:

**The age data already exists at count time** — the associate has it from the external tool
the moment they decide a pallet qualifies. The current form then throws it away, collapsing
everything into one number. That's not a data-collection problem, it's a data-discarding one.

**The buckets aren't mine to invent — you already have them.** 3 days (the recording floor),
25 days (callout), 30 days (IOL). Those are org policy, not a modelling choice.

**And the heat map is currently optimising for the wrong thing.** Volume is a proxy; the real
objective is *don't let anything reach 30 days*. An area with 40 pallets all at four days is
fine. An area with three pallets at 29 days is an emergency — and today it paints near-grey
while the healthy one paints red. The tool can't see the thing it exists to prevent.

---

## The five ideas (verbatim)

**1. Record three numbers instead of one.** 3–24 / 25–29 / 30+. The entry form has a single
numeric field today; making it three is a small change, the total stays the sum (so exports
and roll-ups degrade gracefully), and every downstream feature gets the dimension for free.
This is the enabling change for everything below.

**2. Colour by worst band, not by volume.** Grey = nothing recorded, green = only 3–24,
amber = holds 25–29 (callout due), red = holds 30+ (IOL hit). Note what this gets you
incidentally: an **absolute, fixed scale with no normalisation at all** — the floating-scale
problem I raised earlier disappears, with zero capacity data needed. This is better *and*
cheaper than both the relative colouring you have and the per-department targets I suggested
last turn.

**3. Generate the 25+ callout.** You already do this by hand on comms channels every count.
If the tool knows which areas hold 25–29 day pallets, it can produce the message — areas,
I-beam locations, counts — as copy-ready text. Automating a task that's currently manual and
recurring is the highest-confidence value in this whole brainstorm.

**4. Forward-looking IOL exposure.** Anything in the 25–29 band hits IOL within one to five
days. So the tool can state "14 pallets across 4 areas will hit IOL this week unless cleared"
— a forecast, where everything the tool says today is retrospective. And across two counts you
can watch the 25–29 band either drain or roll into 30+, which measures whether the callout
process actually works.

**5. Thresholds as config, not constants.** 3/25/30 are policy and the blank BAM editor ships
to other sites. They belong in the bundle, editable in the editor.

## Ranking as given

Ranked: **1 is the unlock, 2 and 3 are what you'd build on it immediately**, 4 is the payoff
that makes it a management tool rather than a counting tool.

## The open fork — answer this before scoping any of it

One fork I can't resolve from here, and it's a real one: **is the 25+ callout per-area or
per-pallet?** If the message needs to name specific pallets (LPN or licence plate), then
counts aren't sufficient and the tool needs pallet-level records — a much bigger change than
three numbers per area. If the callout is "Docksort J17 has four pallets aging into the
window," counts are enough and idea 3 is small.

---

## Notes for whoever picks this up

- **This supersedes part of the capacity idea.** See `CAPACITY-AND-UTILIZATION.md`: for the
  *dwelling* tool, band colouring (idea 2) beats both today's relative-volume colouring and
  the per-department-target suggestion, needs no capacity dataset, and gives an absolute
  scale for free. Capacity/utilisation remains the right idea for the planned **sibling
  total-pallet tool**, not this one.
- **Where idea 1 lands in the code:** the single count field is `form.js:43`; counts are
  stored as a flat `{areaId: count}` (`storage.js:4`) and exported the same way
  (`importexport.js:56`). Moving to three bands is a payload-shape change — bump
  `COUNTS_KEY_VERSION` and migrate in `loadCounts`, and bump `SCHEMA_VERSION` with a
  `MIGRATIONS` entry for the export/bundle shape (`schema.js:18`). Both mechanisms exist
  and are unused so far.
- **Where idea 2 lands:** `heatmap.js` is pure and unit-tested. Band colouring does not use
  `positiveExtent()` at all, so it is a mode alongside the existing ramp rather than a
  rewrite of it. `legend.js` becomes a fixed four-state key instead of a floating ramp.
- **Idea 5 interacts with the standalone build:** thresholds in the seed flow through
  `assembleSeed()` and the `OPERATOR_TEMPLATE` token fill (`opbuild.js:10-11`) automatically.
- **"Uncounted vs. empty" gets more valuable under this model,** not less: with a 3-day
  recording floor, an area with nothing recorded is genuinely clean — a result worth seeing —
  and today it is indistinguishable from an area nobody walked.
