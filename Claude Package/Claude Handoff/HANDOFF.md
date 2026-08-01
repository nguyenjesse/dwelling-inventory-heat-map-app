# HANDOFF — Code → Code · 2026-08-01 03:21 UTC

## What happened this session
Ran `startup`, then brainstormed feature ideas and **scoped, planned, and shipped
five** of them plus **two follow-up CSS fixes** — all reviewed, opened as PRs, and
**merged to `main` by the user**. `main` is now at **`ef11eba`**. Nothing is queued.

The five features (see the eight commits below): operator area quick-search,
data-schema versioning, editor undo/redo, editor bulk area operations, and dated
export filenames.

## Changes on disk (all merged to `main`)
Commits `8bbad2c`…`828b916` (plus merge `ef11eba`):
- **`8bbad2c` #2 operator quick-search** — `app/js/form.js` gains a type-ahead box
  (name/I-Beam) + a pure exported `matchAreas()`; results route through the existing
  dropdown/`onSelectArea` path and focus the count field. Styling in `styles.css`.
- **`efb5195` #16 schema versioning** — new `app/js/schema.js` (`SCHEMA_VERSION=1`,
  `migrate`, `readVersion`, `resolveProjectBundle`). BAM `loadProject` now version-
  checks (migrate older / warn on newer); `saveProject` + `assembleSeed` +
  `build-standalone.py` stamp the version; `validate.js` warns on a too-new seed;
  counts key version centralized. `schema.js` is first in both bundle orders.
- **`d786dcd` #7 editor undo/redo** — new `app/js/history.js` (generic bounded
  stack). `editor.js` snapshots/restores editable state, `commitHistory()` wired
  into every mutation, coalesced per gesture. Undo/Redo buttons + Ctrl/⌘+Z /
  Shift+Z (skips text fields). `restore()` preserves selection when the area
  survives.
- **`242e86f` #9 bulk operations** — new `app/js/selection.js` (pure `rangeSelect`).
  Ctrl/Shift-click multi-select in the sidebar + a bulk bar (move-to-department,
  duplicate, delete), each one undo step. `selection.js` in the editor bundle order.
- **`f2bee85` #12 dated exports** — `exportFilename(base, ext, date)` in
  `importexport.js`, used by `app.js` for CSV+JSON. Filename-only; payloads
  unchanged, so imports round-trip identically.
- **`3ff1925` + `828b916` CSS fixes** — `.ed-bulk[hidden]` and `.ed-empty[hidden]`
  `{ display: none }` so the `hidden` attribute actually hides them (see gotcha).

## Decisions taken and why (don't re-litigate)
- **Schema baseline is v1 and purely additive** — the migration registry is empty,
  `migrate()` is a no-op today. Nothing changes shape now; the plumbing exists so a
  future shape change can bump `SCHEMA_VERSION` and register a migrator.
- **`app/js/model.js` was deliberately NOT modified** — it carries the intentional
  NUL delimiter (~line 114). The schema guard reads `seed.schemaVersion` directly in
  `validate.js` instead, so touching model.js was unnecessary. Keep it untouched.
- **#9 is sidebar multi-select only.** Map marquee/rubber-band select was scoped as
  a deliberate phase-2 follow-up, not built.
- **#12 is dated-filename only** — no in-app snapshot storage and no JSON
  `{schemaVersion,takenAt,counts}` wrapper (kept to the user's "just a button"
  framing; the wrapper is a noted optional if they ever want self-dating files).
- **Undo is snapshot-based with selection-preserving restore** (keeps you on the
  edited area if it survived; re-selects a restored area after an undo of a delete).

## Verification status
- **Tests: 82/82 green** (was 55; +27 across the phases), run headless in-container
  via Node `playwright-core` + `headless_shell` (see Dead ends).
- **Per-feature functional smokes** passed both served over HTTP and from the built
  `file://` standalones: search select/focus, project version guard, undo/redo of
  new/rename/delete + keyboard, bulk dup/delete/move with undo, dated download
  filenames, and both `[hidden]` fixes via **computed `display`**.
- **CI rebuild-diff guard simulated locally = green** for all three standalones
  (ignoring the floating `builtAt`). The user's merged PRs carried real CI.

## Dead ends & gotchas (carried forward — still true)
- **`[hidden]` + author `display` trap:** an author rule like `.ed-bulk{display:flex}`
  overrides the UA `[hidden]{display:none}`, so `el.hidden = true` sets the property
  but the element stays visible. Fix is `.selector[hidden]{display:none}` (done for
  `.ed-bulk` and `.ed-empty`). **Watch for this on any toggled flex/grid element.**
- **Smokes must assert computed `display`, not `el.hidden`** — the property toggled
  correctly the whole time and hid the bulk-bar bug from the first smoke pass.
- **Local headless testing:** `tests/run_ci.py` uses *Python* Playwright, absent
  in-container. Use Node `playwright-core` (installed into the scratchpad) with
  `executablePath: /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`;
  full chromium won't run headless here, `headless_shell` does. `import pkg from
  'playwright-core'; const { chromium } = pkg;` (CommonJS).
- **`app/js/model.js` is git-"binary"** (intentional NUL, ~line 114) — grep `-a`,
  never "fix" it, hand-merge.
- **The three top-level `*.html` are GENERATED** by `build/build-standalone.py`;
  never hand-edit — the pre-commit hook rebuilds them when `app/`/`build/` is staged.
- **CI rebuild-diff guard normalizes only the `builtAt` line;** a new *stable* seed
  field is fine as long as the standalones are rebuilt + committed.
- **Branch deletion over git is blocked** (proxy 403); use the GitHub web UI.
- **Do NOT gitignore `Claude Package/`** — fresh Code-on-web sessions clone the repo
  and see only committed files, so this handoff must stay tracked on `main`.
- **This repo's layout differs from the skill's `main/` convention:** the app lives
  under `app/`, and the handoff at `Claude Package/Claude Handoff/HANDOFF.md`.

## Suggested next steps
- **Nothing queued.** All requested work is merged to `main`. Await direction.
- If follow-up starts, branch fresh from `main` (this branch's PR is merged and
  can't take new commits).
- Deferred ideas, only if the user asks: **#9 map marquee-select** (phase 2);
  **#12 JSON `{schemaVersion,takenAt,counts}` export wrapper** (self-dating files,
  round-trips through `importCounts` already); the long-deferred **BAM localStorage
  autosave**.

## Open questions
- None blocking.
