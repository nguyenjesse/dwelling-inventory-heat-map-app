# POC3 Dwelling Inventory Map — HTML app

A dependency-free browser rebuild of the Excel/VBA dwelling-inventory heat map.
Records where dwelling pallets sit across 74 operational areas and heat-maps
their distribution over the warehouse floor plan.

- **No build step, no npm.** Plain HTML + CSS + ES-module JavaScript.
- **Local-first.** Per-area pallet counts persist in the browser
  (`localStorage`); CSV/JSON import & export move data in and out of Excel.
- **Multi-floor.** A site can hold a separate layout per floor, each with its
  own background image; both viewer and editor have a Floor selector. The
  current site has a single floor.
- **Data** originally extracted from `POC3_Dwelling_Inventory_Map_v1.5` and
  since maintained in the region editor: currently 74 areas, 6 departments,
  61 unique I-beam locations (with one-to-many I-beam→area mappings), and 74
  map regions reconstructed from the workbook's own shape geometry.

## Two ways to run it

### 1. Standalone file — for associates (no server, just double-click)

`POC3-Dwelling-Inventory-Map.html` at the repo root is a **single self-contained
file**: the data, the floor-plan image, the CSS, and all the JavaScript are baked
in. Double-click it (or email/Slack it to someone) and it opens in any browser —
no server, no install, works fully offline. Each person's pallet records live in
their own browser (`localStorage`) and are never shared between machines. This is
the file to hand out.

Rebuild it after any change to the app or data:

```bash
python3 build/build-standalone.py   # regenerates the operator + editor standalones
```

The build also produces **Building Area Manager (BAM)** — the double-click editor
(`Building-Area-Manager.html` is blank for handing to other sites; a POC3-seeded
copy is built for maintaining this site). BAM generates a site's operator file
in the browser, so a receiving site never needs Python or this repo. See the root
[`README.md`](../README.md) for the send-one-file workflow.

### 2. Served dev version — for editing/development

The modular `app/` source must be served over HTTP (ES modules + `fetch` don't
work from `file://`):

```bash
cd app
python3 -m http.server 8000
# open http://localhost:8000/index.html
```

Any static host works too (S3, GitHub Pages, an internal web server, etc.).
`editor.html` (Building Area Manager) is the admin tool; associates never need it,
since the regions ship already placed in the operator file. In this served dev
mode it reads/writes `data/` and `assets/`; the packaged double-click build
(`Building-Area-Manager.html`) instead works entirely offline and generates
operator files in the browser.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Operator app — entry form, heat map, info panel, legend, Inbound/Outbound summary, Area Breakdown table, category filter, import/export. |
| `editor.html` | **Building Area Manager (BAM)** — create/name/rename/delete/duplicate areas, place their region boxes, assign Pole (I-Beam) + Department (create/rename departments, tag each Inbound/Outbound), manage floors (add/rename/delete, each with its own background). **Build operator file** generates the site's standalone heat map in-browser; **Save/Load project** round-trips the whole layout (images included) as JSON. |
| `tests/tests.html` | In-browser test suite (mapping integrity, counts, color math, import/export). |

## Using the app

1. **Record a count:** pick an Area from the department-grouped dropdown, or
   click its region on the map — either loads the area into the entry card and
   focuses the count field. Its I-Beam and Department fill in automatically.
   Type the pallet count and **Save** (sets the area's absolute count); **Clear**
   zeroes it. The field takes only whole numbers ≥ 0 — a decimal point, sign, or
   exponent keystroke is rejected and pasted junk is stripped to digits.
2. **Heat map** updates live. Zero-pallet areas are neutral gray; positive
   counts are colored green → yellow → red, normalized across the *positive*
   min/max of the areas on the visible floor only. With more than one floor, the
   **Floor** dropdown filters the map; the header pallet total stays site-wide.
3. **Click an area** (or focus + Enter) to select it: red outline on the area,
   orange on the rest of its department, and its details (I-Beam, department,
   dept total, % of all pallets) in the panel. **Reset selection** clears it.
   Selection never changes on reload.
4. **Roll-ups:** the **Inbound/Outbound** summary (under the entry card) totals
   the two flow categories (Outbound = docksort, ob-dock, sort, fluid-load;
   Inbound = ib-dock, rpn) plus a site-wide grand total. The **Area Breakdown**
   table (right column) sums counts per department; click a department to expand
   its areas in **Area / Pole Location / Pallet Count** columns. Both always list
   everything on the floor, including zeros. The **category filter** dropdown
   dims the map to one category or department — the roll-ups are never dimmed, so
   a hidden category can still be compared.
5. **Import/Export:** CSV columns are `Area, Department, I_Beam_Location,
   Pallets` (Excel-compatible), one row per area with a positive count. Invalid
   rows are reported, never silently skipped. Import resolves each row by area ID
   *or* name, then asks how to apply the file — **Fully replace** (clear all
   other areas first), **Merge** (update only the file's areas), or **Cancel**.

## Data model (`data/`)

- `floors.json` — `[{id, name, image, imageWidth, imageHeight}]` (ordered; first
  is the default) ×1
- `areas.json` — `{id, name, departmentId, iBeamLocation, mapRegionId, floorId}` ×74
- `departments.json` — `{id, name, categoryId}` ×6
- `categories.json` — `[{id, name}]` (ordered flow categories: Outbound, Inbound).
  Departments reference these by `categoryId`; the model derives the grouping so
  each site defines its own — nothing is hard-coded.
- `ibeam-mappings.json` — `{iBeamLocation, floorId, areaIds[]}` ×61 (unique per floor)
- `regions.json` — `{regions:{areaId:{x,y,w,h}}}` — a flat box map keyed by area
  ID (each box is read against its area's floor dimensions)

Stable machine IDs are the real key; display names are separate, so renaming a
label never breaks the map↔data link. Area IDs are globally unique across
floors, so floors are a view filter and pallet counts need no per-floor
migration. Departments are global; I-Beam mappings are keyed per floor.

## The floor-plan background & regions

The active background is `assets/green-mile.png` — the master plan with the
gray conveyors and the green "Green Mile" walking lanes drawn on it
(`viewBox 0 0 1484 1060`). Each floor's background filename and dimensions are
declared in `floors.json` (`image`, `imageWidth`, `imageHeight`), so the app is
data-driven — point a floor's `image` at any file in `assets/` to swap it.

`assets/floor-plan.png` is the original master plan **extracted from the
workbook** (1808×1125) — the exact image the Excel shapes were positioned
against. The original 61 region boxes were first reconstructed in that image's
space, then **affine-mapped onto the Green Mile image** (same underlying
drawing, a different crop/scale) using its content bounding box. The result
aligns closely; fine-tune any box in the editor (the site has since grown to 74
regions, added directly in the editor).

To swap in another background: open Building Area Manager (`editor.html`, or the
double-click `POC3-Building-Area-Manager.html`), use **Load background…** to load
it, adjust regions, then either **Build operator file** (bakes the image straight
into a new operator standalone — no repo step) or **Save project** to keep working
later. The floor's `image` in `floors.json` records the filename; for the *served*
dev app, drop the actual PNG into `assets/` too so `bgSrcFor` can find it.

## Heat-map scale

Corrected from the Excel original (which produced an olive midpoint and let
zeros distort normalization):

- `count = 0` → gray `#808080`
- `count > 0` → interpolated across three stops — green `#2ca25f` → yellow
  `#ffd400` → red `#e60000` — normalized over the **positive** min/max of the
  areas on the visible floor.
- All positive counts equal → yellow midpoint (not "everything red").

See `js/heatmap.js`.
