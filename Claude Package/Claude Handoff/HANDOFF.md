# HANDOFF — Code → Code · 2026-08-02 03:01 UTC

## What happened this session

Picked up the previous baton and found both its action items already done (PR #18 merged by
the user at 21:02 UTC; the checklist artifact already repointed to `main` at `rev: 3`). So
**no app code changed this session** — it was a brainstorm, and the output is two idea
documents plus this handoff, merged to `main`.

The valuable part is domain knowledge the user gave in chat that exists nowhere on disk, and
a list of ideas that are now **explicitly dead**.

## The domain facts that reframe the whole tool

This is the highest-value thing in this handoff. It is not derivable from the code, and it
changes what the app should optimise for:

- The tool counts **dwelling pallets** — aged/stuck stock — **not** total pallets.
- Associates determine dwell status and duration with **tools external to this app**, so the
  age is already in hand at count time. The form then discards it.
- Only pallets **3 days or older** are recorded at all.
- **25+ days** gets an extra callout on the org's comms channels — done **manually** today.
- **30+ days** populates/flags against the **IOL metric**.

Consequence: the heat map currently optimises for volume, but the real objective is *stop
anything reaching 30 days*. Three pallets at 29 days paint near-grey while forty pallets at
four days paint red. Full write-up in `Claude Package/Claude Ideas/AGE-BANDS-AND-IOL.md`.

## Ideas the user has killed — do NOT re-propose

- **BAM editor autosave to localStorage.** Fully scoped this session at the user's request,
  then **"scratch all of this."** It was listed as a deferred idea in the *previous* handoff;
  it is now dead. (For the record, had it been built: geometry only — one floor-plan PNG is
  6.7 MB in UTF-16, over the ~5 MB localStorage budget on its own.)
- **Rapid count mode** (click box → type → auto-advance). User: "already concluded as not
  going to do."
- **Merge vs. replace on import.** I proposed this as new; **it already exists** at
  `app/js/app.js:175-189` with a three-way modal. Read before proposing.
- **"Match size" bulk action** — still declined (carried from the previous baton; all three
  multi-resize variants were rejected once already).
- **Capacity / utilisation colouring for *this* tool.** Saved, but scoped to the planned
  sibling total-pallet tool — see below. Band colouring beats it here.

## Files produced — all on disk and committed

- `Claude Package/Claude Ideas/AGE-BANDS-AND-IOL.md` — five ideas saved **verbatim** at the
  user's request, for review in a new session. Idea 1 (three age bands instead of one count)
  is the enabler; 2 and 3 build on it; 4 is the payoff.
- `Claude Package/Claude Ideas/CAPACITY-AND-UTILIZATION.md` — the capacity idea, deferred.
  Key point: `count / capacity` in the dwelling tool is *dwelling density*, **not**
  utilisation — a buffer can be 100% full with zero dwelling pallets. Utilisation belongs to
  a future **sibling tool that counts total pallets**, which the user intends to build.
- Nothing else. No source files were touched; no rebuild was needed.

## Open question — blocks scoping, ask before estimating

**Is the 25+ day callout per-area or per-pallet?** If the message must name specific pallets
(LPN / licence plate), counts are insufficient and the app needs pallet-level records — far
bigger than three numbers per area. If it is "Docksort J17 has four pallets aging in," counts
suffice and idea 3 is small. Everything downstream of idea 3 hinges on this.

## Suggested next steps

1. **Open `Claude Package/Claude Ideas/AGE-BANDS-AND-IOL.md` and review the five ideas with
   the user** — that is what they were saved for, and it is what this session ended on.
2. **Get the per-area vs per-pallet answer** (above) before scoping ideas 3 or 4.
3. If the user wants to build: **idea 1 is the enabling change** — three band counts replacing
   the single field at `app/js/form.js:43`. It is a payload-shape change: bump
   `COUNTS_KEY_VERSION` and migrate in `storage.js` `loadCounts`, and bump `SCHEMA_VERSION`
   with a `MIGRATIONS` entry (`app/js/schema.js:18`). Both mechanisms exist and are unused.
4. `claude/startup-skill-mpy9q5` can be deleted after PR #19 merges (web UI — see below).

## Carried forward — still true

- **Automated tests cannot catch native drag-and-drop bugs.** Synthetic mouse events never
  trigger native DnD; three green Playwright rounds ran while a total drag lock-up was live.
  Test the *mechanism* (stage unselectable? `dragstart` refused? selection left behind?), not
  the gesture. If the lock-up returns, the diagnostic is *when* the no-drop cursor appears:
  at the press (something is draggable) vs. after a few pixels (a selection is arming a
  native drag).
- **`tests/run_ci.py` cannot run in a Code-on-web container** (pip playwright wants browser
  build 1234, only 1194 present, `playwright install` disallowed). Workaround: drive
  `app/tests/tests.html` with node `playwright-core` at
  `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell` and read
  `window.__TEST_RESULT__`. CI itself is unaffected.
- **The Test Checklist Runner is an artifact, not a repo file:**
  https://claude.ai/code/artifact/29f87e87-3154-4046-8b95-010ab0a27eca — `WebFetch` returns
  its full source. **To update it, pass the `url` parameter** to the Artifact tool or a new
  conversation mints a different artifact. It only seeds itself when `localStorage` is empty,
  so **bump `round.rev`** when editing the seed. Currently `rev: 3`, pointed at `main`.
- **`localStorage['claude-test-rounds']` and `format: 'claude-test-round'` must never be
  renamed** — renaming orphans the user's recorded progress.
- **Claude cannot see the user's checklist progress** — results arrive only when they paste.
- **Alt and Ctrl are orthogonal** — Alt = where the sweep may start, Ctrl = replace or add.
  The Alt check **must stay above** the Ctrl branch in `editor.js` `pointerdown`.
- **Deselect is bound to `#edSvg`, never `document`** — that is what stops app chrome
  clearing a selection.
- **`app/js/model.js` is git-"binary"** (intentional NUL ~line 114) — grep `-a`, hand-merge.
- **The top-level `*.html` are generated** — never hand-edit; the pre-commit hook rebuilds
  them and CI carries a rebuild-diff guard.
- **The site has one floor** ("Green Mile"); the **BAM editor has no persistence** (reload
  resets it, which is what makes destructive testing safe — and is why autosave was a real
  trade-off, not a free win); `POC3-Building-Area-Manager.html` at the repo root is
  self-contained, double-click to run.
- **The user is on Windows PowerShell 5.1 with no local clone** — `&&` is a syntax error
  there and Python is `python`, not `python3`.
- **Do NOT gitignore `Claude Package/`** — fresh Code-on-web sessions clone the repo and see
  only committed files, so this handoff and the idea docs must stay tracked. (The `handoff`
  skill's generic advice says to gitignore it; **this repo overrides that**.)
- **Branch deletion over git is blocked** (proxy 403) — use the GitHub web UI. Merged branches
  show "1 ahead / N behind" from squash-merging; check `git cherry` or an empty `git diff`
  against `main` before calling one unsafe to delete.
