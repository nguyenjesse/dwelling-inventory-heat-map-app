# HANDOFF — Code → Code · 2026-07-31 01:30 PT

## What happened this session
Brainstormed improvements, then built four of them on branch
**`claude/startup-skill-dfaove`** (2 commits, pushed): a build timestamp on
generated files, headless CI, rapid keyboard entry, and single-level undo. Also
added a pre-commit hook that auto-rebuilds the standalones. Tests went **49 → 55
green**. **The user will open the PR and merge it manually** — it is *not* merged
yet.

## Changes on disk (branch `claude/startup-skill-dfaove`, not yet merged)
Two feature commits on top of `main` (`2d84b0b`):
- **`3202766`** — the four features:
  - **#1 build timestamp.** Every generated operator file shows a local
    timestamp footer, e.g. `POC3 · built 2026-07-31 14:23 UTC-7`. Python side:
    `build_stamp()` in `build/build-standalone.py` injects `seed.builtAt`. BAM
    in-browser side: `buildStamp()` in `app/js/editor.js` sets `builtAt` in
    `assembleSeed()`. Rendered by `app/js/app.js` from `model.buildInfo()` into
    `#appFooter` (`app/index.html`); hidden in served dev (no `builtAt`).
  - **#2 CI.** `.github/workflows/ci.yml` + `tests/run_ci.py`. `app/tests/tests.js`
    now sets `window.__TEST_RESULT__` as the machine-readable signal.
  - **#5 rapid entry.** All in `app/js/form.js`: an "Advance to next area after
    Save" checkbox auto-selects the next area on the floor and focuses its count.
  - **#6 single-level undo.** `app/js/model.js` gains `lastChange` +
    `canUndo/clearUndo/undo`; `app/js/app.js` wires an `#undo` button + Ctrl/Cmd+Z;
    6 new model tests in `app/tests/tests.js`.
- **`d460ed9`** — the pre-commit hook (`.githooks/pre-commit`) +
  `.claude/settings.json` (SessionStart auto-activation).

## Decisions taken and why (don't re-litigate)
- **Build stamp is a plain wall-clock TIMESTAMP, not a version/content hash.**
  We explicitly rejected a git-commit hash and an app-source content hash: a
  hash baked into a *committed* artifact has a chicken-and-egg problem (the hash
  of HEAD isn't known until after you commit the file that's part of HEAD), and
  it broke the CI rebuild-diff guard. A wall-clock timestamp has no such problem;
  the guard just ignores that one line (below). User picked **local time + UTC
  offset** over UTC or bare local.
- **Undo is single-level, session-only** (one prior value, cleared after use and
  after any import) — user's explicit choice over a multi-level stack or a
  persistent audit log.
- **The pre-commit hook is KEPT.** User works **cloud-only** (no local clones),
  so activation is automatic via `.claude/settings.json` each session and the
  partial-staging caveat never applies. It's a backstop for a forgotten rebuild;
  CI is the real gate. (Kept per user; don't remove without being asked.)
- **BAM localStorage autosave (old item A) is still DEFERRED** — user reaffirmed
  they likely won't build it. Don't propose unprompted.

## Verification status
- **Tests: 55/55 green**, run headless in-container via Node `playwright-core` +
  `headless_shell` (see Dead ends for the exact invocation — `run_ci.py` itself
  can't run here). Includes the 6 new undo tests.
- **Build + guard clean.** Standalones rebuilt and committed; a rebuild is
  **byte-identical except the `builtAt` line** (verified by normalizing that line
  and diffing two builds).
- **`file://` smoke + functional checks passed** on `POC3-Dwelling-Inventory-Map.html`:
  footer renders, 74 areas draw, no page errors; undo reverts a Save and
  re-disables; auto-advance moves selection to the next area and focuses the count.
- **NOT yet verified — flag these:**
  - **The GitHub Actions run itself.** `run_ci.py` depends on `pip install
    playwright` + `playwright install --with-deps chromium` succeeding on the
    runner — unproven on real CI. Watch the first Actions run on the PR.
  - **The SessionStart auto-activation of the hook.** This session set
    `core.hooksPath` manually; the `.claude/settings.json` hook first fires in a
    *fresh* session — confirm `git config --get core.hooksPath` returns
    `.githooks` at next session start.

## Dead ends & gotchas (carried forward — still true)
- **Local headless testing:** `run_ci.py` uses *Python* Playwright, which is NOT
  installed in this container — it's for GitHub Actions only. To run the suite
  here, use Node `playwright-core` (install into the ephemeral scratchpad)
  pointing at `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`,
  serving `app/` over HTTP, and read `window.__TEST_RESULT__`. (Full `chromium`
  won't run headless here; `headless_shell` does.)
- **`app/js/model.js` is git-"binary"** (intentional NUL byte as a map-key
  delimiter, ~line 114). grep it with `-a`. Never "fix" the NUL; hand-merge.
- **The three top-level `*.html` are GENERATED** by `build/build-standalone.py`
  — never hand-edit; rebuild after any `app/` change. The pre-commit hook now
  does this automatically when `app/`/`build/` is staged.
- **CI rebuild-diff guard normalizes the `builtAt` line** (`s/"builtAt": "[^"]*"/…/`)
  before diffing, so the floating timestamp doesn't trip it. If you change the
  `builtAt` JSON key or its format, update the sed in `.github/workflows/ci.yml`
  to match, or the guard will false-positive.
- **Pre-commit hook caveat:** it rebuilds from the working tree, not the staged
  snapshot — a *partial* stage of `app/` bakes unstaged edits into the
  standalones. Irrelevant for the cloud-only "commit it all" flow.
- **Branch deletion over git is blocked** (proxy 403); use the GitHub web UI.
- **Do NOT gitignore `Claude Package/`** — fresh Code-on-web sessions clone the
  repo and see only committed files, so the handoff must stay tracked. (Standing
  decision.)

## Suggested next steps
1. **User opens the PR** from `claude/startup-skill-dfaove` → `main` and merges
   it manually. Nothing else is queued.
2. **Watch the first CI run** on that PR (the two unverified items above). If the
   Playwright install step fails on the runner, the fix lives entirely in
   `.github/workflows/ci.yml` / `tests/run_ci.py`.
3. After merge, restart this branch from the new `main` for any follow-up (the
   merged PR can't take new commits).

## Open questions
- None blocking. (Only lingering idea is the deferred BAM autosave — do not start
  unless the user asks.)
