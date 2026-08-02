# IDEA — Area capacity, and utilisation colouring

**Status:** deferred, not started. No code exists for this.
**Recorded:** 2026-08-01 · **Origin:** brainstorm session, after PR #18 merged.

---

## The one thing to understand before building any of this

**The current tool counts *dwelling* pallets, not total pallets.** That single fact
decides where each half of this idea belongs, and it is easy to get wrong on a quick
read of `heatmap.js`.

A dwelling pallet is aged/stuck inventory. So in *this* tool:

- `count / capacity` is **not** utilisation. It is *dwelling density* — the share of a
  buffer occupied by stuck stock.
- A buffer can be **100% physically full with zero dwelling pallets** (healthy, fast-moving),
  or **10% full and entirely dwelling** (small but completely stagnant).
- Colouring this tool's map by `count / capacity` and labelling it "% full" would be
  actively misleading.

The user intends to build **a sibling tool** — same floor plan, same areas, same editor —
where the operator counts **total pallets per area**. In *that* tool `count / capacity` is
exactly right: "% of buffer filled," a fixed 0–100% scale, physically meaningful.

**So: capacity is a shared data attribute worth adding early. Utilisation colouring belongs
to the sibling tool.** Don't ship utilisation colouring as the primary mode of the dwelling
map.

---

## Why capacity is worth adding to the shared model regardless

Capacity is a physical property of an area — how many pallet positions it holds. It is
authored once in the Building Area Manager and travels in the project bundle that *both*
tools are generated from. Adding the field now means:

- The sibling tool inherits a populated capacity dataset on day one instead of starting
  with a 74-area data-entry gate.
- The dwelling tool gets a genuinely useful secondary metric immediately — see below.

## What capacity buys the *dwelling* tool (legitimately)

Not colouring. Context and ratio:

- **Dwelling density per area.** 40 dwelling pallets in a 50-slot buffer is a crisis;
  40 in a 500-slot buffer is noise. Today the map paints both the same, because colour
  is normalised against the day's other counts and knows nothing about buffer size.
- **Department roll-up with a denominator.** `breakdown.js` already sums counts per
  department (`:21`); summing capacities alongside gives "Docksort: 412 dwelling / 500
  positions — 82% dwelling." That is arguably the highest-value output here and it is
  nearly free.
- **Replaces a weak stat.** `panel.js:28` currently shows "% of all pallets" — an area's
  share of the building total. Knowing an area holds 3% of all dwelling pallets is not
  actionable; knowing it is 82% dwelling is.
- **Import validation.** `validate.js` can flag counts exceeding capacity — a data-quality
  check that does not exist today.

## What capacity buys the *sibling* (total-pallet) tool

The full idea: colour = `count / capacity`, clamped 0–1.

Two defects of the current colouring disappear:

1. **Colour becomes physical.** Today `colorForCount()` normalises against
   `positiveExtent()` — the min/max of the day's positive counts. A small staging nook and
   a long rack bay both holding 40 pallets get the same red, though one is overflowing and
   the other is half empty. The map shows where stock *is*, never where there is *room* —
   and "where does the next inbound go" is the operational question.
2. **The scale stops floating.** `positiveExtent()` recomputes every render, so the same
   area with the same 40 pallets is green one day and red the next depending on what else
   got counted. Colours are not comparable across days, floors, or two exported snapshots.
   (This also quietly undermines any future compare-two-exports feature — it would be
   comparing two differently-scaled pictures.)

Utilisation is absolute, bounded, and stable over time.

---

## Implementation notes

### Data model
- Add an optional integer `capacity` to the area record. Today an area is
  `{id, name, departmentId, iBeamLocation, mapRegionId, floorId}` — 74 of them in
  `app/data/areas.json`.
- Bump `SCHEMA_VERSION` and register the first entry in `MIGRATIONS` (`app/js/schema.js:18`
  is empty and was written for exactly this). `resolveProjectBundle()` already handles
  older and newer bundles.

### BAM editor
- A capacity input in the area attribute panel alongside x/y/w/h.
- It rides through save/load and `assembleSeed()` **for free** — those all spread `{...a}`.
- Add a coverage nag: "12 areas on this floor have no capacity."

### heatmap.js
- Pure module, already unit-tested — the utilisation maths is the cheapest thing in the app
  to cover.
- Utilisation mode ignores `extent` entirely: `colorForRatio(count / capacity)`.
- **Decide what happens above 100%.** Clamping to red hides the difference between "full"
  and "over-stuffed," which are operationally different. Give over-capacity its own
  treatment (distinct hatch, or a darker-than-red band).

### legend.js
- Today it renders a floating `low (min) → high (max)` from the current extent.
- Under utilisation it becomes a fixed 0% → 100% ramp — strictly simpler, and it is what
  makes the map readable by someone who did not run the count.

### breakdown.js / panel.js
- Percentages as described above. Always show the raw count next to the percentage.

---

## Gotchas for whoever picks this up

- **localStorage key collision between the two tools.** `storage.js:19` builds
  `dwelling.counts.v${COUNTS_KEY_VERSION}.${SITE}` from `SEED_DATA.siteCode`. A sibling
  tool built for the same site would compute the **same key** and the two tools would
  silently overwrite each other's counts — and on `file://` every local HTML file shares
  one origin, so they genuinely collide. The key needs a metric discriminator
  (e.g. `dwelling.counts.` vs `total.counts.`) before the sibling tool exists.
- **Partial capacity data is the real design problem.** If only some areas carry a number,
  falling back to relative colouring for the rest produces a map with two incompatible
  legends — worse than either alone. Cleanest rule: utilisation mode unlocks **per floor**
  only once every area on that floor has a capacity. One legend, one meaning, no hybrid.
- **Keep raw-count mode.** "Where is the most stuff" stays a legitimate question, and it is
  the mode that needs no data.
- **Capacity is an estimate and it drifts** as racking changes. A wrong capacity makes the
  map *confidently* wrong, which is worse than vaguely relative. Mitigate by showing the raw
  count beside every percentage and keeping raw mode one click away.
- **The sibling tool is a second operator template, not a fork.** The editor embeds the
  operator page as `OPERATOR_TEMPLATE` and fills two tokens (`opbuild.js:10-11`);
  `build/build-standalone.py` builds that template from `app/index.html` and validates it
  (`validate_operator_template`). A second tool means a second template through the same
  machinery — plan for the editor offering a choice of which operator file to build, rather
  than duplicating the editor.
- **The data gate, not the code, decides whether this ships.** Someone has to determine and
  enter a pallet capacity for 74 areas. That is not engineering work.

---

## Suggested phasing

**Phase 1 — capacity in the model and editor; percentages in breakdown and panel. No
heatmap change.**
Small, independently useful, and it lets capacities be filled in a few areas at a time
without the map ever looking broken. It also reveals whether the numbers are trustworthy
*before* anything bets colour on them.

**Phase 2 — the sibling total-pallet tool**, with utilisation colouring and the fixed 0–100%
legend, consuming the capacity data Phase 1 populated.

Estimated code for Phase 1 is modest; Phase 2's colouring work is small on top of it. The
long pole in both is the capacity dataset.

## Open decisions

- Over-capacity treatment (clamp vs distinct band).
- Whether the dwelling tool gets a "dwelling density" colour mode at all, or keeps capacity
  purely as panel/roll-up context. Recommendation: roll-ups only, to avoid two colour
  semantics in one tool.
- Key-naming scheme for the two tools' counts before the sibling is built.
