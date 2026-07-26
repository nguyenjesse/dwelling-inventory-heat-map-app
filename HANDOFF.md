# POC3 Dwelling Inventory Map — Handoff

Handoff for continuing work in Claude Code. Snapshot of what exists, why it's
built this way, how to run it, and where we left off.

---

## What this is

A browser rebuild of a macro-heavy Excel/VBA workbook ("POC3 Dwelling Inventory
Map") that records where **dwelling pallets** sit across **61 operational areas**
of a warehouse and **heat-maps** their distribution over the floor plan. The
rebuild replaces VBA, data-validation dropdowns, and named-shape↔cell coupling
with a plain web data model + an interactive SVG map.

**Goal from the user:** a cleaner, easier app that associates can run **without a
server** and that can be **emailed around** — each associate keeps their own data
(nothing shared between machines).

---

## Current status — WORKING

- Full operator app: entry form, heat map, info panel, legend, import/export.
- Region editor (admin tool) for placing the 61 map regions.
- Real data extracted from the workbook: 61 areas, 5 departments, 55 unique
  I-beam locations (incl. one-to-many I-beam→area), 61 regions.
- Green Mile floor plan is the active background; regions registered onto it.
- **Single-file standalone build** that opens by double-click (no server) — this
  is the file associates get.
- 25/25 in-browser tests green.

**Active branch:** `claude/inventory-heatmap-html-app-h8msac`
**Latest commit:** `cf0c292` — "Add fixed single-file standalone build".
PR #1 was already merged to `main`; subsequent work (Green Mile swap, standalone)
lives on the branch above and is **not yet merged** — no new PR has been opened
(user hasn't asked for one).

---

## Two ways to run it

### 1. Standalone single file — for associates (no server)
`POC3-Dwelling-Inventory-Map.html` at the repo root is fully self-contained
(data, image, CSS, JS all inlined). Double-click → opens in any browser, works
offline. Emailable. Records persist per-browser in `localStorage`.

Regenerate after any change to `app/` source or data:
```bash
python3 build/build-standalone.py    # writes POC3-Dwelling-Inventory-Map.html
```

### 2. Served dev version — for development + the region editor
The modular `app/` source uses ES modules + `fetch`, so it must be served over
HTTP (it will NOT run from `file://`):
```bash
cd app && python3 -m http.server 8000
# http://localhost:8000/index.html   (app)
# http://localhost:8000/editor.html  (region editor — admin only)
# http://localhost:8000/tests/tests.html  (test suite)
```

---

## Repo layout

```
POC3-Dwelling-Inventory-Map.html   # generated standalone (the deliverable)
build/build-standalone.py          # inlines app/ -> the standalone file
app/
  index.html      editor.html
  css/            styles.css, editor.css
  data/           areas.json, departments.json, ibeam-mappings.json, regions.json
  assets/         green-mile.png (active bg), floor-plan.png (original CAD ref)
  js/             model, heatmap, storage, validate, importexport,
                  map, form, panel, legend, app, editor
  tests/          tests.html, tests.js  (25 assertions)
  README.md
```

## Data model (`app/data/`)
- `areas.json` — `{id, name, departmentId, iBeamLocation, mapRegionId}` ×61
- `departments.json` — `{id, name}` ×5 (Docksort, IB Dock, OB Dock, RPN, Sort)
- `ibeam-mappings.json` — `{iBeamLocation, areaIds[]}` ×55 (multi-area I-beams:
  E16, E17, E19, E20, E25, F12)
- `regions.json` — `{meta:{imageWidth,imageHeight,image}, regions:{areaId:{x,y,w,h}}}`

Stable machine IDs are the key; display names are separate, so renaming a label
never breaks the map↔data link. `regions.json > meta.image` names the background
file, so the app is data-driven — point it at any file in `assets/` to swap.

## Heat-map scale (`app/js/heatmap.js`)
Corrected from the Excel original (olive midpoint + zeros distorting the range):
- `count = 0` → gray `#808080`, excluded from normalization
- `count > 0` → 3-stop green `#2ca25f` → yellow `#ffd400` → red `#e60000`,
  normalized over the **positive** min/max only
- all positives equal → yellow midpoint (not "everything red")

## Selection outlines
default `#2f528f` · selected `#ff0000` · same-department "zone" `#ffa500`.

---

## How the standalone build works
`build/build-standalone.py` reads `app/` and emits one HTML file:
- inlines the 4 data JSON files as `const SEED_DATA`
- inlines the background image as a base64 `data:` URI → `const BG_IMAGE_DATA_URI`
- inlines `styles.css` into a `<style>` block
- strips `import`/`export` and concatenates all JS modules (dependency order) into
  one classic `<script>` (no ES modules, no fetch)

To keep ONE source of truth, `model.js` `loadSeed()` and `map.js` prefer the
inlined `SEED_DATA` / `BG_IMAGE_DATA_URI` **if present**, else fall back to
`fetch`/asset paths. So the same source powers both run modes; the served app is
unaffected.

---

## Background & region registration
`assets/floor-plan.png` (1808×1125) is the original master plan extracted from
the workbook — the exact image the Excel shapes were positioned against; regions
were first reconstructed in that image's coordinate space from the workbook's own
shape anchors. `assets/green-mile.png` (1484×1060) is that same drawing, cropped
and scaled, with gray conveyors + green "Green Mile" walking lanes. Regions were
**affine-mapped** from CAD space onto the Green Mile image using its content
bounding box (`sx≈0.813, sy≈0.902, ox≈5, oy≈19`). Alignment is close; individual
boxes can be nudged in `editor.html`.

---

## Gotchas / lessons
- **The standalone must be served through the build script, never hand-edited.**
- **Fixed bug (commit cf0c292):** the first standalone extracted the favicon
  `<link>` with a regex that stopped at the first `>`. The favicon's SVG `data:`
  URI contains `>`, so the tag truncated with an unterminated `href="` quote,
  which swallowed the inlined `<style>` — page rendered as unstyled text with the
  areas invisible. Now matched to end-of-line. If you touch favicon/head inlining,
  re-screenshot the standalone from `file://`, don't trust DOM-only checks.
- The served app intentionally shows a "must be served over HTTP" message if
  opened from `file://` — that's expected, not a bug. Use the standalone for
  double-click.
- Testing here uses Playwright + Chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` with `--no-sandbox`.

---

## Where we left off / open items
- ✅ Delivered the fixed standalone file to the user; guidance given (double-click
  to run, email to associates).
- ⬜ **No new PR opened** to merge this branch into `main`. Green Mile + standalone
  are branch-only. Open one only if the user asks.
- ⬜ **Region fine-tuning:** affine registration is close but some boxes may sit
  slightly off Green Mile features — tune in `editor.html` → Export `regions.json`
  → `app/data/` → rebuild standalone.
- ⬜ Optional (offered, not requested): shrink the 3.4 MB standalone by converting
  the background to JPEG (~half size); color-blind-safe palette; CSV bulk-import UI.

## Constraints to respect
- Develop/push only to `claude/inventory-heatmap-html-app-h8msac`.
- Do NOT open a PR unless the user explicitly asks.
- Model identifier stays out of commits/PRs/artifacts (chat only).
