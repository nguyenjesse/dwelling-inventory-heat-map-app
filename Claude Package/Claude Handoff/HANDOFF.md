# HANDOFF — Cowork → Code · 2026-07-26

## Task
The app is functionally complete and working. There's no required next build —
this is a "pick up if the user asks" handoff. The most likely next asks are:
(a) open a PR to merge the branch into `main`, (b) fine-tune region box
positions on the Green Mile plan, or (c) shrink the standalone file size. Do
none of these unless the user asks.

**Git:** everything is on branch `claude/inventory-heatmap-html-app-h8msac`,
latest commit `2aa0d89` (this handoff will add one more). PR #1 already merged to
`main`; the Green Mile swap + standalone build are branch-only, **not** merged.
Check out that branch to get the current state.

## Decisions already made — don't re-litigate
- **Vanilla HTML/CSS/JS, no build step, no npm.** Served as static files.
- **Two run modes, one source of truth.** The modular `app/` is the dev version
  (served over HTTP). `build/build-standalone.py` inlines it into a single
  double-click `POC3-Dwelling-Inventory-Map.html`. `model.js` `loadSeed()` and
  `map.js` prefer inlined `SEED_DATA` / `BG_IMAGE_DATA_URI` when present, else
  fetch/asset paths — so both modes run the same code.
- **The single-file standalone is the deliverable for associates** — they need
  to double-click and email it, no server. Chosen over a server/launcher because
  associates can't run a server; over Electron because it's overkill.
- **Persistence = browser `localStorage`, per-machine, not shared** (matches the
  user's requirement that associates' maps stay separate). CSV/JSON import/export
  moves data in/out of Excel.
- **Heat scale corrected from Excel:** zero = gray `#808080` and excluded from
  normalization; positives normalized over positive-only min/max across a true
  3-stop green→yellow→red; all-equal positives → yellow (not all-red).
- **Department stays the zone/grouping field.**
- **Green Mile image is the background;** regions affine-mapped from the original
  CAD image space onto it (see below). Data-driven via `regions.json > meta.image`.

## Constraints that apply
- Develop/push **only** to `claude/inventory-heatmap-html-app-h8msac`.
- **Do NOT open a PR unless the user explicitly asks.**
- After ANY change to `app/` source or `app/data/`, **regenerate the standalone**:
  `python3 build/build-standalone.py`, then verify it (below) before committing.

## Definition of done (for future changes)
- `app/tests/tests.html` shows 25/25 (served run).
- The standalone, opened from `file://`, is **fully styled** with all 61 area
  boxes visible and adding a pallet heat-colors its area. Confirm with a real
  screenshot, not a DOM-node count (see gotcha).

## Context you can't get from the code
- **User's exact problem that drove the standalone:** they could not run a local
  server on their Windows PC, so double-clicking `index.html` just showed the
  "must be served over HTTP" screen. The standalone exists to solve that.
- **Dead end / bug already fixed (commit cf0c292):** first standalone rendered as
  unstyled text with the 61 area boxes invisible ("just text and the map
  background"). Cause: the favicon `<link>` was extracted with regex `[^>]*>`,
  which stopped at the first `>` — but the favicon's SVG `data:` URI contains
  `>`, so the tag truncated with an unterminated `href="` quote and swallowed the
  inlined `<style>`. Fixed by matching to end-of-line (`[^\n]*>`). **My earlier
  DOM-only Playwright check passed and hid this — always screenshot the
  standalone from `file://` when touching head/inlining.**
- **Region alignment:** boxes were reconstructed in the original CAD image space
  from the workbook's own shape anchors, then affine-mapped onto Green Mile
  (`sx≈0.813, sy≈0.902, ox≈5, oy≈19`) from its content bounding box. Close but
  not pixel-perfect; some boxes may sit slightly off. Tune in `editor.html`.
- **Editor is admin-only** and needs the served mode; associates never use it.

## Files from this session to reference (verified on disk, this branch)
- `POC3-Dwelling-Inventory-Map.html` — generated standalone (the deliverable).
  **Do not hand-edit; always regenerate via the build script.**
- `build/build-standalone.py` — the inliner.
- `app/` — modular source (`js/`, `css/`, `data/`, `assets/`, `index.html`,
  `editor.html`, `tests/`). `app/README.md` documents both run modes.
- `app/assets/green-mile.png` (active bg, 1484×1060) ·
  `app/assets/floor-plan.png` (original CAD ref, 1808×1125).
- Data: `app/data/{areas,departments,ibeam-mappings,regions}.json`
  (61 areas / 5 depts / 55 unique I-beams; multi-area I-beams: E16,E17,E19,E20,E25,F12).

## Open questions — ask the user, don't guess
- Merge this branch into `main` via a new PR? (Not done; needs explicit ask.)
- Fine-tune region positions on Green Mile, or leave as-is?
- Shrink the 3.4 MB standalone (background → JPEG ≈ halves it)? Only if file size
  is a problem for emailing.
