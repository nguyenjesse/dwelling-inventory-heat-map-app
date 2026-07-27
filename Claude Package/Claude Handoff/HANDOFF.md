# HANDOFF — Code → Cowork · 2026-07-27 23:30 PT

## ⚑ Newest work is on a branch, NOT main — user wants to test it first
The region-editor area-manager expansion (below) lives on branch
**`claude/editor-area-manager`**, pushed but **not merged**. The **user
explicitly wants to hands-on test the new editor changes before merging** — this
is the #1 thing to carry over. Everything else described here is already on
`main`.

## What happened (recent sessions)
1. **Input method replaced (merged to `main`, PR #2):** associates no longer scan
   one container at a time — they **pick an area (department-grouped dropdown or a
   map-region click) and type the pallet count directly.** Floor-plan show/hide
   toggle removed. Both standalones regenerated.
2. **Region editor expanded into a full area manager (branch, unmerged):** the
   editor can now **create / name / rename / delete / duplicate areas**, place
   their region boxes, and **assign Pole (I-Beam) + Department** (departments can
   be created/renamed). It exports one `poc3-map-data.json` bundle instead of just
   `regions.json`.

## Changes on disk (all merged to `main`)
- `app/js/storage.js` — new `poc3.counts.v1` localStorage key; one-time migration
  tallies any legacy `poc3.records.v1` container records into per-area counts.
- `app/js/model.js` — count model: `getCount`/`setCount`/`replaceCounts`/
  `countsByArea`, dept + grand totals. Record API removed.
- `app/js/form.js` — area picker + numeric count editor; `selectArea()` lets a
  map-region click drive it.
- `app/js/app.js` — unified selection across map/dropdown/editor; relocate flow gone.
- `app/js/panel.js` — read-only area stats (container list removed).
- `app/js/importexport.js` — per-area CSV/JSON (`Area, Department,
  I_Beam_Location, Pallets`).
- `app/js/map.js` — floor-plan toggle removed (background always shows).
- `app/tests/tests.js` — rewritten for the count model. `heatmap.js`, `legend.js`,
  `validate.js`, and the region **editor** were NOT touched.
- `POC3-Dwelling-Inventory-Map.html` — regenerated standalone (the deliverable).
- `README.md` (root) + `app/README.md` — both now document the current area→count
  input model (root README was previously empty; the app README's old "scan a
  container" usage + CSV columns were corrected). Pushed straight to `main` after
  PR #2, not part of it.
- `build/build-standalone.py` now emits a **second** standalone,
  `POC3-Region-Editor.html` (double-click admin editor); `app/js/editor.js` uses
  the inlined background when present (mirrors `map.js`). On `main`.

**On branch `claude/editor-area-manager` (unmerged):**
- `app/js/editor.js` — full area CRUD + attribute editing + dept create/rename;
  `slugify`/`uniqueId` for stable ids, `deriveIbeamMappings(areas)` so I-Beam
  mappings never go stale; exports the `poc3-map-data.json` bundle.
- `app/editor.html` + `app/css/editor.css` — New/Duplicate/Delete buttons and the
  Name/Pole/Department panel.
- Both READMEs updated for the new editor; both standalones rebuilt.

## Decisions taken and why
- **Single pallet count per area** (not a multi container-type table like the
  reference screenshot) — user confirmed only pallets are recorded.
- **Counts fully replace scanning** — no Container IDs / per-container list kept.
- **Save SETS the absolute count** for an area (pre-filled with current value),
  rather than incrementing by 1. This was my default choice — see open questions.
- **Heat scheme unchanged** — same green→yellow→red by pallet count.
- **No photo/comments** this round (user deferred).

## Verification status
- In-browser test suite **31/31 green** (served run).
- End-to-end verified in Chromium (served + `file://` standalone): dropdown and
  map-click both drive the editor, Save heat-colors the region, panel/header
  totals update, CSV round-trips, no console errors. Screenshots confirmed the
  `file://` standalone is fully styled (all 61 boxes).
- **Region editor (branch work):** verified end-to-end in Chromium from `file://`
  — create/rename (internal id stays stable)/assign Pole+Department/create a
  department/duplicate (new area gets identical w/h, offset +12)/delete all work,
  and the exported `poc3-map-data.json` passes `validateManifest` with **0 errors,
  0 warnings**. Operator standalone regression still green. **But the user has not
  hands-on tested it yet — that gate is still open** (see the ⚑ at top).

## Dead ends & gotchas
- **Standalone rebuild is mandatory after ANY `app/` change:**
  `python3 build/build-standalone.py`, then verify by opening the regenerated
  `POC3-Dwelling-Inventory-Map.html` from `file://` and taking a real screenshot
  — a DOM-node count once hid an unstyled-render bug (favicon regex, commit
  cf0c292). Don't trust a node count for the standalone.
- **Region editor:** for the user, hand them the double-click
  `POC3-Region-Editor.html` (built by the same script). The **served** dev editor
  (`app/editor.html`) still needs HTTP — it uses ES modules + `fetch`, so it
  won't run from `file://`: `cd app && python3 -m http.server 8000` → open
  `http://localhost:8000/editor.html`.

## Suggested next steps
1. **User tests the new editor** (the open gate) — hand them the double-click
   `POC3-Region-Editor.html` from branch `claude/editor-area-manager`. They try
   create/rename/delete/duplicate + assign Pole/Department + drag/nudge boxes,
   then **Export data**. If good, merge the branch to `main`.
2. **Apply an exported `poc3-map-data.json`:** split it into
   `app/data/{areas,departments,regions,ibeam-mappings}.json`
   (the bundle already carries all four, `ibeamMappings` derived), then rebuild
   the standalones and verify. Region alignment on Green Mile is
   close-but-not-pixel-perfect, so some boxes may need nudging.
3. Decide the Save semantics (see open question) and adjust `form.js` if needed.
4. Only if asked: shrink the ~3.4 MB standalone (background → JPEG ≈ halves it).

## Open questions
- **Save = set vs. increment?** Currently Save *sets* the area's absolute count.
  User hasn't objected, but hasn't confirmed a preference either — worth checking
  if associates would rather each Save add to the running count.
- After editing regions, does the Green Mile alignment need a broader re-tune, or
  just a few boxes?

## Git note
`main` holds the merged count-model + double-click-editor work. The **new editor
area-manager** work is on **`claude/editor-area-manager`** (pushed, unmerged),
awaiting the user's test before it merges. No PR was opened (user hasn't asked).
