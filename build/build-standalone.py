#!/usr/bin/env python3
"""Build single self-contained HTML files from the modular app/ source.

The served app loads its data and image over HTTP with ES modules + fetch,
which browsers block on file://. This script inlines everything — the four data
JSON files, the CSS, the background image (as a base64 data: URI), and the JS
modules (import/export stripped, merged into one classic <script>) — so the
result opens by double-click, works fully offline, and can be emailed/shared as
one file. Each user's data lives in their own browser localStorage.

Two files are produced at the repo root:
  POC3-Dwelling-Inventory-Map.html   the operator app (the deliverable)
  POC3-Region-Editor.html            the admin region editor (double-click too)

Run:  python3 build/build-standalone.py
"""

import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"

APP_OUT = ROOT / "POC3-Dwelling-Inventory-Map.html"
EDITOR_OUT = ROOT / "POC3-Region-Editor.html"

# JS modules in dependency order. Everything lands in one scope, so anything
# referenced at load time must be defined before its first use.
APP_JS_ORDER = [
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

# The editor only needs loadSeed (model -> storage) and download (importexport).
EDITOR_JS_ORDER = [
    "storage.js",
    "importexport.js",
    "model.js",
    "editor.js",
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


def body_from(html: str) -> str:
    """Pull the inner <body> markup, minus the module <script> and CSS <link>."""
    body = re.search(r"<body>(.*)</body>", html, re.DOTALL).group(1)
    body = re.sub(r'<script\s+type="module".*?</script>', "", body, flags=re.DOTALL)
    # Cross-link the two standalones (their served relative hrefs won't resolve).
    body = body.replace('href="./index.html"', f'href="{APP_OUT.name}"')
    body = body.replace('href="./editor.html"', f'href="{EDITOR_OUT.name}"')
    return body.strip()


def favicon_from(html: str) -> str:
    # The favicon href is an SVG data: URI containing '>' characters, so match to
    # end-of-line (not the first '>') or it truncates mid-tag and breaks <head>.
    return re.search(r'<link rel="icon"[^\n]*>', html).group(0)


def build(out: Path, title: str, source_html_name: str, js_order, css_names,
          seed: dict, bg_uri: str) -> None:
    source_html = (APP / source_html_name).read_text()
    css = "\n".join((APP / "css" / name).read_text() for name in css_names)
    body = body_from(source_html)
    favicon = favicon_from(source_html)

    bundle = "\n\n".join(
        strip_module_syntax((APP / "js" / name).read_text()) for name in js_order)

    inlined_data = (
        "// ---- inlined by build/build-standalone.py (no server needed) ----\n"
        f"const SEED_DATA = {json.dumps(seed)};\n"
        f"const BG_IMAGE_DATA_URI = {json.dumps(bg_uri)};\n"
    )

    out.write_text(f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
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
""")
    size_mb = out.stat().st_size / (1024 * 1024)
    print(f"Wrote {out.relative_to(ROOT)} ({size_mb:.1f} MB)")


def main() -> None:
    seed = load_seed()
    bg_uri = image_data_uri(seed)

    build(APP_OUT, "POC3 Dwelling Inventory Map", "index.html",
          APP_JS_ORDER, ["styles.css"], seed, bg_uri)
    build(EDITOR_OUT, "Region Editor — POC3 Map", "editor.html",
          EDITOR_JS_ORDER, ["styles.css", "editor.css"], seed, bg_uri)

    print("Double-click either file to run — no server required.")


if __name__ == "__main__":
    main()
