# HANDOFF — Code → Code · 2026-08-01 20:55 UTC

## What happened this session

Picked up the previous baton, found the marquee work had been **merged by the user**
(PRs #16 and #17 — the old baton's "unmerged, no PR" is dead). Ran the manual test
checklist, which found **two separate defects in the same drag gesture**. Both are fixed,
manually confirmed, and open as **PR #18** (`claude/startup-skill-fj1fn3` → `main`,
commits `0b06a42` and `4fcc15e`). CI green on both. This session is subscribed to PR #18
activity.

## The one thing to read before touching editor drag code

**Automated tests in this app cannot catch native drag-and-drop bugs.** Synthetic mouse
events (Playwright `page.mouse`) never trigger native DnD, so three consecutive rounds of
browser checks passed green while a total drag lock-up was live in the app. The bug was
found *by hand* and identified from a single detail the user reported: the cursor turned
into the **no-drop "Cancel Circle"**, which is the native DnD cursor.

Consequence for future work: a green Playwright run over the editor's gestures is **not**
evidence that dragging works. Tests here must assert the *mechanism* (is the stage
unselectable? is `dragstart` refused? does a drag leave a selection behind?) rather than
the gesture, because the gesture tests green either way.

## The two defects (both were real; only the second was the user's complaint)

**1. Native drag killed the pointer stream (`4fcc15e`) — the actual lock-up.**
Nothing suppressed browser defaults on the editor stage. Every drag left a document text
selection behind; the *next* `pointerdown` inside that selection made the browser start a
native HTML5 drag instead of delivering `pointermove`. Box crept a few pixels, cursor went
no-drop, gesture dead. Clicking the Lock checkbox or another box collapsed the selection
and bought exactly one more working drag — which is why it looked intermittent. Long
standing, predates the marquee work, unrelated to overlapping.
Fixed at four points, and **all four are load-bearing** — each alone leaves a gap:
`user-select`/`touch-action: none` on `.stage`; `draggable="false"` on `#edImg`; a
`dragstart` handler that preventDefaults; `preventDefault()` in the svg `pointerdown`.

**2. Selected boxes painted underneath neighbours (`0b06a42`).**
`drawAll()` repainted in model order, so a box dragged onto a neighbour later in that
order was buried under it, and SVG hit-testing (which follows paint order) gave the next
press to the neighbour. Fixed with a pure `paintOrder()` helper in `selection.js`;
selected boxes paint last. `marqueeEntries()` still reads model order, so sweep hit-order
is unchanged.

**Do not assume #2 fixed the lock-up — it did not.** That was this session's wrong turn
(below). Two defects, one gesture.

## Dead ends and wrong turns — don't repeat these

- **First diagnosis of the lock-up was wrong.** Concluded it was the paint-order bug,
  fixed it, shipped it, and the user retested: still broken. Paint order *was* a genuine
  bug (user's R5/R6 confirm it's fixed), but it was never the reported symptom.
- **Theorised `pointercancel` from text selection, then discarded it** because a headless
  repro showed `pointercancel: 0` and an empty `getSelection()`. That discard was the
  mistake — the theory was essentially right, and headless simply cannot reproduce it.
- **Two "failures" during verification were test artifacts, not app bugs.** Playwright
  clamps mouse moves at the viewport edge, which looks exactly like a lock-up (reload and
  re-select before a resize block). And `.ed-area` under a *locked* editor is
  `cursor: default`, not `move` — the editor boots locked.
- **`tests/run_ci.py` cannot run in a Code-on-web container.** The pip `playwright`
  package wants browser build 1234; only 1194 is present, and `playwright install` is
  disallowed here. Workaround: drive `app/tests/tests.html` with node `playwright-core` at
  `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell` and read
  `window.__TEST_RESULT__`. CI itself is unaffected.

## Verification status

- **102/102 unit tests** (97 existing + 5 new for `paintOrder`), **30 browser checks**,
  **CI green on both commits** including the rebuild-diff guard.
- **Rebuild is reproducible** — re-running `build/build-standalone.py` yields no diff
  beyond the floating `builtAt` line in the two POC3 files.
