# HANDOFF — Code → Code · 2026-07-31 13:40 PT

## What happened this session
Reviewed the previously-merged four-feature branch (all CI-verified green), then
shipped **two** more changes, each opened as a PR and **merged by the user to
`main`**:
1. **Alphabetical area sorting** (PR #11, merged) — areas now list A→Z *within*
   each department across all three area listings.
2. **Removed the "advance to next area after Save" auto-enter feature** (PR #12,
   merged) — per user request, the rapid-entry auto-advance is gone from the
   operator app.

`main` is at **`676b7d9`**; everything below is already merged. Nothing is queued.

## Changes on disk (all in `main`)
- **Alphabetical sort (render-time only, no data/model changes):**
  - `app/js/form.js` — operator dropdown: sort each optgroup's areas.
  - `app/js/breakdown.js` — Area Breakdown table: sort areas within each dept.
  - `app/js/editor.js` + `app/css/editor.css` — editor list rewritten to render
    **department group headers** with areas sorted under each; `.dept-group-header`
    style added. Add/duplicate/dept-change re-place via `renderList`; **rename
    re-sorts on `change` (blur/Enter), not per-keystroke**, to protect the caret.
- **Auto-enter removal:** `app/js/form.js` lost the checkbox, its handler, the
  post-Save advance block, and the `orderedIds` array (its only consumer). The
  alphabetical option sort was kept. `.form-advance` rule removed from
  `app/css/styles.css`.
- Three top-level `*.html` standalones rebuilt by the pre-commit hook.

## Decisions taken and why (don't re-litigate)
- **Sort is numeric-aware `localeCompare(..., { numeric: true })`** so "Phase 2"
  precedes "Phase 10" — matches the existing I-beam sort idiom (model.js:156).
  **Department order is preserved** everywhere; only areas *within* a dept sort.
- **Editor got department GROUP HEADERS** (user's explicit pick over a flat
  sorted list or pure-alphabetical). Empty/filtered groups hide their header.
- **Rename re-places on commit, not on every keystroke** — a per-keystroke
  re-render would steal the caret.
- **Auto-enter feature intentionally REMOVED — do not re-add** it unless asked.
- **Build-timestamp timezone: leave as-is.** The committed standalones are built
  server-side (UTC container/CI), so their footer reads `UTC+0`; files an
  operator generates from the in-browser BAM stamp the *browser's* local zone.
  User **rejected hard-coding a timezone** because the tool may go national —
  UTC for server-built files is the accepted, honest default. Don't "fix" this.

## Verification status
- **Tests: 55/55 green**, headless in-container (see Dead ends for the exact
  Node invocation — `run_ci.py` itself can't run here).
- **Real GitHub Actions CI verified green** on the merged work — the previously
  unproven `pip install playwright` + `playwright install` step and the
  rebuild-diff guard both pass on the runner.
- **SessionStart hook auto-activation confirmed** this session:
  `git config --get core.hooksPath` returns `.githooks` (was unverified before).
- **Functional headless checks passed:** all three listings sort A→Z within dept;
  editor rename/add/dept-change re-place correctly; after removal the auto-enter
  checkbox is gone and Save no longer advances (selection stays put). No page
  errors in any check.

## Dead ends & gotchas (carried forward — still true)
- **Local headless testing:** `tests/run_ci.py` uses *Python* Playwright, NOT
  installed here — it's for GitHub Actions only. To run the suite in-container,
  use Node `playwright-core` (install into the scratchpad) with
  `executablePath: /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`,
  serve `app/` over HTTP, and read `window.__TEST_RESULT__`. Import quirk:
  `import pkg from 'playwright-core'; const { chromium } = pkg;` (it's CommonJS).
  Full `chromium` won't run headless here; `headless_shell` does.
- **`app/js/model.js` is git-"binary"** (intentional NUL byte as a map-key
  delimiter, ~line 114). grep with `-a`; never "fix" the NUL; hand-merge.
- **The three top-level `*.html` are GENERATED** by `build/build-standalone.py`
  — never hand-edit; the pre-commit hook rebuilds them when `app/`/`build/` is
  staged.
- **CI rebuild-diff guard normalizes the `builtAt` line** before diffing. If you
  change the `builtAt` JSON key/format, update the sed in `.github/workflows/ci.yml`.
- **Branch deletion over git is blocked** (proxy 403); use the GitHub web UI.
- **Do NOT gitignore `Claude Package/`** — fresh Code-on-web sessions clone the
  repo and see only committed files, so the handoff must stay tracked. (Standing
  decision; this handoff lives on `main` for exactly that reason.)

## Suggested next steps
- **Nothing queued.** All requested work is merged to `main`. Await new direction.
- If follow-up work starts, branch fresh from `main` (the merged PRs can't take
  new commits).

## Open questions
- None blocking. (Only lingering idea is the long-deferred BAM localStorage
  autosave — do not start unless the user asks.)
