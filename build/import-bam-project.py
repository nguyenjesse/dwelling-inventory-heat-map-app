#!/usr/bin/env python3
"""Mesh a Building Area Manager project file into this site's seed data.

BAM's "Save project" writes the whole layout — floors, areas, departments,
categories, regions, I-beam mappings, and the background images — to one
`<SITECODE>-bam-project.json`. That file is the record of what an admin drew in
the editor, but nothing consumes it: the POC3 editor and operator standalones
are seeded from `app/data/*.json` + `app/assets/`, so a saved project only
becomes the default plan once its contents land there.

This script does that landing. It reads a project bundle, checks it hangs
together, and rewrites `app/data/*.json` (plus any background image whose bytes
changed) to match — the reverse of "Save project". Run the standalone build
afterwards so the generated HTML picks the new layout up:

    python3 build/import-bam-project.py           # default: the POC3 project
    python3 build/build-standalone.py

Pass a path to import some other project file:

    python3 build/import-bam-project.py path/to/SITE-bam-project.json

Output is written in the repo's own conventions (2-space indent, canonical key
order, mappings in the editor's natural sort), so re-importing an unchanged
project is a no-op in git and a real edit shows up as a readable diff.
"""

import base64
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
DATA = APP / "data"
ASSETS = APP / "assets"

# The project file this repo's own site (POC3) is maintained in.
DEFAULT_PROJECT = ROOT / "Claude Package" / "POC3-bam-project.json"

# Data-model schema version this importer understands. Keep in sync with
# SCHEMA_VERSION in app/js/schema.js and build/build-standalone.py.
SCHEMA_VERSION = 1

# Field order for each record type, so rewritten files keep the shape the repo
# already uses instead of whatever order the browser serialized.
AREA_KEYS = ["id", "name", "departmentId", "iBeamLocation", "mapRegionId", "floorId"]
FLOOR_KEYS = ["id", "name", "image", "imageWidth", "imageHeight"]
DEPT_KEYS = ["id", "name", "categoryId"]
CATEGORY_KEYS = ["id", "name"]
MAPPING_KEYS = ["iBeamLocation", "floorId", "areaIds"]
REGION_KEYS = ["x", "y", "w", "h"]

DATA_URI_RE = re.compile(r"^data:([^;,]+);base64,(.*)$", re.DOTALL)
EXT_BY_MIME = {"image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif",
               "image/webp": ".webp"}


def fail(msg: str) -> None:
    raise SystemExit(f"import-bam-project: {msg}")


def ordered(record: dict, keys: list) -> dict:
    """Record with `keys` first in order, then any extra fields the editor added."""
    out = {k: record[k] for k in keys if k in record}
    out.update({k: v for k, v in record.items() if k not in out})
    return out


def natural_key(text: str) -> list:
    """Sort key matching localeCompare(..., { numeric: true }) — J9 before J10."""
    return [int(part) if part.isdigit() else part.lower()
            for part in re.split(r"(\d+)", text or "")]


def load_bundle(path: Path) -> dict:
    if not path.exists():
        fail(f"no project file at {path}")
    try:
        bundle = json.loads(path.read_text())
    except json.JSONDecodeError as err:
        fail(f"{path} is not valid JSON ({err})")
    if not isinstance(bundle, dict):
        fail(f"{path} is not a project bundle (expected a JSON object)")
    version = bundle.get("version", bundle.get("schemaVersion", SCHEMA_VERSION))
    if version != SCHEMA_VERSION:
        fail(f"project is format v{version}; this importer reads v{SCHEMA_VERSION}. "
             "Update the importer alongside app/js/schema.js before importing.")
    return bundle


