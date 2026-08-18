# Dwelling Inventory Heat Map

A browser tool for recording where **dwelling pallets** — aged, stuck inventory —
are sitting across the warehouse floor, and heat-mapping that distribution over
the site's own floor plan. It replaces the Excel/VBA **POC3 Dwelling Inventory
Map** workbook.

Everything ships as **self-contained HTML files**. No install, no server, no
network, no npm, no accounts. An associate double-clicks one file and it opens in
any browser, fully offline.

> Private/internal use. The floor plan and area names are site data, not code —
> another site sets up its own without touching this repository.

---

## What actually ships

Three files at the repo root. These are the whole deliverable — everything else
in this repository exists to produce them.

| File | Size | Who gets it | What it does |
|---|---|---|---|
| `POC3-Dwelling-Inventory-Map.html` | ~3.5 MB | **Associates at this site** | The operator heat map. Record counts, read the roll-ups, export to Excel. |
| `POC3-Building-Area-Manager.html` | ~3.6 MB | **The site admin** | The editor, pre-loaded with POC3's 76 areas, for maintaining this site's layout. |
| `Building-Area-Manager.html` | ~190 KB | **Another site** | A *blank* editor. They build their own map from their own floor plan and generate their own operator file. |

Each operator file carries a build timestamp in the footer (e.g.
`POC3 · built 2026-08-18 19:50 UTC+0`), so anyone can tell how fresh the copy
they were emailed is.

---

## The operator map — recording a count

1. **Pick an area.** Click its region on the map, choose it from the
   department-grouped dropdown, or type into **Find area** to search by name or
   I-Beam. Any of the three loads the area into the entry card, fills in its
   I-Beam and Department, and focuses the count field.
2. **Type the pallet count and Save.** Save sets the area's absolute count;
   **Clear** zeroes it. The field takes whole numbers ≥ 0 only. **Undo**
   (or Ctrl/⌘+Z) reverts the last single Save or Clear.
3. **The heat map repaints live.** Zero-pallet areas are neutral gray; positive
   counts run green → yellow → red, normalized across the positive counts on the
   visible floor. Selecting an area outlines it in red, outlines the rest of its
   department in orange, and fills the side panel with its I-Beam, department,
   department total, and share of all pallets.
4. **Read the roll-ups.** The **Inbound / Outbound** summary totals the two flow
   categories plus a site-wide grand total. The **Area Breakdown** table rolls
   counts up per department — click a department to expand its areas
   (Area / Pole Location / Pallet Count). Both always list everything, so a
   filtered-out department can still be compared. The **Department** filter dims
   the map to one flow category or one department; **Hide empty** dims areas with
   no count. Neither filter touches the roll-ups.
