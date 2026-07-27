# HANDOFF — Code → Cowork · 2026-07-27 22:40 PT

## What happened this session
Replaced the app's input method: associates no longer scan one container at a
time. They now **pick an area — from a department-grouped dropdown or by clicking
its region on the map — and type the pallet count directly.** Also removed the
floor-plan show/hide toggle from the map toolbar. Everything was merged to `main`
via PR #2 and the standalone was regenerated. **Only `main` exists now** — the
user deleted the old feature branches, and `main` is the most up-to-date ref.

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
- **Region editor:** I smoke-tested that `editor.html` still loads clean (61
  regions, no errors) — but the **user has NOT hands-on tested it yet and wants
  to** (see next steps). It was not otherwise changed this session.

## Dead ends & gotchas
- **Standalone rebuild is mandatory after ANY `app/` change:**
  `python3 build/build-standalone.py`, then verify by opening the regenerated
  `POC3-Dwelling-Inventory-Map.html` from `file://` and taking a real screenshot
  — a DOM-node count once hid an unstyled-render bug (favicon regex, commit
  cf0c292). Don't trust a node count for the standalone.
- **Region editor needs served mode** (HTTP) — it uses ES modules + `fetch`, so
  it will NOT run from `file://` (double-click). Serve it:
  `cd app && python3 -m http.server 8000` → open
  `http://localhost:8000/editor.html`. (If you serve from the repo root instead,
  the path is `/app/editor.html`.)

## Suggested next steps
1. **Test the region editor** (user's explicit ask). Serve it as above, open
   `editor.html`, and check drag/resize/nudge of the 61 region boxes on the Green
   Mile background, then **Export regions.json** back into `app/data/`. Region
   alignment on Green Mile is close-but-not-pixel-perfect (affine-mapped from the
   original CAD image), so some boxes may need nudging.
2. Decide the Save semantics (see open question) and adjust `form.js` if needed.
3. Only if asked: shrink the ~3.4 MB standalone (background → JPEG ≈ halves it)
   for easier emailing.

## Open questions
- **Save = set vs. increment?** Currently Save *sets* the area's absolute count.
  User hasn't objected, but hasn't confirmed a preference either — worth checking
  if associates would rather each Save add to the running count.
- After editing regions, does the Green Mile alignment need a broader re-tune, or
  just a few boxes?

## Git note
PR #2 is merged and done — a merged PR can't take new commits. Any follow-up work
should start a fresh branch off the latest `main` (don't reuse the merged branch
name to stack commits on merged history).
