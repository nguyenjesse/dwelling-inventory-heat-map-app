# Dwelling Inventory Heat Map

A dependency-free browser rebuild of the Excel/VBA **POC3 Dwelling Inventory
Map** workbook. It records how many dwelling pallets sit in each of the 74
operational warehouse areas and heat-maps that distribution over the floor plan.
A site can hold a separate layout per **floor**; both the operator map and the
region editor have a Floor selector (the current site has a single floor).

> Private use only. App upgrade to the Excel macro-based workbook.

- **No build step, no npm, no server required for associates.** Plain HTML + CSS
  + ES-module JavaScript.
- **Local-first.** Counts persist per-machine in the browser (`localStorage`).
  CSV/JSON import & export move data in and out of Excel.
- **Offline.** The distributable version is a single self-contained file.

## How it works

1. **Pick an area** — choose it from the department-grouped dropdown, or click
   its region directly on the map. Either way it loads into the entry card and
   the count field is focused.
2. **Type the pallet count** for that area and hit **Save** (or **Clear** to
   zero it). Save sets the area's absolute count. The count field accepts only
   whole numbers ≥ 0 — decimals, signs, and other stray characters are blocked
   as you type.
3. **The heat map updates live.** Zero-pallet areas are neutral gray; positive
   counts are colored green → yellow → red, normalized across the *positive*
   min/max of the areas on the currently visible floor only. Clicking an area
   also shows its details (I-Beam, department, dept total, % of all pallets) in
   the side panel. When a site has more than one floor, the **Floor** dropdown
   filters the map to that floor; the header pallet total stays site-wide.
4. **Read the roll-ups.** The **Inbound/Outbound** summary (left, under the entry
   card) totals the two flow categories plus a site-wide grand total. The **Area
   Breakdown** table (right) rolls counts up per department — click a department
   to expand its areas (Area / Pole Location / Pallet Count). Both always show
   every department and area, so a filtered-out category can still be compared.
   The **category filter** dropdown dims the map to one flow (Inbound or
   Outbound) or a single department, leaving the roll-ups untouched.
5. **Import/Export** — CSV columns are `Area, Department, I_Beam_Location,
   Pallets` (Excel-compatible); JSON export mirrors the same per-area counts.
   Invalid rows are reported, never silently skipped. On import you choose how to
   apply the file: **Fully replace** (clear every other area first), **Merge**
   (update only the areas in the file), or **Cancel**.

> Each person's counts live in their own browser and are never shared between
> machines — matching the requirement that associates' maps stay separate.

## Two ways to run it

### 1. Standalone files — just double-click

The build produces three self-contained files at the repo root (data, floor-plan
image, CSS, and JavaScript all inlined — no server, no install, fully offline):

| File | Who it's for |
|---|---|
| `POC3-Dwelling-Inventory-Map.html` | **This site's associates.** The operator heat map. Email it out; each person's counts live in their own browser. |
| `POC3-Building-Area-Manager.html` | **You (admin).** The editor pre-loaded with POC3's layout, for maintaining this site. |
| `Building-Area-Manager.html` | **Other sites.** A *blank* editor to hand to a new warehouse so they can set up their own map (see below). |

Rebuild after **any** change to `app/` source or `app/data/`:

```bash
python3 build/build-standalone.py
```

The build **fails loudly** if the operator page embedded in the editor
standalones (`OPERATOR_TEMPLATE`) would be broken — too short (inlining failed), a
missing placeholder token, no `<script>` block, or a raw `</script` that survived
escaping — so a mis-built manager can never ship a blank heat map to a receiving
site.

Every generated operator file shows a **build timestamp** in a small footer (e.g.
`POC3 · built 2026-07-31 14:23 UTC-7`) — the local time it was built, so an
associate can tell how fresh their emailed file is. Python-built POC3 files stamp
the build machine's time; a file BAM generates in the browser stamps that moment.

**Building Area Manager (BAM)** is the double-click editor. It manages a site's
**floors** (add / rename / delete, each with its own background image), **areas**
(create / rename / delete / duplicate, place the region box, assign **Pole**
(I-Beam) + **Department**), **departments** (create / rename, each tagged into a
flow **category** — Inbound or Outbound), and the **Site code**. Two things it can
do without any server, terminal, or this repo:

