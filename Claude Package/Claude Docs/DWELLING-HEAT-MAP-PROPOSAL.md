# Dwelling Inventory Heat Map — Adoption Proposal

**Status:** Pilot complete on a small associate group — proposing site adoption
**Owner:** ngjesseo
**Replaces:** POC3 Dwelling Inventory Map (Excel/VBA workbook)
**Date:** August 2026

> A browser-based replacement for the Excel/VBA dwelling inventory workbook, plus a
> no-code editor that lets any site in the network stand up its own version from its
> own floor plan. Built and maintained in-house; no license, no install, no server.

---

## Problem Solved

- **The count is recorded in a tool that was never built for it.** The dwelling map
  lives in an Excel workbook driven by VBA macros. Recording counts against a floor
  plan is not native Excel functionality, so the entry experience is slow and clunky
  for the IOL associates doing the walk.
- **Changing the map requires writing code.** Every buffer area on the map — adding
  one, moving one, renaming one — has to be hand-coded in VBA. Layout changes on the
  floor are routine; each one is a development task.
- **The tool depends on one person.** The workbook is currently maintained solely by
  its author. Nobody else at the site can modify the map, and there is no path for
  another site to adopt it without that same person rebuilding it for them.
- **It does not travel.** A VBA workbook cannot be handed to another FC as a working
  starting point. Each site would need its own hand-coded version — which in practice
  means it stays a single-site tool.

## Objective / Goals

- Replace the Excel/VBA workbook with a faster, cleaner recording experience for the
  associates who actually perform the walk.
- Remove code from the maintenance path entirely — layout changes become a GUI task,
  not a development task.
- Eliminate the single-maintainer dependency at this site.
- Make the tool **network-portable**: any receiving site can set up its own map from
  its own floor plan with zero coding knowledge.
- Preserve the existing count workflow exactly, so adoption requires no change to how
  the walk is run.

## What It Does

Records how many dwelling pallets sit in each operational buffer area and heat-maps
that distribution over the site's own floor plan, live, as the count is entered.

At this site that is **76 areas across 6 departments** (Sort, IB Dock, Fluid Load,
RPN, OB Dock, Docksort), mapped to **63 I-Beam pole locations** on the Green Mile
floor plan — the same areas the workbook covered, carried over intact.

## How the Walk Works Today — and What Changes

The count is performed by **2 IOL associates**, splitting the floor into Inbound and
Outbound and filling in their own areas. The walk runs roughly **2 quarters (about
3–5 hours)**, and consists of two distinct activities:

| Activity | Today | With this tool |
|---|---|---|
| **Red-tagging** — scanning each dwelling container to establish receive date and dwell age, then physically tagging the pallet | Manual, on-floor | **Unchanged.** This is physical work and the tool does not touch it. |
| **Recording counts** — entering per-area totals against the map | Excel/VBA workbook — slow, clunky, not native to Excel | Click the area on the map, type the number, done. Live heat map and roll-ups. |
| **Maintaining the map** — adding/moving/renaming buffer areas | Hand-coded in VBA, one area at a time, by one person | Drag a box in a GUI editor. No code. |
| **Standing up another site** | Not practical | Send one file. Site sets up its own map. |

**This is deliberately not a claim that the walk gets shorter.** The 3–5 hours is
dominated by red-tagging, which is physical work the tool leaves alone. What changes
is the *recording* layer, the *maintenance* layer, and the *portability* layer.

## Key Capabilities

**For the associate performing the count:**

- Click a buffer area directly on the floor plan — or search it by name or pole
  location — and the I-Beam and Department fill in automatically, with the cursor
  already in the count field.
- Type the count, hit Save. The heat map repaints immediately: gray for zero, then
  green → yellow → red as counts climb.
- **Undo** on the last entry (Ctrl+Z), so a fat-finger entry is a one-click fix.
- **Inbound / Outbound summary** and a per-department **Area Breakdown** table roll up
  automatically as counts are entered — expandable to Area / Pole Location / Pallet
  Count.
- Filter the map to one flow category or one department; hide empty areas. Roll-ups
  stay intact so a filtered-out department can still be compared.
- **Export to CSV** — date-stamped and Excel-ready — for any downstream analysis or
  reporting the workbook was feeding before. Import works both ways.

**For whoever owns the map:**

- **Building Area Manager (BAM)** — a full graphical editor. Create, rename,
  duplicate, delete and place buffer areas by dragging boxes on the floor plan;
  assign pole location and department; create departments and tag them Inbound or
  Outbound; manage multiple floors, each with its own background image.
- Multi-select with Ctrl-click or a rubber-band drag for bulk moves and reassignment;
  full undo/redo; regions locked by default so nothing moves by accident.
- **Build operator file** — generates that site's ready-to-use heat map as a single
  file, in the browser, and downloads it. No terminal, no repository, no developer.

## Technical Highlights

