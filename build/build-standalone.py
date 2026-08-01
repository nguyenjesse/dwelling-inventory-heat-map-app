#!/usr/bin/env python3
"""Build single self-contained HTML files from the modular app/ source.

The served app loads its data and image over HTTP with ES modules + fetch,
which browsers block on file://. This script inlines everything — the data JSON
files, the CSS, the background image (as a base64 data: URI), and the JS modules
(import/export stripped, merged into one classic <script>) — so the result opens
by double-click, works fully offline, and can be emailed/shared as one file.
Each user's data lives in their own browser localStorage.

Files produced at the repo root:
  POC3-Dwelling-Inventory-Map.html   the operator app for THIS site (POC3)
  POC3-Building-Area-Manager.html    the editor pre-loaded with POC3's layout
  Building-Area-Manager.html         a BLANK editor to hand to other sites

Building Area Manager (BAM) can generate a site's operator file itself, in the
browser: its build embeds the operator page as a string template (OPERATOR_TEMPLATE)
with placeholder tokens where the per-site SEED_DATA / BG_IMAGE_DATA_URIS go, and
fills them from the current layout on "Build operator file". So a receiving site
never needs Python, a terminal, or this repo — just the one HTML file.

Run:  python3 build/build-standalone.py
"""

import base64
import datetime
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"

# Outputs
OPERATOR_OUT = ROOT / "POC3-Dwelling-Inventory-Map.html"   # this site's operator app
BAM_POC3_OUT = ROOT / "POC3-Building-Area-Manager.html"    # editor seeded with POC3
BAM_BLANK_OUT = ROOT / "Building-Area-Manager.html"        # blank editor (distributable)

# This repo's own site identity, baked into the POC3 builds.
SITE_CODE = "POC3"

# Data-model schema version stamped into generated seeds. Keep in sync with
# SCHEMA_VERSION in app/js/schema.js.
SCHEMA_VERSION = 1

# Tokens the editor's opbuild.js replaces inside OPERATOR_TEMPLATE. Keep in sync
# with SEED_TOKEN / BG_TOKEN in app/js/opbuild.js.
SEED_TOKEN = '"__BAM_SEED_DATA__"'
BG_TOKEN = '"__BAM_BG_IMAGE_DATA_URIS__"'

# JS modules in dependency order. Everything lands in one scope, so anything
# referenced at load time must be defined before its first use.
APP_JS_ORDER = [
    "schema.js",
    "storage.js",
    "heatmap.js",
    "validate.js",
    "importexport.js",
    "model.js",
    "panel.js",
    "legend.js",
    "breakdown.js",
    "iosummary.js",
    "modal.js",
    "form.js",
    "map.js",
    "app.js",
]

# The editor needs the seed/model/storage, the download + operator-template
# helpers, and its own logic.
EDITOR_JS_ORDER = [
    "schema.js",
    "history.js",
    "storage.js",
    "importexport.js",
    "opbuild.js",
    "model.js",
    "editor.js",
]

# A genuinely empty manifest for the distributable editor — no floors/areas/depts,
# just the two fixed flow categories a site tags its departments into.
BLANK_SEED = {
    "siteCode": "",
    "siteName": "",
    "schemaVersion": SCHEMA_VERSION,
    "floors": [],
    "areas": [],
    "departments": [],
    "ibeamMappings": [],
    "regions": {"regions": {}},
    "categories": [
        {"id": "outbound", "name": "Outbound"},
        {"id": "inbound", "name": "Inbound"},
    ],
}

IMPORT_RE = re.compile(r"^\s*import\s.*?;\s*$", re.MULTILINE)
EXPORT_RE = re.compile(r"^(\s*)export\s+(?=(?:async\s+)?function|const|let|class)", re.MULTILINE)


def strip_module_syntax(src: str) -> str:
    """Remove `import ... ;` lines and the `export` keyword from declarations."""
    src = IMPORT_RE.sub("", src)
    src = EXPORT_RE.sub(r"\1", src)
    return src