- **Manually confirmed by the user across three rounds**: full 23-step checklist
  (19 pass / 2 fail / 2 optional-blocked), retest 1 (8 pass / 2 fail), retest 2 (**6/6
  pass** — five consecutive moves, five consecutive resizes, alternating). The originally
  blocked steps are the optional terminal ones; both were run by Claude and passed.

## Files produced — most are NOT on disk

- **On disk and committed:** the source changes (`app/js/editor.js`, `app/js/selection.js`,
  `app/css/editor.css`, `app/tests/tests.js`) and the three rebuilt top-level `*.html`.
- **Session scratchpad only, will not survive** — `verify-fixes.mjs`, `verify-dnd.mjs`,
  `run-units.mjs`, `probe-d20.mjs`, `repro-d20.mjs`, the recovered runner HTML, and the two
  retest checklist JSONs. Recreate from the recipe above if needed.
- **The Test Checklist Runner is an artifact, not a repo file:**
  https://claude.ai/code/artifact/29f87e87-3154-4046-8b95-010ab0a27eca — `WebFetch` on that
  URL returns the full HTML source verbatim. **To update it, pass the `url` parameter** to
  the Artifact tool, or a new conversation mints a *different* artifact.

## Carried forward — still true

- **The runner only seeds itself when `localStorage` is empty.** A published change to the
  seed checklist will not reach a browser that already loaded an earlier revision. This
  session added `round.rev` + `refreshSeed()` to handle that: bump `rev` when editing the
  seed. Recorded results survive the refresh; steps that no longer exist are dropped.
- **`localStorage['claude-test-rounds']` and `format: 'claude-test-round'` must never be
  renamed** — renaming orphans the user's recorded progress and breaks exported files.
- **Claude cannot see the user's checklist progress.** Only `downloads` and `mcp`
  capabilities exist on this account; results arrive only when the user pastes them.
- **Alt and Ctrl are orthogonal** — Alt = "where may the sweep start", Ctrl = "replace or
  add". **The Alt check must stay above the Ctrl branch** in `editor.js` `pointerdown`.
- **Deselect is bound to `#edSvg`, never `document`** — that is what stops app chrome
  clearing a selection.
- **`app/js/model.js` is git-"binary"** (intentional NUL ~line 114) — grep `-a`, hand-merge.
- **The top-level `*.html` are generated** — never hand-edit; the pre-commit hook rebuilds
  them and CI carries a rebuild-diff guard.
- **The site has one floor** ("Green Mile"), the BAM editor has **no persistence** (reload
  resets it, which is what makes destructive testing safe), and
  `POC3-Building-Area-Manager.html` at the repo root is self-contained — double-click to
  run, no clone or server needed.
- **The user is on Windows PowerShell 5.1 with no local clone** — `&&` is a syntax error
  there and Python is `python`, not `python3`.
- **Do NOT gitignore `Claude Package/`** — fresh Code-on-web sessions clone the repo and
  see only committed files, so this handoff must stay tracked. (The `handoff` skill's
  generic advice says to gitignore it; this repo overrides that.)
- **Branch deletion over git is blocked** (proxy 403) — use the GitHub web UI. Merged
  branches show "1 ahead / N behind" from squash-merging; check `git cherry` / an empty
  `git diff` against `main` before calling one unsafe to delete.

## Suggested next steps

1. **PR #18 is open, CI green, no review comments.** It needs the user's review and merge.
   This session is subscribed to its activity and should keep driving it to merged.
2. **After merge:** `claude/startup-skill-fj1fn3` can be deleted (web UI), and the
   checklist artifact's download link should be repointed from the branch back to `main`
   — bump `round.rev` so the change actually reaches the user's browser.
3. **If the lock-up ever returns**, the diagnostic question is *when* the no-drop cursor
   appears: at the instant of the press (something is draggable) versus after a few pixels
   of movement (a selection is arming a native drag).
4. Deferred ideas, only if asked: **BAM editor autosave to localStorage**; **"Match size"
   bulk action** (the user declined all three multi-resize variants once already).

## Open questions

- None blocking. PR #18 is waiting on the user's merge.
