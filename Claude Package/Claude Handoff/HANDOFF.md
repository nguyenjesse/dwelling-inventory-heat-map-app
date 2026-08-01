# HANDOFF — Code → Code · 2026-08-01 06:15 UTC

## What happened this session
Ran `startup`, confirmed the previous baton's "user's next action" was already done
(PR #15 merged at `50e8bbd`), then scoped and shipped the shelved idea **#9 map
marquee / rubber-band select**. Reviewed, unit-tested, smoke-tested and visually
confirmed. **Work is NOT on `main`** — one commit on `claude/startup-skill-vgyms4`,
pushed, no PR opened; the user opens and merges it manually.

## Changes on disk (branch `claude/startup-skill-vgyms4`, 1 commit ahead of `main` @ `50e8bbd`)
- **`6c5636c` — feat(editor): marquee (rubber-band) select on the map**
  - `app/js/selection.js`: pure `normalizeRect(x0,y0,x1,y1)` and
    `rectHits(entries, r)` alongside the existing `rangeSelect`/`clampGroupDelta`.
  - `app/js/editor.js`: `startMarquee`/`updateMarquee`/`endMarquee` in their own
    section below the pointerdown handler; a new Alt-first branch and a bare-canvas
    branch in pointerdown; one-line hooks at the top of pointermove and `end()`;
    an Alt-held `marquee-ready` cursor class on new document keydown/keyup listeners.
  - `app/css/editor.css`: `.ed-marquee`, `.ed-area.preview`, `svg.marquee-ready`.
  - `app/editor.html`: `#editorHint` now documents the map gestures (the feature is
    undiscoverable otherwise, Alt-drag especially).
  - `app/tests/tests.js`: +8 tests.
  - Standalones rebuilt by the **pre-commit hook** (installed and firing in this clone).

## Files produced / to reference
- Everything durable is in the commit above.
- The scratch Playwright runners (`run_tests.mjs`, `smoke.mjs`, `shot.mjs`) and the
  two screenshots (`marquee-during.png`, `marquee-after.png`) lived **only in the
  session scratchpad and are gone** — they were never on the user's disk. Rebuild the
  runners from the recipe under *Dead ends & gotchas* if you need them.

## Decisions taken and why (don't re-litigate)
- **Alt and Ctrl are orthogonal axes.** Alt answers *"where may the sweep start?"*,
  Ctrl answers *"replace or add?"*. The user corrected an earlier reading that looked
  like forced-marquee required Ctrl+Alt — it does not. **Alt alone** forces a marquee
  over a box; Ctrl+Alt is just the two composed (an additive forced sweep) and the
  user explicitly chose to keep that composition.
- **The Alt check must sit above the Ctrl branch in pointerdown.** Plain Alt-drag
  would fall through on its own (that branch tests `ctrlKey || metaKey`), but
  **Ctrl+Alt on a box would be swallowed by `toggleInSelection` and never marquee**.
  That is the only reason for the ordering — don't "tidy" it back.
- **Deselect is bound to the `#edSvg` element, never `document`.** This is what
  satisfies the user's constraint that clicking app chrome (the Lock-regions toggle)
  must not clear a selection: the svg covers only the floor plan, and the header,
  sidebar and x/y/w/h controls are all outside it. Moving this to a document-level
  "click outside" listener is exactly what would break it.
- **Hit rule is intersection, not containment** — brushing a box catches it, and a
  marquee smaller than a box still selects it.
- **Live preview uses its own `.preview` class, not `.multi`.** `.multi` only paints
  above one selection and its cascade with `.active` is delicate; a transient
  highlight has no business borrowing it.
- **Clearing needed no case of its own** — a plain click is a zero-area marquee that
  hits nothing, and an additive sweep that hits nothing unions with nothing. No drag
  threshold code was needed either, for the same reason.
- **`activeId` comes from `floorAreas()` order, not `visibleOrder`** — the latter is
  filtered by the sidebar search and would break whenever a search is active.
- **The marquee selects areas hidden by the sidebar search**, because the map paints
  them regardless. What you see on the map is what you get.
- **The sweep rectangle is neutral slate, not violet.** It was violet first; a
  screenshot showed its own boundary getting lost among the violet previews it was
  creating. Don't "harmonise" it back into the selection palette.

## Verification status
- **Unit tests: 97/97 green** (was 89; +8 for `normalizeRect` / `rectHits`).
- **Functional smoke 19/19** in real headless Chromium, no page errors — including
  Ctrl+Alt sweeping additively *without moving the box it started on*, marquee while
  locked, **toggling Lock regions with 25 areas selected leaving the selection
  intact**, all four drag directions agreeing, and one undo after a marquee reverting
  the prior geometry move rather than a phantom selection step.
- Confirmed visually from screenshots (mid-sweep and committed states both correct).
- Rebuild-diff clean: re-running `build/build-standalone.py` after the commit produced
  no diff.
- **Not yet confirmed by the user in a real browser** — last session's pattern was the
  user trying it in-app before merging.

## Dead ends & gotchas (carried forward — still true)
- **The `.multi` CSS class is on EVERY selected box, including the active one**
  (`ed-area active multi`). A smoke assertion of "N-1 multi + 1 active" is wrong.
- **Local headless testing:** `tests/run_ci.py` uses *Python* Playwright (absent
  in-container). Use Node `playwright-core` installed into the **scratchpad**
  (ephemeral — `npm install playwright-core` again next session), with
  `executablePath: /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`
  (full chromium won't run headless here). Serve `app/` over HTTP
  (`python3 -m http.server 8765`) and read `window.__TEST_RESULT__` — no scraping.
  Drive the editor by reading `.ed-area` client rects out of the DOM and computing
  drag coordinates from them; hard-coded pixel targets are brittle.
- **`app/js/model.js` is git-"binary"** (intentional NUL ~line 114) — grep `-a`,
  never "fix" it, hand-merge. NOT touched this session.
- **The top-level `*.html` are GENERATED** — never hand-edit; the pre-commit hook
  rebuilds them. CI's rebuild-diff guard normalizes only the floating `builtAt` line.
- **Branch deletion over git is blocked** (proxy 403) — use the GitHub web UI.
- **Do NOT gitignore `Claude Package/`** — fresh Code-on-web sessions clone the repo
  and see only committed files, so this handoff must stay tracked. (The `handoff`
  skill's generic advice says to gitignore it; this repo overrides that.)
- **Repo layout differs from the skill's `main/` convention:** app is under `app/`,
  handoff at `Claude Package/Claude Handoff/HANDOFF.md`.
- **New:** the `else { return; }` closing the handle/area chain in `editor.js`
  pointerdown is now unreachable (the bare-canvas branch returns earlier). Left in
  deliberately as a guard on `setPointerCapture` — it is not a bug.

## Suggested next steps
- **User's next action:** open a PR from `claude/startup-skill-vgyms4` and merge to
  `main` (CI carries the real rebuild-diff guard). Nothing else queued.
- If follow-up work starts AFTER that merge, branch fresh from `main`.
- Deferred ideas still on the shelf, only if asked: **BAM editor autosave to
  localStorage** (the *editor* WIP has no persistence — operator counts already
  autosave via `storage.js`); **"Match size" bulk action** (the one multi-resize
  variant worth building; the user declined all three variants once already).

## Open questions
- None blocking.
