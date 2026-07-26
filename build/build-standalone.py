#!/usr/bin/env python3
"""Build a single self-contained HTML file from the modular app/ source.

The served app (app/index.html) loads its data and image over HTTP with ES
modules + fetch, which browsers block on file://. This script inlines
everything — the four data JSON files, the CSS, the background image (as a
base64 data: URI), and every JS module (import/export stripped, merged into one
classic <script>) — so the result opens by double-click, works fully offline,
and can be emailed/shared as one file. Each user's records live in their own
browser localStorage; nothing is shared between machines.

Run:  python3 build/build-standalone.py
Out:  POC3-Dwelling-Inventory-Map.html   (repo root)
"""

import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
OUT = ROOT / "POC3-Dwelling-Inventory-Map.html"

# JS modules in dependency order. Everything lands in one scope, so anything
# referenced at load time must be defined before its first use.
JS_ORDER = [
    "storage.js",
    "heatmap.js",
    "validate.js",
    "importexport.js",
    "model.js",
    "panel.js",
    "legend.js",
    "form.js",
    "map.js",
    "app.js",
]

IMPORT_RE = re.compile(r"^\s*import\s.*?;\s*$", re.MULTILINE)
EXPORT_RE = re.compile(r"^(\s*)export\s+(?=(?:async\s+)?function|const|let|class)", re.MULTILINE)


def strip_module_syntax(src: str) -> str:
    """Remove `import ... ;` lines and the `export` keyword from declarations."""
    src = IMPORT_RE.sub("", src)
    src = EXPORT_RE.sub(r"\1", src)
    return src


def load_seed() -> dict:
    data = APP / "data"
    return {
        "areas": json.loads((data / "areas.json").read_text()),
        "departments": json.loads((data / "departments.json").read_text()),
        "ibeamMappings": json.loads((data / "ibeam-mappings.json").read_text()),
        "regions": json.loads((data / "regions.json").read_text()),
    }


def image_data_uri(seed: dict) -> str:
    meta = seed["regions"].get("meta", {})
    name = meta.get("image", "floor-plan.png")
    img = APP / "assets" / name
    ext = img.suffix.lower().lstrip(".")
    mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "gif": "image/gif", "webp": "image/webp"}.get(ext, "image/png")
    b64 = base64.b64encode(img.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def body_from_index(html: str) -> str:
    """Pull the inner <body> markup, minus the module <script> and CSS <link>."""
    body = re.search(r"<body>(.*)</body>", html, re.DOTALL).group(1)
    body = re.sub(r'<script\s+type="module".*?</script>', "", body, flags=re.DOTALL)
    return body.strip()


def main() -> None:
    seed = load_seed()
    css = (APP / "css" / "styles.css").read_text()
    index_html = (APP / "index.html").read_text()
    body = body_from_index(index_html)
    bg_uri = image_data_uri(seed)

    js_parts = [strip_module_syntax((APP / "js" / name).read_text()) for name in JS_ORDER]
    bundle = "\n\n".join(js_parts)

    inlined_data = (
        "// ---- inlined by build/build-standalone.py (no server needed) ----\n"
        f"const SEED_DATA = {json.dumps(seed)};\n"
        f"const BG_IMAGE_DATA_URI = {json.dumps(bg_uri)};\n"
    )

    favicon = re.search(r'<link rel="icon"[^>]*>', index_html).group(0)

    out = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>POC3 Dwelling Inventory Map</title>
  {favicon}
  <style>
{css}
  </style>
</head>
<body>
{body}
  <script>
{inlined_data}
{bundle}
  </script>
</body>
</html>
"""

    OUT.write_text(out)
    size_mb = OUT.stat().st_size / (1024 * 1024)
    print(f"Wrote {OUT.relative_to(ROOT)} ({size_mb:.1f} MB)")
    print("Double-click it to run — no server required.")


if __name__ == "__main__":
    main()
