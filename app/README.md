# POC3 Dwelling Inventory Map — HTML app

A dependency-free browser rebuild of the Excel/VBA dwelling-inventory heat map.
Records where dwelling pallets sit across 61 operational areas and heat-maps
their distribution over the warehouse floor plan.

- **No build step, no npm.** Plain HTML + CSS + ES-module JavaScript.
- **Local-first.** Records persist in the browser (`localStorage`); CSV/JSON
  import & export move data in and out of Excel.
- **Data faithfully extracted** from `POC3_Dwelling_Inventory_Map_v1.5`:
  61 areas, 5 departments, 55 unique I-beam locations (with one-to-many
  I-beam→area mappings), and the 61 map regions reconstructed from the
  workbook's own shape geometry.

## Run it

It must be served over HTTP (ES modules + `fetch` don't work from `file://`):

```bash
cd app
python3 -m http.server 8000
# open http://localhost:8000/index.html
```

Any static host works too (S3, GitHub Pages, an internal web server, etc.).

## Pages

| File | Purpose |
|---|---|
| `index.html` | Operator app — entry form, heat map, info panel, legend, import/export. |
| `editor.html` | Region editor — drag/resize/nudge the 61 map regions and export `regions.json`. |
| `tests/tests.html` | In-browser test suite (mapping integrity, counts, color math, import/export). |

## Using the app

1. **Add a pallet:** scan/type a Container ID, pick an I-Beam location
   (searchable), choose the Area (filtered to that I-beam), and the Department
   fills in automatically. Enter submits; the form clears for the next scan.
2. **Heat map** updates live. Zero-pallet areas are neutral gray; positive
   counts are colored green → yellow → red, normalized across the current
   *positive* min/max only.
3. **Click an area** (or focus + Enter) to select it: red outline on the area,
   orange on the rest of its department, and full details + container list in
   the panel. **Reset selection** clears it. Selection never changes on reload.
4. **Import/Export:** CSV columns are `Container ID, I_Beam_Location, Area,
   Department` (Excel-compatible). Invalid rows are reported, never silently
   skipped.

## Data model (`data/`)

- `areas.json` — `{id, name, departmentId, iBeamLocation, mapRegionId}` ×61
- `departments.json` — `{id, name}` ×5
- `ibeam-mappings.json` — `{iBeamLocation, areaIds[]}` ×55 (unique I-beams)
- `regions.json` — `{meta:{imageWidth,imageHeight}, regions:{areaId:{x,y,w,h}}}`

Stable machine IDs are the real key; display names are separate, so renaming a
label never breaks the map↔data link.

## The floor-plan background & regions

`assets/floor-plan.png` is the master plan **extracted from the workbook** —
the exact image the Excel shapes were positioned against — so the 61 regions in
`regions.json` line up out of the box (`viewBox 0 0 1808 1125`).

To swap in a different background (e.g. a Green Mile render): open
`editor.html`, use **Load background…** to preview it, adjust any regions that
need it, and **Export regions.json** back into `data/`. If the new image has a
different crop/aspect ratio than 1808×1125, regions will need re-placing — the
editor exists for exactly that.

## Heat-map scale

Corrected from the Excel original (which produced an olive midpoint and let
zeros distort normalization):

- `count = 0` → gray `#808080`
- `count > 0` → interpolated across three stops — green `#2ca25f` → yellow
  `#ffd400` → red `#e60000` — normalized over the **positive** min/max.
- All positive counts equal → yellow midpoint (not "everything red").

See `js/heatmap.js`.
