# HANDOFF — Code → Code · 2026-07-30 11:35 PT

## What happened this session
Added a **region lock toggle** to the editor (prevents accidental drags), reworded
the sidebar hint to explain it, then **merged everything to `main`** and cleaned up.
The long-running multi-branch situation is now **resolved**: all the editor /
area-manager work + the 74-area dataset + the lock toggle live on `main`.

## ⚠️ Branch state — this supersedes every earlier handoff
Earlier batons told you the live branch was `claude/editor-area-manager-wip` (PR #3),
based off `claude/editor-area-manager`. **That is no longer true. Ignore it.**
- **`main` is the only branch now** (remote tip `d76b527`, "Merge pull request #4…").
  All feature branches — `claude/map-editor-work-2t9k73`, `claude/editor-area-manager`,
  `claude/editor-area-manager-wip` — have been **deleted from the remote**.
- **PR #4** merged the work to `main`; **PR #3** was closed as superseded. Nothing is unmerged.
- **Start new work from a fresh branch off `main`.** (This session's local checkout still
  has stale deleted branches — a fresh clone won't; don't reuse them.)

## Changes on disk (all on `main`)
- `app/js/editor.js`, `app/editor.html`, `app/css/editor.css` — the lock toggle (see below).
- `app/data/{areas,departments,regions,ibeam-mappings}.json` — **74 areas, 6 depts, 74 regions, 61 I-beam mappings** (unchanged this session; carried in via the merge).
- Both root standalones (`POC3-*.html`) — rebuilt via `python3 build/build-standalone.py`.

## The region lock feature (chat-only detail)
- Header checkbox **`#lockRegions`**, **boots locked** (on by default). State is a plain
  in-memory `let locked` in `editor.js` — **no persistence**, resets to locked on reload
  (deliberate, matches the editor's no-storage design).
- Locked = **no mouse drag, no corner-resize, no arrow-key nudge**. Clicking still *selects*
  (fields populate). The **x/y/w/h number fields remain the deliberate reposition path** —
  that's the intended escape hatch, don't "fix" it. Resize handles are hidden while locked.
- Implemented by guarding `pointerdown`, `drawHandles`, and the `keydown` nudge handler on `locked`.

## Verification status
- Confirmed in a **real browser from `file://`** (per the standing don't-trust-node-counts gotcha):
  74 boxes, 0 console errors, and every lock behavior asserted (boots locked; drag & arrow-nudge
  do nothing while locked; click still selects; x/y/w/h still reposition; unlock restores drag +
  handles; re-lock hides them). User signed off ("it looks good").
- **How to re-run the browser check** (the harness for this is chat-only, not in the repo):
  `npm install playwright-core` (browsers are pre-installed at `/opt/pw-browsers`; do NOT run
  `playwright install`), launch with `executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`,
  and because playwright-core is CommonJS, import it in an `.mjs` via
  `import pw from 'file:///…/node_modules/playwright-core/index.js'; const {chromium}=pw;`.
  Delete `node_modules`/`package.json`/`package-lock.json` after — they must NOT be committed
  (this is a dependency-free static project).

## Dead ends & gotchas
- **Branch deletion 403s from here.** `git push origin --delete <branch>` fails with HTTP 403
  through the agent git proxy (policy block, not transient; retries won't help). The GitHub MCP
  has no delete-branch tool either. Branch cleanup must be done by the user in the GitHub UI
  (the user did exactly that this session). Don't burn time fighting it.
- **`list_pull_requests` `merged` field is unreliable** — it showed `merged:false` for the
  merged PR #4. `pull_request_read method:get` is authoritative (`merged:true`, `merged_at` set).
- Standing gotcha still applies: verify the standalone with a **real screenshot**, not a DOM node count.

## Suggested next steps
1. **If the user hands over another editor export:** run the steady-state loop — split the bundle
   into `app/data/{areas,departments,regions,ibeamMappings→ibeam-mappings}.json`, validate with
   `validateManifest` (0/0), `python3 build/build-standalone.py`, screenshot-verify from `file://`,
   commit data + standalones together on a fresh branch off `main`.
2. **Green Mile region alignment** is close-but-not-pixel-perfect — nudge boxes if the user flags them.
3. Consider suggesting `Claude Package/` be added to `.gitignore` (it's session plumbing, currently
   tracked on `main` — gitignoring won't untrack it, would need `git rm --cached` too).

## Open questions
- **Save = set vs. increment?** (Still unconfirmed, carried across several batons.) Operator
  "Save count" currently *sets* an area's absolute pallet count rather than incrementing.
  `app/js/form.js` changes if the user wants running totals.
