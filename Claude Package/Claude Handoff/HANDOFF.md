# HANDOFF — Code → Code · 2026-08-01 16:30 UTC

## What happened this session

Ran `startup`, found the previous baton's "user's next action" (open a PR for the marquee
work) **still not done**. Before doing it, the user asked for a way to run the manual test
list without losing their place. That became the session: an **artifact-based test checklist
runner**, built and refined over four published revisions.

**No code was written and nothing was committed. The repo is clean and untouched.** The
marquee feature is exactly where the last session left it — one commit on
`claude/startup-skill-p8cy4n`, unmerged, no PR. `main` is still `50e8bbd`.

## The deliverable is an artifact, not a file

**https://claude.ai/code/artifact/29f87e87-3154-4046-8b95-010ab0a27eca** — "Test Checklist
Runner". A self-contained HTML page, deliberately **not** committed to this repo (the user
wants it reusable across projects; this app's history is the wrong home).

Three things a future session needs to know to work on it:

- **The source is recoverable.** `WebFetch` on that URL returns the complete original HTML
  verbatim and writes it to a file on disk. Verified this session. Nothing depends on the
  scratchpad surviving.
- **To update it, pass the `url` parameter** to the Artifact tool. Without it, republishing
  from a new conversation mints a *new* artifact instead of updating this one.
- **`Artifact action:"list"`** finds it if the URL is lost. It is currently the user's only
  artifact.

## Files produced — almost all of them are gone

Everything lived in the session scratchpad and **was never on the user's disk**:
`test-round-runner.html` (the source), `verify.mjs` (a 144-check Playwright suite), several
screenshots and debug scripts. Only the published artifact survives.

**`verify.mjs` is the real loss.** If you change the runner, expect to rewrite the suite from
the recovered HTML. Recipe: `npm install playwright-core` into the scratchpad,
`executablePath: /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`,
serve the file over `python3 -m http.server`, drive it with Playwright.

## Decisions taken — don't re-litigate

- **One reusable runner at one URL**, project-agnostic, holding a library of checklists in
  `localStorage` — *not* a file per checklist and *not* a template in this repo. The user
  chose this explicitly after being offered per-checklist artifacts.
- **The results JSON carries the full checklist definition, not just answers.** This is what
  lets a future blank session read pasted results cold. Do not "optimise" it to answers only.
- **`localStorage['claude-test-rounds']` and `format: 'claude-test-round'` must never be
  renamed.** The interface says "checklist" everywhere, but these two strings (and the
  `round` key inside the payload) kept their old names on purpose — renaming them orphans the
  user's recorded progress and breaks previously exported files.
- **There is no way for Claude to see the user's progress.** The only runtime capabilities on
  this account are `downloads` and `mcp` — no shared state. Results reach Claude only when
  the user presses *Copy results for Claude* and pastes. This was stated to the user and
  accepted; don't promise live visibility.
- **"Hide completed" hides passed steps only** — failed and blocked steps stay on screen
  because they are still outstanding work.
- **The word "Step" and the numbering stay** (user's call), with order-independence stated as
  a ground rule and `needs …` chips on the five steps that have real prerequisites.
- **Optional steps must not hold the checklist open** — the verdict counts required steps
  separately so it can read "All 21 required steps passed".

## Gotchas discovered this session (all cost real debugging time)

- **A `<meta charset="utf-8">` must be the first line.** Without it, every non-ASCII character
  mangles when the file is served without a charset header or opened from disk.
- **Quirks mode breaks table colour inheritance.** Opened from disk the page has no doctype,
  and `<table>` then ignores the inherited `color` — every step title rendered dark-on-dark in
  dark mode. Fixed with an explicit `table { color: inherit }`; do not remove it as redundant.
- **`[hidden]` loses to any class that sets `display`.** `.btn { display: inline-flex }` made
  the hidden Delete button visible. The page now carries `[hidden] { display: none !important }`.
- **Playwright: a `page.once('dialog')` handler for a confirm that never fires stays armed**
  and silently eats the next one. Use a register-then-remove helper.
- **The store isn't written until the first change**, so injecting into `localStorage` right
  after load finds `null`. Saves are debounced 300 ms — wait longer than that before reading.

## Findings about the app itself (not previously known)

- **`POC3-Building-Area-Manager.html` at the repo root already contains the marquee feature.**
  It is self-contained (3.7 MB, data and floor plan inlined) and runs by double-click. The
  whole clone-and-serve route is unnecessary for manual testing.
- **The site has exactly one floor** (`app/data/floors.json` → "Green Mile"), so the
  multi-floor test step was impossible to perform and was deleted.
- **The editor has no persistence** — reloading resets it, which is what makes destructive
  testing safe.
- **The user is on Windows PowerShell 5.1 with no local clone.** `&&` is a syntax error there
  and Python is `python`, not `python3`. Any instructions written for them must respect this.

## Carried forward from the previous baton — still true, still unmerged

- **Alt and Ctrl are orthogonal.** Alt = "where may the sweep start", Ctrl = "replace or add".
  Alt alone forces a marquee; Ctrl+Alt is the additive composition.
- **The Alt check must stay above the Ctrl branch in `editor.js` pointerdown** — otherwise
  Ctrl+Alt on a box is swallowed by `toggleInSelection`. Don't "tidy" the ordering.
- **Deselect is bound to `#edSvg`, never `document`** — that is what stops app chrome (the
  Lock-regions toggle) clearing a selection.
- **`app/js/model.js` is git-"binary"** (intentional NUL ~line 114) — grep `-a`, hand-merge,
  never "fix".
- **The top-level `*.html` are generated** — never hand-edit; the pre-commit hook rebuilds
  them, and CI carries a rebuild-diff guard.
- **Branch deletion over git is blocked** (proxy 403) — use the GitHub web UI.
- **Do NOT gitignore `Claude Package/`** — fresh Code-on-web sessions clone the repo and see
  only committed files, so this handoff must stay tracked. (The `handoff` skill's generic
  advice says to gitignore it; this repo overrides that.)

## Verification status

- The runner: **144 automated checks green** in headless Chromium at the last publish —
  persistence across reload, export/import round-trip, checklist-library isolation, both
  themes, contrast in both themes, and a guard that pre-existing stored progress survives.
  That suite no longer exists on disk (see above).
- The marquee feature: unchanged this session. Still **97/97 unit tests, 19/19 smoke** from
  the previous session, and still **not confirmed by the user in a real browser** — which is
  the entire point of the checklist.

## Suggested next steps

1. **User's next action:** open the checklist artifact, follow "Start here — how to run
   this", download `POC3-Building-Area-Manager.html` from the branch, and work through the
   21 required steps. Steps 11 and 14 are the critical ones.
2. **Then:** the user presses *Copy results for Claude* and pastes the JSON back. Read it,
   and act on any failure — the JSON carries the full checklist so no prior context is needed.
3. **If the checklist comes back clean:** open a PR from `claude/startup-skill-p8cy4n` to
   `main` and let the user merge it. CI carries the real rebuild-diff guard.
4. Deferred ideas, only if asked: **BAM editor autosave to localStorage**; **"Match size"
   bulk action** (the user declined all three multi-resize variants once already).

## Open questions

- None blocking. The checklist is waiting on the user's hands, not on a decision.