- **Build operator file** — generates that site's `<SITECODE>-Dwelling-Inventory-Map.html`
  in the browser (the floor image is inlined as base64, so the one file is the whole
  deliverable) and downloads it. This is what you hand to associates.
- **Save / Load project** — round-trips the entire layout *including background images*
  to a `<SITECODE>-bam-project.json` file, so a half-finished site survives a closed tab.

### Setting up another site

Send them **one file: `Building-Area-Manager.html`** (nothing else — no folder, no
repo). On a fresh double-click they: enter a **Site code**, add their **floor**(s)
via **Load background…**, create their **departments** (tagging each Inbound/Outbound)
and **areas** (placing boxes, setting Pole + Department), then click **Build operator
file**. That downloads *their* `<CODE>-Dwelling-Inventory-Map.html`, which they hand to
their own associates. The only thing they must supply is their floor-plan image.

### 2. Served dev version — for editing/development

The modular `app/` source can also be served over HTTP (ES modules + `fetch`
don't work from `file://`):

```bash
cd app
python3 -m http.server 8000
# open http://localhost:8000/index.html   (or /editor.html, /tests/tests.html)
```

The test suite (`tests/tests.html`) runs in this served mode.

## Repository layout

```
POC3-Dwelling-Inventory-Map.html   Generated operator standalone for POC3 (do not hand-edit)
POC3-Building-Area-Manager.html    Generated editor, seeded with POC3's layout (do not hand-edit)
Building-Area-Manager.html         Generated BLANK editor — the file to send other sites (do not hand-edit)
build/build-standalone.py          Inliner that produces all three standalones
app/                               Modular source (dev version)
  index.html                       Operator app: area picker + count entry, heat map, panel, legend
  editor.html                      Building Area Manager (admin: floors, areas, departments, build operator file)
  tests/tests.html                 In-browser test suite
  js/                              model, storage, form, map, panel, legend, breakdown, iosummary, heatmap, importexport, modal, validate, opbuild, editor…
  css/                             styles
  data/                            floors / areas / departments / categories / ibeam-mappings / regions JSON
  assets/                          green-mile.png (active background), floor-plan.png (original CAD ref)
Claude Package/                    Session handoff notes (not app code)
```

See [`app/README.md`](app/README.md) for the app-level details: the data model,
the floor-plan background & region alignment, and the heat-map scale.

## Data model

- **74 areas** across **6 departments**, each mapped to an I-Beam location, a
  map region, and a **floor**. Each department is tagged into a flow **category**
  (Inbound / Outbound) via `categoryId`; the ordered category list lives in
  `categories.json`. Categories are per-site data (not hard-coded), so a site set
  up in Building Area Manager carries its own grouping into the generated file.
- **Floors** (`floors.json`, ordered — first is the default) each carry a name,
  background image, and dimensions; departments stay global while I-Beam
  mappings are per-floor. Area IDs are globally unique, so floors act as a *view
  filter* rather than a partition.
- Pallet counts are stored as a simple `{ areaId → count }` map, keyed globally
  by area ID (so adding floors needs no count migration). Earlier
  per-container-scan data is migrated into per-area counts automatically on first
  load.

## Testing

Serve the app and open `tests/tests.html` — the in-browser suite covers the
heat-map color math, manifest integrity, the count model (including single-level
undo), legacy-data migration, the Area Breakdown / Inbound-Outbound roll-ups, and
CSV/JSON import/export round-trips, plus seed-derived categories, the
site-namespaced counts key, and the in-browser operator-file generation. It
currently runs **55/55 green**.

CI (`.github/workflows/ci.yml`) runs the same suite headless on every push/PR via
`tests/run_ci.py` (serves `app/`, drives headless Chromium with Playwright, reads
the runner's `window.__TEST_RESULT__` signal), and also rebuilds the standalones
and fails if a committed `*.html` is stale versus `app/` — ignoring only the
build-timestamp line, which floats by design.

After changing anything under `app/`, rebuild the standalone and confirm it opens
**fully styled from `file://`** before shipping it (a DOM-node count alone can
hide a broken inline-render).
