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

### 1. Standalone file — for associates (just double-click)

`POC3-Dwelling-Inventory-Map.html` at the repo root is a **single self-contained
file**: data, floor-plan image, CSS, and all JavaScript are inlined. Double-click
it (or email it to someone) and it opens in any browser — no server, no install,
works fully offline. **This is the file to hand out.**

Rebuild after **any** change to `app/` source or `app/data/` — this regenerates
**both** standalones (the operator app and the region editor):

```bash
python3 build/build-standalone.py
# -> POC3-Dwelling-Inventory-Map.html  and  POC3-Region-Editor.html
```

`POC3-Region-Editor.html` is a double-click **admin** tool for managing the map
areas — create / name / rename / delete / duplicate an area, place its region
box, and assign its **Pole** (I-Beam) and **Department** (departments can be
created/renamed too). It also manages the site's **floors** (add / rename /
delete, each with its own background image and layout). It exports a single
`poc3-map-data.json` bundle (floors + areas + departments + regions, with I-Beam
mappings derived) to hand back for applying — no server needed either.

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
POC3-Dwelling-Inventory-Map.html   Generated operator standalone (the deliverable — do not hand-edit)
POC3-Region-Editor.html            Generated admin region-editor standalone (double-click; do not hand-edit)
build/build-standalone.py          Inliner that produces both standalones
app/                               Modular source (dev version)
  index.html                       Operator app: area picker + count entry, heat map, panel, legend
  editor.html                      Region editor (admin: floor management + drag/resize/nudge the 74 regions)
  tests/tests.html                 In-browser test suite
  js/                              model, storage, form, map, panel, legend, breakdown, iosummary, heatmap, importexport, modal, validate…
  css/                             styles
  data/                            floors / areas / departments / ibeam-mappings / regions JSON
  assets/                          green-mile.png (active background), floor-plan.png (original CAD ref)
Claude Package/                    Session handoff notes (not app code)
```

See [`app/README.md`](app/README.md) for the app-level details: the data model,
the floor-plan background & region alignment, and the heat-map scale.

## Data model

- **74 areas** across **6 departments**, each mapped to an I-Beam location, a
  map region, and a **floor**.
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
heat-map color math, manifest integrity, the count model, legacy-data migration,
the Area Breakdown / Inbound-Outbound roll-ups, and CSV/JSON import/export
round-trips. It currently runs **43/43 green**.

After changing anything under `app/`, rebuild the standalone and confirm it opens
**fully styled from `file://`** before shipping it (a DOM-node count alone can
hide a broken inline-render).