- **Single self-contained HTML file.** Data, floor-plan image, styling and logic are
  all baked into one file. Double-click and it runs — no install, no server, no
  network connection, no admin rights, no license cost.
- **Zero dependencies.** Plain HTML, CSS and JavaScript. Nothing to patch, nothing to
  version-manage, no third-party library exposure.
- **Site data is data, not code.** Areas, departments, flow categories, poles and the
  floor plan itself all travel as configuration. The same codebase serves any site's
  layout — which is precisely what the VBA version could not do.
- **The editor generates the operator file in the browser.** A receiving site never
  needs this repository, Python, or any build step.
- **Counts persist locally per machine**, namespaced per site code, so two sites' files
  opened on the same machine never collide.
- **102 automated tests**, run headless on every change, covering the color math, data
  integrity, the count model, roll-ups, import/export round-trips, and the in-browser
  file generation. The build refuses to produce an editor that would generate a broken
  operator file.

## Business / Operational Impact

**Realized at this site:**

- **Map maintenance stops being a development task.** Adding or moving a buffer area
  goes from hand-coding VBA for that area to dragging a box in an editor — work any
  area manager can do, immediately, without waiting on the one person who knows the
  macros.
- **Single-maintainer risk is removed.** The layout is editable by anyone with the
  editor file. If the current owner moves roles, the tool does not become
  unmaintainable.
- **Cleaner data entry for the associates doing the walk**, on a tool built for the
  task instead of a spreadsheet bent into the shape of one.
- **Instant roll-ups.** Inbound/Outbound splits and per-department totals are computed
  as counts are entered, rather than assembled afterward.
- **No Excel or macro dependency** — no macro-security prompts, no workbook version
  drift between copies, no corrupted-file recovery.

**Network-level (the largest opportunity):**

- **Any FC can adopt this by receiving one file.** They enter a site code, load their
  own floor-plan image, draw their buffer areas, and click one button to generate
  their own operator map. No coding knowledge, no developer time, no per-site build
  from the original author.
- This turns a single-site workbook into a **network-deployable standard** for
  dwelling visibility — at effectively zero marginal cost per site.
- Every site's tool is GUI-driven end to end, which keeps the learning curve to
  near-zero for both associates and the person who owns the map.

## Current Status

- **Built and functionally complete** for the count workflow it replaces.
- **Pilot-tested by a small group of associates.** Feedback so far has driven the
  entry-form and map-interaction refinements now in the build.
- **102/102 automated tests green.** The shipped files have been verified opening
  offline from disk, recording counts, persisting them, rolling them up, and
  exporting — with no errors.
- Not yet deployed as the site's standard, and not yet offered to any other site.

## What I'm Asking For

1. **Approval to make this the standard recording tool for the dwelling count at this
   site**, replacing the Excel workbook.
2. **A short structured pilot** — a defined number of counts with the full IOL team on
   the new tool, so adoption rests on their feedback rather than mine.
3. **Approval to offer the editor to other sites in the network** that want dwelling
   visibility, as a self-service file rather than a per-site build request.

There is no spend attached to any of the three. The tool is built, in-house, and
carries no license, infrastructure, or support cost.

## Roadmap — Where This Goes Next

The highest-value extension is already visible from how the walk works today.

**Associates establish each pallet's dwell age during red-tagging — and the tool
currently discards it.** Only the total count per area is recorded. Capturing dwell
age at the same moment, in bands the org already uses, unlocks:

- **Age bands at entry** (3–24 / 25–29 / 30+ days) instead of one total. The total
  stays the sum, so nothing downstream breaks.
- **Color by worst age band, not by volume.** Today an area with 40 fresh pallets
  paints red while an area with three pallets at 29 days paints nearly gray — the map
  cannot currently see the thing it exists to prevent. Band coloring also gives a
  fixed, absolute scale, so two counts become directly comparable.
- **Automatic 25+ day callout.** The escalation posted manually to comms channels
  today could be generated as copy-ready text — areas, pole locations, counts — from
  data already being collected.
- **Forward-looking IOL exposure.** Anything in the 25–29 band hits IOL within days.
  The tool could state "14 pallets across 4 areas will hit IOL this week unless
  cleared" — turning a retrospective count into a preventive one, directly against the
  metric the walk exists to protect.

## Why It Stands Out

- It replaces a tool that only one person could maintain with one that **needs no
  code to maintain at all** — and does so without changing how the count is run.
- It converts a **single-site workbook into a network-portable standard**, distributed
  as one file, deployable by a non-technical owner in an afternoon.
- Every capability is GUI-driven, offline, dependency-free and zero-cost, which
  removes essentially every normal barrier to adoption — no install, no license, no
  IT ticket, no training overhead.
- The groundwork is already laid for the real prize: moving dwelling management from
  *counting what dwelled* to *preventing anything from reaching IOL*.
