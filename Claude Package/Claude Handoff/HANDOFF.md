# HANDOFF — Code → Code · 2026-08-01 05:40 UTC

## What happened this session
Ran `startup`, cleaned up the stale merged branch, then shipped **two of the
deferred ideas**: #12 self-dating JSON export wrapper, and a set of editor
multi-select quality-of-life upgrades (clearer styling + map Ctrl-click + group
move/nudge). All reviewed and smoke-tested. **Work is NOT yet on `main`** — it
sits as two commits on `claude/startup-skill-ce8u3c`; the user will manually
open a PR and merge.

## Changes on disk (branch `claude/startup-skill-ce8u3c`, 2 commits ahead of `main` @ `b94c5e6`)
- **`fb5e826` — #12 export wrapper + clearer multi-select styling**
  - `app/js/importexport.js`: `exportJson` now returns
    `{ schemaVersion, takenAt, counts:[...] }` (imports `SCHEMA_VERSION` from
    `schema.js`). Inner `counts` array unchanged, so it round-trips through
    `importCounts` (which already reads `parsed.counts`) — imports byte-compatible.
  - `app/css/editor.css`: multi-selected map areas were only a denser blue; now a
    distinct **violet fill + dashed outline**; the primary keeps an orange dashed
    stroke; sidebar rows get a violet accent bar (`.ed-area.multi`,
    `.ed-area.active.multi`, `.area-list li.multi-selected`).
- **`694d06e` — map multi-select + group move/nudge**
  - `app/js/selection.js`: new pure `clampGroupDelta(boxes, dx, dy, W, H)` —
    clamps a shared translation by the group's bounding box (unit-tested).
  - `app/js/editor.js`: map **Ctrl/⌘-click** toggles selection; grabbing a
    selected box drags the whole group by one shared delta; plain click isolates;
    arrow keys nudge the group (4px / Alt 1px). See the pointerdown/move/`end()`
    and keydown-nudge blocks.
- Standalones (`*.html`) rebuilt by the **pre-commit hook** (it IS installed and
  fires in this clone — rebuilds when `app/`/`build/` is staged).

## Decisions taken and why (don't re-litigate)
- **Multi-area resize: user chose to SKIP it entirely.** Scoped three variants —
  (A) "Match size" bulk button [low effort/high value], (B) group bbox
  proportional-scale handles [high effort/low value here], (C) uniform edge-grow
  [skip]. Recommended A only; user declined all. Don't rebuild this analysis.
- **No Shift-range select on the map** (user's call) — sidebar range is list-order,
  which reads oddly against spatial layout. Ctrl/⌘-click toggle is the only map gesture.
- **Group is clamped as one bounding box, never per-area** — this is the whole point:
  an aligned row stays aligned at a canvas edge instead of bunching. Keep it that way.
- **Click-to-isolate**: a plain click (no travel >3px) on a selected box collapses
  to it; press-drag moves the group. Resolved on pointer-up via the `dragMoved` flag.
- **Export wrapper is filename-independent metadata only** — no in-app snapshot store.

## Verification status
- **Unit tests: 89/89 green** (was 82; +3 JSON-wrapper, +4 `clampGroupDelta`).
- **Functional smoke 8/8** in real headless Chromium: map Ctrl-click selection,
  shared drag delta across all boxes, selection survives drag, 4px group nudge,
  click-to-isolate. Verified visually too (group drags as a rigid unit).
- The user confirmed in-app: "tested it out and it all works and looks good."

## Dead ends & gotchas (carried forward — still true)
- **The `.multi` CSS class is on EVERY selected box, including the active one**
  (`ed-area active multi`). A smoke assertion of "2 multi + 1 active" is wrong —
  it's N multi total. Bit me once.
- **Local headless testing:** `tests/run_ci.py` uses *Python* Playwright (absent
  in-container). Use Node `playwright-core` installed into the **scratchpad**
  (ephemeral — reinstall next session with `npm install playwright-core`), with
  `executablePath: /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`
  (full chromium won't run headless here; `headless_shell` does). Serve `app/`
  over HTTP and read `window.__TEST_RESULT__` — no scraping. Scratch runners
  (`run_tests.mjs`, `smoke.mjs`) were in the session scratchpad, now gone.
- **`app/js/model.js` is git-"binary"** (intentional NUL ~line 114) — grep `-a`,
  never "fix" it, hand-merge. It was NOT touched this session.
- **The top-level `*.html` are GENERATED** — never hand-edit; the pre-commit hook
  rebuilds them. CI rebuild-diff guard normalizes only the floating `builtAt` line.
- **Branch deletion over git is blocked** (proxy 403) — use the GitHub web UI.
- **Do NOT gitignore `Claude Package/`** — fresh Code-on-web sessions clone the
  repo and see only committed files, so this handoff must stay tracked.
- **Repo layout differs from the skill's `main/` convention:** app is under `app/`,
  handoff at `Claude Package/Claude Handoff/HANDOFF.md`.

## Suggested next steps
- **User's next action:** open a PR from `claude/startup-skill-ce8u3c` and merge to
  `main` (CI carries the real rebuild-diff guard). Nothing else queued.
- If follow-up work starts AFTER that merge, branch fresh from `main` (this branch's
  PR will be merged and can't take new commits).
- Deferred ideas still on the shelf, only if asked: **#9 map marquee/rubber-band
  select** (phase 2); **BAM editor autosave to localStorage** (the *editor* WIP has
  no persistence — the operator counts already autosave via `storage.js`);
  **"Match size" bulk action** (option A above — the one multi-resize variant worth
  building if they change their mind).

## Open questions
- None blocking.
