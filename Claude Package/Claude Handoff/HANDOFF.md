# HANDOFF — Code → Code · 2026-07-30 10:42 PT

## What happened this session
Picked up the editor area-manager work and used this session as a **cross-device
save/restore channel** for the user's in-progress region-editor edits. The user
edited areas in the browser editor on one device, exported the data bundle, and I
baked each export back into the repo so they could resume elsewhere. Three
successive exports were applied; the branch now holds a validated **74-area**
layout with both standalones rebuilt and verified. User confirmed "everything
looks good."

## Where this lives — branch & PR
- Branch: **`claude/editor-area-manager-wip`**, PR **#3** (opened from the Claude
  Code UI — pushing to the branch updates it; do NOT open a new PR).
- Based off **`claude/editor-area-manager`** (the original area-manager editor
  code, still unmerged). This wip branch is deliberately kept **separate from both
  `main` and `claude/editor-area-manager`** — the user asked for a 3rd branch.
- Latest commit `4be7da7`. Nothing here is merged anywhere.

## Changes on disk
- `app/data/{areas,regions,ibeam-mappings}.json` — current seed = **74 areas, 6
  departments, 74 regions, 61 I-beam mappings**. (`departments.json` unchanged all
  session — still the original 6.)
- `POC3-Dwelling-Inventory-Map.html` + `POC3-Region-Editor.html` (repo root) —
  rebuilt from the 74-area data, in sync with `app/data`.
- No JS/code changes this session — data + regenerated standalones only.

## The repeatable workflow (this is the whole job)
For each new export the user hands over:
1. Split the bundle → `app/data/{areas,departments,regions,ibeam-mappings}.json`
   (bundle keys: `areas`, `departments`, `regions`, `ibeamMappings`).
2. Validate with `validateManifest` (must be 0 errors / 0 warnings).
3. `python3 build/build-standalone.py` to rebuild both standalones.
4. **Verify from `file://` with a real screenshot** — not just a node count (see
   gotcha). Confirm box count matches area count and 0 console errors.
5. Commit (data + standalones together) and push to `claude/editor-area-manager-wip`.

## Files to reference
- **On disk (durable):** the four `app/data/*.json`, the two root standalones, and
  `build/build-standalone.py`.
- **Ephemeral — NOT on disk:** the user's uploaded exports lived at
  `/root/.claude/uploads/.../poc3mapdata*.json` (session uploads, gone next
  session — the committed `app/data` is the durable copy). The validator harness
  was a scratch file at
  `…/scratchpad/validate.mjs` (also gone) — trivially recreated: a `.mjs` that
  imports `validateManifest` from `app/js/validate.js`, reads the four
  `app/data/*.json` into a `{areas, departments, regions, ibeamMappings}` seed, and
  prints errors/warnings. Run with `node`.

## Verification status
- Latest 74-area build: `validateManifest` **0/0**; both standalones render fully
  styled from `file://` with **74 boxes each, 0 console errors** (confirmed by
  actually viewing the screenshots, per the gotcha below).
- Operator heat map shows all-gray (zero pallets) — correct for fresh counts.
- The user has been hands-on testing the editor across devices and signed off on
  the current state.

## Dead ends & gotchas
- **Editor has no persistence and no re-import.** No localStorage, no FileReader —
  it always boots from the seed (`SEED_DATA` inlined in the standalone, or
  `app/data/*.json` when served). The ONLY save path is the editor's **Export
  data** button → `poc3-map-data.json`. That's why "saving progress" = committing a
  fresh export into `app/data` and rebuilding.
- **Served vs. standalone.** The served dev editor (`cd app && python3 -m
  http.server 8000` → `http://localhost:8000/editor.html`) reads `app/data` live.
  The double-click `POC3-Region-Editor.html` needs a rebuild to reflect new data.
  Commit `cabf366` intentionally updated data **without** rebuilding (left
  standalones stale for one hop); `405d3a6` re-synced them. Current tip is fully in
  sync — don't be fooled by that mid-history gap.
- **Don't trust a DOM node count for the standalone** — a node count once hid an
  unstyled-render bug (favicon regex, older commit cf0c292). Always eyeball a real
  screenshot.

## Suggested next steps
1. If the user hands over another export: run the 5-step workflow above. That's the
   steady-state loop.
2. When the user says the layout is final: decide how to fold this back in —
   likely merge `claude/editor-area-manager-wip` (which contains the editor code
   *and* the finished data) toward `main`. Confirm with the user first; nothing is
   merged yet.
3. Region alignment on Green Mile is close-but-not-pixel-perfect; a few boxes may
   still want nudging if the user flags them.

## Open questions
- **Save = set vs. increment?** (Carried from the prior baton, still unconfirmed.)
  Operator "Save count" currently *sets* an area's absolute pallet count rather than
  incrementing. `form.js` would change if the user wants running totals.
- Final merge target/timing for the wip branch (see next step 2) — user hasn't said.
