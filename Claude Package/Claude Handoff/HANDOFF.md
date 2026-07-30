# HANDOFF — Code → Code · 2026-07-30 18:40 PT

## What happened this session
Shipped **multi-floor support** across the viewer and the region editor, and
**merged it to `main`**. A site can now hold a separate layout per floor; both
the operator map and the editor have a **Floor** dropdown, and the editor can
add / rename / delete floors. Verified in a real browser, user approved, pushed.

## ⚠️ Branch state — supersedes the last handoff's tip claim
- **`main` is at `07874b0`** ("Add multi-floor support…"). This is the only
  place the work lives that matters.
- The previous handoff said main tip was `d76b527`. **That was already stale** —
  `origin/main` was actually at `28e8796` (the prior handoff commit) when this
  session started, so the fast-forward added exactly one commit (`07874b0`).
  Lesson: trust `git fetch origin main` over any handoff's tip claim.
- This session's work branch `claude/startup-skill-3m6pr4` and `main` both point
  at `07874b0`. **Start new work from a fresh branch off `main`.**

## The multi-floor design (chat-only rationale — don't re-litigate)
- **Area IDs stay globally unique** ⇒ pallet counts remain keyed by `areaId` in
  localStorage, so **no count migration**. The site-wide header total stays
  global; floors are a *view filter*.
- **`floors.json`** (NEW, ordered; first = default) holds each floor's `name`,
  `image`, `imageWidth`, `imageHeight` — these moved **out of** `regions.json`'s
  `meta` (which was deleted). `regions.json` is now just `{ regions: {…} }`, a
  **flat** box map keyed by area id (NOT namespaced per floor — safe because ids
  are unique; each box is read against its area's floor dims).
- **Each area gained `floorId`; each `ibeam-mappings` entry gained `floorId`.**
  Per the user's call: **departments stay global, I-beam mappings are per-floor**
  (a code may repeat across floors; model keys I-beam lookups by `floorId ib`).
- **Heat colors normalize per visible floor** (`app.js renderColors` →
  `model.countsForFloor(currentFloorId)`), also the user's explicit choice.
- **Backward-compatible loader**: `normalizeSeed()` synthesizes one floor from
  `regions.meta` when `floors` is absent; `createModel` calls it; `validate.js`
  skips the floor check when a seed declares no floors. Old bundles still open.

## Changes on disk (all committed at `07874b0` on `main`)
- Data: **NEW** `app/data/floors.json`; `areas.json` (+`floorId`), `regions.json`
  (−`meta`), `ibeam-mappings.json` (+`floorId` per entry).
- Runtime: `app/js/model.js` (normalizeSeed, floor lookups, `countsForFloor`,
  `bgSrcFor`), `validate.js`, `map.js` (`setFloor()`), `app.js` (dropdown +
  per-floor heat), `form.js` (`setFloor()`).
- Editor: `app/js/editor.js` (floor CRUD + per-floor state), `app/editor.html`
  (floor controls in header), `app/css/editor.css`.
- Build: `build/build-standalone.py` — inlines **all** floors' images as
  `BG_IMAGE_DATA_URIS` (keyed by filename); reads `floors.json`.
- Both root `POC3-*.html` rebuilt (single-floor Green Mile).

## Editor specifics worth knowing
- Floors are working copies; the regions working map stays flat/global.
- **Add floor** prompts for a name + a background to trace against; the image is
  held as an in-memory object URL (`floorBgUrls`) **for display only** — export
  stores just the image **filename**. So a brand-new floor background must be
  dropped into `app/assets/` and the build re-run to bake it in.
- "Load background" updates the current floor's image *filename* but **keeps the
  grid dims** (deliberate — avoids reflowing existing boxes). Delete-floor
  refuses a floor that still has areas.

## Verification status
- Real-browser `file://` checks (per the standing don't-trust-node-counts rule).
  Harness is chat-only: `npm install playwright-core`, chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `.mjs` importing
  `file://…/playwright-core/index.js`. **Single-floor regression 11/11**;
  **temporary two-floor dataset 15/15** (dropdown swaps background + boxes +
  area list + per-floor heat in both standalones, 0 console errors); screenshots
  confirmed the green-mile→floor-plan background swap.
- User visually reviewed a 2-floor demo build and said "everything looks good,"
  then approved the push to `main` (done).
- **`node_modules`/`package*.json` were deleted after testing — never commit
  them** (dependency-free static project).

## Dead ends & gotchas
- **`app/tests/tests.js` is stale / pre-existing red** — asserts 61 areas / 5
  depts / 55 I-beams and uses old area ids (`presort-phase-1`, `E16`), but the
  live dataset is 74 / 6 / 61 with different ids; it also builds a seed WITHOUT
  `floors.json`. My model/validate changes were made **defensively
  backward-compatible** specifically so I didn't add new failures — but the suite
  was already failing on data-count/id assertions before this session. Updating
  it to the 74-area + floors dataset is a separate task.
- Branch deletion still **403s** through the git proxy — user must delete
  branches in the GitHub UI.
- Standing gotcha: verify standalones with a real screenshot, not a DOM count.

## Files produced this session
- Everything above is committed on `main` (`07874b0`).
- **Demo builds** `POC3-Dwelling-Inventory-Map-DEMO.html` / `-Region-Editor-DEMO.html`
  were sent to the user but live **only in the session scratchpad — NOT on disk
  in the repo, NOT committed.** A fresh session cannot open them; regenerate from
  a temp 2-floor dataset if needed (recipe: append a `floor-2` to `floors.json`,
  reassign a few areas' `floorId`, regenerate `ibeam-mappings`, rebuild, then
  `git checkout -- app/data`).

## Suggested next steps
1. **Author a real second floor** (steady-state loop): in the editor, add the
   floor + its background, place areas; drop the PNG into `app/assets/`; export
   the bundle; split into `app/data/{floors,areas,departments,regions,ibeam-mappings}.json`;
   `python3 build/build-standalone.py`; screenshot-verify from `file://`; commit
   on a fresh branch off `main`.
2. **Move-area-between-floors** — currently an area's floor is fixed at creation
   (delete+recreate is the only workaround). Small add: a floor `<select>` in the
   editor's area attribute panel that reassigns `activeArea.floorId`. Explicitly
   left out of scope this session.
3. **Refresh `app/tests/tests.js`** to the 74-area + floors dataset (pre-existing red).
4. Carried: consider gitignoring `Claude Package/` (still tracked on `main`;
   would need `git rm --cached` too).

## Open questions
- **Save = set vs. increment?** (Carried across several batons, still unconfirmed.)
  Operator "Save count" *sets* an area's absolute pallet count. `app/js/form.js`.
- **One floor per area** is assumed (an area belongs to exactly one floor). Not
  explicitly confirmed with the user, but the model and editor enforce it.