def build_stamp() -> str:
    """Local build timestamp 'YYYY-MM-DD HH:MM UTC±H', matching editor.js buildStamp."""
    now = datetime.datetime.now().astimezone()
    off_min = int(now.utcoffset().total_seconds() // 60)
    sign = "+" if off_min >= 0 else "-"
    off_h, off_rem = divmod(abs(off_min), 60)
    off = f"UTC{sign}{off_h}" + (f":{off_rem:02d}" if off_rem else "")
    return now.strftime("%Y-%m-%d %H:%M ") + off


def load_seed() -> dict:
    data = APP / "data"
    seed = {
        "siteCode": SITE_CODE,
        "siteName": SITE_CODE,
        "schemaVersion": SCHEMA_VERSION,
        "builtAt": build_stamp(),
        "floors": json.loads((data / "floors.json").read_text()),
        "areas": json.loads((data / "areas.json").read_text()),
        "departments": json.loads((data / "departments.json").read_text()),
        "ibeamMappings": json.loads((data / "ibeam-mappings.json").read_text()),
        "regions": json.loads((data / "regions.json").read_text()),
    }
    cats = data / "categories.json"
    if cats.exists():
        seed["categories"] = json.loads(cats.read_text())
    return seed


def _data_uri(name: str) -> str:
    img = APP / "assets" / name
    ext = img.suffix.lower().lstrip(".")
    mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "gif": "image/gif", "webp": "image/webp"}.get(ext, "image/png")
    b64 = base64.b64encode(img.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def image_data_uris(seed: dict) -> dict:
    """{ image filename -> base64 data: URI } for every floor's background."""
    names = []
    for floor in seed.get("floors", []):
        name = floor.get("image")
        if name and name not in names:
            names.append(name)
    if not names:  # pre-floor fallback
        names = [seed["regions"].get("meta", {}).get("image", "floor-plan.png")]
    return {name: _data_uri(name) for name in names}


def body_from(html: str, *, editor_link_target=None, as_template=False) -> str:
    """Pull the inner <body> markup, minus the module <script>.

    - editor_link_target: retarget the operator's "Region editor" link to this
      standalone filename (the served relative href won't resolve).
    - as_template: producing the site-agnostic operator template embedded in the
      editor — strip the editor link entirely (associates have no editor sibling)
      and neutralize the hard-coded site title.
    """
    body = re.search(r"<body>(.*)</body>", html, re.DOTALL).group(1)
    body = re.sub(r'<script\s+type="module".*?</script>', "", body, flags=re.DOTALL)
    if as_template:
        body = re.sub(r'<a[^>]*href="\./editor\.html"[^>]*>.*?</a>', "", body, flags=re.DOTALL)
        body = body.replace("<h1>POC3 Dwelling Inventory Map</h1>", "<h1>Dwelling Inventory Map</h1>")
    elif editor_link_target:
        body = body.replace('href="./editor.html"', f'href="{editor_link_target}"')
    return body.strip()


def favicon_from(html: str) -> str:
    # The favicon href is an SVG data: URI containing '>' characters, so match to
    # end-of-line (not the first '>') or it truncates mid-tag and breaks <head>.
    return re.search(r'<link rel="icon"[^\n]*>', html).group(0)


def js_bundle(js_order) -> str:
    return "\n\n".join(
        strip_module_syntax((APP / "js" / name).read_text()) for name in js_order)


def page(title: str, favicon: str, css: str, body: str, script_body: str) -> str:
    return f"""<!doctype html>
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
{script_body}
  </script>
</body>
</html>
"""


def operator_script(seed_literal: str, bg_literal: str, bundle: str) -> str:
    return (
        "// ---- inlined by build/build-standalone.py (no server needed) ----\n"
        f"const SEED_DATA = {seed_literal};\n"
        f"const BG_IMAGE_DATA_URIS = {bg_literal};\n\n"
        f"{bundle}"
    )


def validate_operator_template(operator_template: str, template_literal: str) -> None:
    """Fail loudly if the template the editor embeds is unusable.

    The editor builds each receiving site's operator file by substituting into
    OPERATOR_TEMPLATE in the browser. A degenerate template (empty body, missing
    JS, missing placeholder tokens) or a broken escape would still produce a
    valid-looking editor whose "Build operator file" silently emits a blank page,
    with no error until someone opens the result. Catch it here instead.
    """
    problems = []
    if len(operator_template) < 500:
        problems.append(
            f"template is empty or too small ({len(operator_template)} chars) — "
            "body/CSS/JS inlining likely failed")
    for token in ("__BAM_SEED_DATA__", "__BAM_BG_IMAGE_DATA_URIS__"):
        if token not in operator_template:
            problems.append(
                f"placeholder token {token!r} missing — opbuild.js can't fill the "
                "seed/image data")
    if "<script>" not in operator_template:
        problems.append("no <script> block — the operator app's JS bundle is missing")
    # The template embeds as a JS string inside the editor's own <script>; a raw
    # </script> (any unescaped '<') closes that tag early and blanks the editor.
    if re.search(r"</script", template_literal, re.IGNORECASE):
        problems.append(
            "embedded template still contains a raw '</script' — the "
            "'<' -> '\\u003c' escaping did not apply")
    if problems:
        raise SystemExit(
            "OPERATOR_TEMPLATE validation failed; refusing to write the editor:\n  - "
            + "\n  - ".join(problems))


def build_operator_template(css: str) -> str:
    """The site-agnostic operator page, as a string with placeholder tokens for
    SEED_DATA / BG_IMAGE_DATA_URIS, to embed in the editor for in-browser builds."""
    index_html = (APP / "index.html").read_text()
    body = body_from(index_html, as_template=True)
    favicon = favicon_from(index_html)
    bundle = js_bundle(APP_JS_ORDER)
    script_body = operator_script(SEED_TOKEN, BG_TOKEN, bundle)
    # Title is set at runtime from SEED_DATA.siteCode; keep a generic static one.
    return page("Dwelling Inventory Map", favicon, css, body, script_body)


def write(out: Path, html: str) -> None:
    out.write_text(html)
    size_mb = out.stat().st_size / (1024 * 1024)
    print(f"Wrote {out.relative_to(ROOT)} ({size_mb:.1f} MB)")


def main() -> None:
    app_css = (APP / "css" / "styles.css").read_text()
    editor_css = app_css + "\n" + (APP / "css" / "editor.css").read_text()

    seed = load_seed()
    bg_uris = image_data_uris(seed)

    # 1) This site's operator app.
    index_html = (APP / "index.html").read_text()
    operator_html = page(
        f"{SITE_CODE} Dwelling Inventory Map",
        favicon_from(index_html),
        app_css,
        body_from(index_html, editor_link_target=BAM_POC3_OUT.name),
        operator_script(json.dumps(seed), json.dumps(bg_uris), js_bundle(APP_JS_ORDER)),
    )
    write(OPERATOR_OUT, operator_html)

    # 2) The operator template the editor embeds to generate other sites' files.
    operator_template = build_operator_template(app_css)

    # 3) Editor standalones (POC3-seeded for our own use + a blank distributable).
    editor_html = (APP / "editor.html").read_text()
    editor_favicon = favicon_from(editor_html)
    editor_body = body_from(editor_html)
    editor_bundle = js_bundle(EDITOR_JS_ORDER)

    # The operator template is a full HTML document embedded as a JS string inside
    # the editor's own <script>. Its literal "</script>" (and other "<" markup)
    # would otherwise close that script tag early, so escape every "<" as < —
    # valid JSON that decodes back to real markup at runtime.
    template_literal = json.dumps(operator_template).replace("<", "\\u003c")

    # Guard: a degenerate or mis-escaped template would still emit a working-looking
    # editor whose "Build operator file" silently produces a blank operator page.
    validate_operator_template(operator_template, template_literal)

    def editor_script(seed_literal: str, bg_literal: str) -> str:
        return (
            f"const SEED_DATA = {seed_literal};\n"
            f"const BG_IMAGE_DATA_URIS = {bg_literal};\n"
            f"const OPERATOR_TEMPLATE = {template_literal};\n\n"
            f"{editor_bundle}"
        )

    write(BAM_POC3_OUT, page(
        "Building Area Manager — POC3", editor_favicon, editor_css, editor_body,
        editor_script(json.dumps(seed), json.dumps(bg_uris))))

    write(BAM_BLANK_OUT, page(
        "Building Area Manager (BAM)", editor_favicon, editor_css, editor_body,
        editor_script(json.dumps(BLANK_SEED), "{}")))

    print("Double-click any file to run — no server required.")


if __name__ == "__main__":
    main()