def check(bundle: dict) -> None:
    """Refuse to write a layout the app would render broken."""
    floors = bundle.get("floors") or []
    areas = bundle.get("areas") or []
    departments = bundle.get("departments") or []
    categories = bundle.get("categories") or []
    regions = (bundle.get("regions") or {}).get("regions", {})
    problems = []

    if not floors:
        problems.append("no floors — the map would have no background")
    if not areas:
        problems.append("no areas — the heat map would be empty")

    floor_ids = {f.get("id") for f in floors}
    dept_ids = {d.get("id") for d in departments}
    category_ids = {c.get("id") for c in categories}
    seen = set()
    for area in areas:
        aid = area.get("id")
        if not aid:
            problems.append("an area has no id")
            continue
        if aid in seen:
            problems.append(f"duplicate area id {aid!r}")
        seen.add(aid)
        if area.get("floorId") not in floor_ids:
            problems.append(f"area {aid!r} is on unknown floor {area.get('floorId')!r}")
        if area.get("departmentId") not in dept_ids:
            problems.append(f"area {aid!r} has unknown department {area.get('departmentId')!r}")
        if area.get("mapRegionId") not in regions:
            problems.append(f"area {aid!r} has no map region ({area.get('mapRegionId')!r})")

    for dept in departments:
        if dept.get("categoryId") not in category_ids:
            problems.append(
                f"department {dept.get('id')!r} has unknown category "
                f"{dept.get('categoryId')!r} — it would drop out of the "
                "Inbound/Outbound roll-up")

    for floor in floors:
        if not floor.get("image"):
            problems.append(f"floor {floor.get('id')!r} has no background image")

    if problems:
        fail("project failed validation; nothing written:\n  - " + "\n  - ".join(problems))


def write_json(path: Path, payload) -> bool:
    """Write pretty JSON; return True if the file's bytes actually changed."""
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    if path.exists() and path.read_text() == text:
        return False
    path.write_text(text)
    return True


def write_images(bundle: dict) -> list:
    """Materialize each floor's background from its data URI. Returns changed names."""
    uris = bundle.get("bgImageDataUris") or {}
    changed = []
    for floor in bundle.get("floors") or []:
        name = floor.get("image")
        uri = uris.get(name)
        if not uri:
            # The editor omits images it already had on disk in this repo; only
            # a genuinely missing file is a problem.
            if not (ASSETS / name).exists():
                fail(f"floor {floor.get('id')!r} needs {name}, which is neither in "
                     "the project file nor in app/assets/")
            continue
        match = DATA_URI_RE.match(uri)
        if not match:
            fail(f"background {name!r} is not a base64 data: URI")
        mime, b64 = match.group(1), match.group(2)
        expected = EXT_BY_MIME.get(mime)
        if expected and Path(name).suffix.lower() not in (expected, ".jpeg"):
            fail(f"background {name!r} is {mime} but its name says "
                 f"{Path(name).suffix or '(no extension)'}")
        try:
            raw = base64.b64decode(b64, validate=True)
        except (ValueError, base64.binascii.Error) as err:
            fail(f"background {name!r} has undecodable base64 ({err})")
        out = ASSETS / name
        if out.exists() and out.read_bytes() == raw:
            continue
        out.write_bytes(raw)
        changed.append(name)
    return changed


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PROJECT
    bundle = load_bundle(path)
    check(bundle)

    areas = [ordered(a, AREA_KEYS) for a in bundle["areas"]]
    regions = {rid: ordered(box, REGION_KEYS)
               for rid, box in bundle["regions"]["regions"].items()}
    mappings = sorted(
        (ordered(m, MAPPING_KEYS) for m in bundle.get("ibeamMappings") or []),
        key=lambda m: (m.get("floorId") or "", natural_key(m.get("iBeamLocation"))))

    writes = {
        "floors.json": [ordered(f, FLOOR_KEYS) for f in bundle["floors"]],
        "areas.json": areas,
        "departments.json": [ordered(d, DEPT_KEYS) for d in bundle["departments"]],
        "categories.json": [ordered(c, CATEGORY_KEYS) for c in bundle["categories"]],
        "ibeam-mappings.json": mappings,
        "regions.json": {"regions": regions},
    }
    changed = [name for name, payload in writes.items()
               if write_json(DATA / name, payload)]
    changed += write_images(bundle)

    orphans = sorted(set(regions) - {a["mapRegionId"] for a in areas})

    print(f"Imported {path.relative_to(ROOT)} (site {bundle.get('siteCode', '?')!r})")
    print(f"  {len(bundle['floors'])} floors · {len(areas)} areas · "
          f"{len(bundle['departments'])} departments · {len(mappings)} I-beam mappings "
          f"· {len(regions)} regions")
    if orphans:
        print(f"  note: {len(orphans)} region(s) belong to no area: {', '.join(orphans)}")
    print("  " + (f"updated: {', '.join(changed)}" if changed
                  else "app/data already matched this project — nothing to write"))
    if changed:
        print("Next: python3 build/build-standalone.py")


if __name__ == "__main__":
    main()
