# HANDOFF — Code → Code · 2026-07-30 15:00 PT

## What happened this session
Built **two new operator-app features** and merged them to `main` via **PR #7**
(branch `claude/startup-skill-run-fhkvyx`): (1) an **Area Breakdown** table and
(2) an **Inbound/Outbound** summary plus category filtering. Also confirmed two
long-carried open questions with the user (both resolved — see below). All work
is docs-free app code + tests; verified green in real Chromium.

## Changes on disk (merged to `main` via PR #7)
Two feature commits: `e6a24d3` (Area Breakdown) and `49dcc5a` (Inbound/Outbound).
- **`app/js/breakdown.js`** (new) — `createBreakdown` factory: per-department
  roll-up table in the right info column. Top row = department (+ pallet total);
  click to expand → its areas with columns **Area / Pole Location (I-Beam) /
  Pallet Count**. Shows all depts+areas on the current floor incl. zeros;
  expansion state persists across re-renders.
- **`app/js/iosummary.js`** (new) — `createIoSummary` factory: compact
  Outbound / Inbound / Total roll-up, mounted under Record pallet count in the
  left column.
- **`app/js/model.js`** — added `CATEGORIES` const (single source of truth) +
  `categories()`, `categoryOfDept()`, `categoryTotal()`. Outbound = docksort,
  ob-dock, sort, fluid-load; Inbound = ib-dock, rpn. `categoryTotal` is global
  (all floors), matching `totalPallets()`.
- **`app/js/app.js`** — wired both views into `refresh()`; rebuilt `#deptFilter`
  to group the 6 depts under Outbound/Inbound optgroups, each with a
  `cat:<id>` "(all)" option; `applyFilterDim()` parses `""` / `cat:<id>` /
  `<deptId>`. Category filter dims the **map only** (deliberate — see decisions).
- **`app/index.html`** (both mount points), **`app/css/styles.css`**
  (`.breakdown*`, `.io-stats`), **`build/build-standalone.py`** (added
  `breakdown.js` + `iosummary.js` to `APP_JS_ORDER`; both `POC3-*.html`
  standalones regenerated), **`app/tests/tests.js`** (9 new tests).

## Verification status
- **Test suite 41/41 green** in real Chromium over HTTP (headless_shell at
  `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell` —
  NOTE: the full `chromium` binary is `--headless=old` and now refuses to launch;
  use headless_shell. Serve `app/` with `python3 -m http.server`).
- Live-checked in browser (screenshots): breakdown expand + column order; IO
  summary math (Outbound/Inbound/Total); `#deptFilter` groups exactly as spec'd;
  `cat:inbound` leaves precisely the 20 inbound areas un-dimmed. Zero console
  errors besides the harmless favicon 404.
- **User reviewed PR #7 and approved the merge to `main`.**

## Decisions taken this session
- **Category filter dims the map only** (user choice) — the Area Breakdown table
  and IO summary always show everything, so a hidden category can still be
  compared. Single-select dropdown: picking one category hides the other.
- **Categories live in code, not `departments.json`** — avoids data-migration +
  validation + editor churn for a fixed 6-department business rule.
- **Two carried open questions RESOLVED by the user** (no longer open): "Save
  count" correctly **sets** an area's absolute count (not increment); **one
  floor per area** is confirmed correct as enforced.

## Dead ends & gotchas
- **`chromium` (full) won't run headless** here ("Old Headless mode has been
  removed"). Use the **headless_shell** binary (path above). This bit the first
  verification run — don't repeat it.
- Playwright harness ran entirely in the **session scratchpad** (installed
  `playwright-core` there, not in the project). Keep it that way — never commit
  `node_modules`/`package*.json` (dependency-free static project).
- **Do NOT gitignore `Claude Package/`** — fresh Code-on-web sessions clone the
  repo and see only committed files, so the handoff must stay tracked or the
  baton breaks. (Standing decision; overrides the generic "gitignore it" advice.)
- Branch deletion still fails through the git proxy — the **user deletes branches
  themselves** in the GitHub UI (they will do so before the next session).

## Suggested next steps
1. **Nothing is queued.** `main` has both features, tests green, standalones
   rebuilt. Branch fresh off `origin/main` for any new work (same branch name is
   fine per the workflow).
2. If the IO breakdown ever needs more detail, the natural extension is a
   per-category expandable department list (reuse `breakdown.js`'s toggle pattern
   + `model.categories()`), and/or category area-counts alongside pallet totals.

## Open questions
- None outstanding. (Both previously-carried questions were resolved this
  session.)