5. **Move data in and out.** **Export CSV** writes a date-stamped, Excel-ready
   file (`Area, Department, I_Beam_Location, Pallets`); **Export JSON** mirrors
   the same counts. **Import…** accepts either, reports invalid rows rather than
   skipping them silently, and asks how to apply the file — **Fully replace**
   (clear every other area first), **Merge** (update only the file's areas), or
   **Cancel**.

**Counts live in the browser that recorded them** (`localStorage`), namespaced per
site code. They are never shared between machines — matching the requirement that
each associate's map stays their own. Import/export is how a count leaves the
machine.

---

## Building Area Manager (BAM) — owning the layout

BAM is the double-click editor. No terminal, no repository, no server. It manages:

- **Floors** — add, rename, delete; each carries its own background image.
- **Areas** — create, rename, duplicate, delete; place and size the region box on
  the plan; assign **Pole** (I-Beam) and **Department**. Drag or nudge with arrow
  keys, resize with Shift+Arrow, or type exact `x/y/w/h`. Regions are **locked by
  default** so a stray drag can't move them.
- **Multi-select** — Ctrl/⌘-click or Shift-click rows, or rubber-band a group on
  the map, then bulk-move, bulk-reassign department, duplicate, or delete.
- **Departments** — create and rename, each tagged into a flow **category**
  (Inbound or Outbound).
- **Site code** — names the built file and keeps each site's counts separate.
- **Undo / redo** across layout edits (Ctrl/⌘+Z, Ctrl/⌘+Shift+Z).

Two things it does entirely in the browser:

- **Build operator file** — generates that site's
  `<SITECODE>-Dwelling-Inventory-Map.html` with the floor image baked in as
  base64, and downloads it. This one file is the whole deliverable to associates.
- **Save / Load project** — round-trips the entire layout *including background
  images* to a `<SITECODE>-bam-project.json`, so a half-finished site survives a
  closed tab.

### Setting up another site

Send them **one file: `Building-Area-Manager.html`**. Nothing else — no folder, no
repository, no instructions to install anything. On a fresh double-click they
enter a **Site code**, add their **floor** via **Load background…**, create their
**departments** (tagging each Inbound/Outbound) and **areas**, then click **Build
operator file**. That downloads *their* operator map, which they hand to their own
associates. The only thing they must supply is their floor-plan image.

The blank editor opens with **Build operator file**, **Save project**, and **New
area** all disabled until a floor exists, so an empty map can't be generated by
accident.

---

## This site's data

- **76 areas** across **6 departments**, on **one floor** ("Green Mile"):

  | Department | Flow | Areas |
  |---|---|---:|
  | Sort | Outbound | 29 |
  | IB Dock | Inbound | 16 |
  | Fluid Load | Outbound | 14 |
  | RPN | Inbound | 7 |
  | OB Dock | Outbound | 6 |
  | Docksort | Outbound | 4 |

- **63 I-Beam (pole) locations**, mapped one-to-many onto areas.
- **76 map regions**, originally reconstructed from the Excel workbook's own shape
  geometry and since maintained in BAM.
- Flow categories (Inbound / Outbound) are **site data, not code** — each site
  defines its own grouping and it travels into that site's generated file.
- Counts are stored as a flat `{ areaId → count }` map keyed by stable machine
  IDs, so renaming a display label never breaks the map ↔ data link, and adding a
  floor needs no count migration.

See [`app/README.md`](app/README.md) for the field-level data model, the
floor-plan/region alignment, and the heat-map color math.

---

## Known limitations

Honest current boundaries, so nobody discovers them in front of an audience:

- **Counts are per-machine.** There is no site-level aggregate unless someone
  collects the exported CSVs. This is deliberate — each associate's map is their
  own — but it means "the site's dwelling picture" is an assembly step today.
- **The color scale floats.** Colors are normalized against the current day's own
  min/max, so the same 12 pallets can paint yellow one day and green the next.
  Two exports are not visually comparable; the map is a snapshot, not a trend.
- **Gray means two things** — "zero dwelling pallets here" and "nobody walked this
  area yet" are indistinguishable, so an incomplete count reads as a clean floor.
- **Age is not recorded.** The tool counts dwelling pallets but not how long they
  have been dwelling, so it cannot yet distinguish an area holding 40 pallets at
  four days (fine) from one holding three at 29 days (an escalation). See
  [`Claude Package/Claude Ideas/AGE-BANDS-AND-IOL.md`](Claude%20Package/Claude%20Ideas/AGE-BANDS-AND-IOL.md).
- **The count field tolerates a mistyped decimal.** `.` and `-` are rejected as
  keystrokes but the surrounding digits are kept, so typing `3.5` records `35`.
  Worth fixing before wide rollout.
- **Operator files are ~3.5 MB**, almost entirely the inlined floor-plan image.
  Emailable, but close to some attachment limits; a smaller source image shrinks
  it proportionally.

---

## For maintainers

Everything below produces the three files above. None of it is needed by an
associate or by a receiving site.

### Rebuilding the standalones

Required after **any** change under `app/` or `app/data/`:

```bash
python3 build/build-standalone.py
```

The build fails loudly if the operator page embedded in the editors
(`OPERATOR_TEMPLATE`) would be broken — too short, a missing placeholder token, no
`<script>` block, or an unescaped `</script` — so a mis-built manager can never
ship a blank heat map to a receiving site.

### Folding BAM edits back into POC3

The POC3 standalones are *seeded* from `app/data/` — that, not the browser, is
where this site's default layout lives. After editing POC3's layout in BAM, save
the project over `Claude Package/POC3-bam-project.json` and run **both**, in order:

```bash
python3 build/import-bam-project.py     # project JSON -> app/data/ (+ backgrounds)
python3 build/build-standalone.py       # app/data/ -> the three standalones
```

The importer is the exact reverse of **Save project**. It refuses to write a
project that wouldn't render (an area on an unknown floor or department, an area
with no region box, a department in no flow category, a floor with no background)
and normalizes formatting, so an unchanged project is a no-op in git. Pass a path
to import another site's file.

### Dev version

The modular `app/` source must be served over HTTP (ES modules and `fetch` don't
work from `file://`):

```bash
cd app
python3 -m http.server 8000
# http://localhost:8000/index.html   (or /editor.html, /tests/tests.html)
```

### Tests

`app/tests/tests.html` is an in-browser suite covering the heat-map color math,
manifest integrity, the count model and single-level undo, legacy-data migration,
the Area Breakdown and Inbound/Outbound roll-ups, CSV/JSON round-trips,
seed-derived categories, the site-namespaced counts key, and in-browser operator
file generation. It currently runs **102/102 green**.

CI (`.github/workflows/ci.yml`) runs the same suite headless via `tests/run_ci.py`,
then rebuilds the standalones and fails if a committed `*.html` is stale versus
`app/` — ignoring only the build-timestamp line, which floats by design.

The unit suite cannot catch interaction or drag-and-drop defects. After changing
anything under `app/`, rebuild and confirm the standalone opens **fully styled
from `file://`** before shipping it.

### Repository layout

```
POC3-Dwelling-Inventory-Map.html   Generated operator standalone   (do not hand-edit)
POC3-Building-Area-Manager.html    Generated POC3-seeded editor    (do not hand-edit)
Building-Area-Manager.html         Generated BLANK editor          (do not hand-edit)
build/build-standalone.py          Inliner that produces all three
build/import-bam-project.py        Loads a BAM "Save project" JSON back into app/data/
app/                               Modular source (dev version)
  index.html                       Operator app
  editor.html                      Building Area Manager
  tests/tests.html                 In-browser test suite
  js/  css/  data/  assets/        Modules, styles, site data, floor-plan images
Claude Package/                    Session notes and idea docs (not app code)
  POC3-bam-project.json            POC3's saved BAM project — what app/data/ is imported from
```
