# Dwelling Inventory Heat Map

A dependency-free browser rebuild of the Excel/VBA **POC3 Dwelling Inventory
Map** workbook. It records how many dwelling pallets sit in each of the 61
operational warehouse areas and heat-maps that distribution over the floor plan.

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
   zero it). Save sets the area's absolute count.
3. **The heat map updates live.** Zero-pallet areas are neutral gray; positive
   counts are colored green → yellow → red, normalized across the current
   *positive* min/max only. Clicking an area also shows its details (I-Beam,
   department, dept total, % of all pallets) in the side panel.
4. **Import/Export** — CSV columns are `Area, Department, I_Beam_Location,
   Pallets` (Excel-compatible); JSON export mirrors the same per-area counts.
   Invalid rows are reported, never silently skipped.

> Each person's counts live in their own browser and are never shared between
> machines — matching the requirement that associates' maps stay separate.

## Two ways to run it

### 1. Standalone file — for associates (just double-click)

`POC3-Dwelling-Inventory-Map.html` at the repo root is a **single self-contained
file**: data, floor-plan image, CSS, and all JavaScript are inlined. Double-click
it (or email it to someone) and it opens in any browser — no server, no install,
works fully offline. **This is the file to hand out.**

Rebuild it after **any** change to `app/` source or `app/data/`:

```bash
python3 build/build-standalone.py   # regenerates POC3-Dwelling-Inventory-Map.html
```

### 2. Served dev version — for editing/development

The modular `app/` source must be served over HTTP (ES modules + `fetch` don't
work from `file://`):

```bash
cd app
python3 -m http.server 8000
# open http://localhost:8000/index.html
```

The region editor (`editor.html`, admin-only) and the test suite
(`tests/tests.html`) also run in this served mode.

## Repository layout

```
POC3-Dwelling-Inventory-Map.html   Generated standalone (the deliverable — do not hand-edit)
build/build-standalone.py          Inliner that produces the standalone
app/                               Modular source (dev version)
  index.html                       Operator app: area picker + count entry, heat map, panel, legend
  editor.html                      Region editor (admin: drag/resize/nudge the 61 regions)
  tests/tests.html                 In-browser test suite
  js/                              model, storage, form, map, panel, heatmap, importexport, validate…
  css/                             styles
  data/                            areas / departments / ibeam-mappings / regions JSON
  assets/                          green-mile.png (active background), floor-plan.png (original CAD ref)
Claude Package/                    Session handoff notes (not app code)
```

See [`app/README.md`](app/README.md) for the app-level details: the data model,
the floor-plan background & region alignment, and the heat-map scale.

## Data model

- **61 areas** across **5 departments**, each mapped to an I-Beam location and a
  map region.
- Pallet counts are stored as a simple `{ areaId → count }` map. (Earlier
  per-container-scan data is migrated into per-area counts automatically on first
  load.)

## Testing

Serve the app and open `tests/tests.html` — the in-browser suite covers the
heat-map color math, manifest integrity, the count model, legacy-data migration,
and CSV/JSON import/export round-trips. It currently runs **31/31 green**.

After changing anything under `app/`, rebuild the standalone and confirm it opens
**fully styled from `file://`** before shipping it (a DOM-node count alone can
hide a broken inline-render).
