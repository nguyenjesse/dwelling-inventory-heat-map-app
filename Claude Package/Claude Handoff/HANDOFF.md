# HANDOFF — Code → Code · 2026-08-18 19:58 UTC

## What happened this session

The user asked for a hard-coded credit line — "**Created by ngjesseo**" — at the bottom of
**both** the editor (BAM) and the operator map it generates. Done, verified with real browser
input, and **merged as `87aceaa` (PR #23)**. `main` is current; this branch was restarted from it
and holds only this handoff.

Adding the footer surfaced a **second, pre-existing bug** that got fixed in the same commit (see
below). The user reported no other bugs this session.

## Where the credit lives — and why it survives every build path

It is **static markup**, not JS, in `app/index.html` and `app/editor.html`:

```html
<footer class="app-footer"><span id="buildStamp" hidden></span><span class="credit">Created by ngjesseo</span></footer>
```

`build-standalone.py` lifts the inner `<body>` of those two files, so one edit propagates to all
four outputs: the three root `*.html` **and** the `OPERATOR_TEMPLATE` embedded in the editor —
so operator files a receiving site generates in-browser carry the credit too. **If a future change
needs to appear everywhere, put it in the source `app/*.html` body, never in the built files.**

The operator footer already existed but was `hidden` until `app.js` wrote a build stamp into it.
The stamp moved into its own `#buildStamp` span so the footer always shows; `app.js:49-55` now
targets `#buildStamp`, not `#appFooter` (that id is **gone** — don't grep for it). The `·`
separator is CSS-only and appears only when the stamp does:
`.build-stamp:not([hidden]) + .credit::before`.

## The second bug (fixed here, worth knowing)

`.editor-main` is a **grid item**, so its default `min-height: auto` let `.editor-canvas` grow to
the full height of the floor-plan image and **spill outside the layout box** — it painted *over*
the new footer, and the whole editor page scrolled instead of the canvas. `min-height: 0` on
`.editor-main` (`app/css/editor.css:70-73`) contains it. This was latent before: with no footer,
nothing was underneath to be covered.

**How it was caught, and the technique to reuse:** the element was `is_visible() == True` and had
a sane bounding box — Playwright reported it as fine. `document.elementFromPoint(centre)` returned
`svg`, not the span. **Visibility is not the same as reachability; check `elementFromPoint` when
verifying any overlay/stacking work.**

## Verification status — trust this section

- Credit visible **and topmost** (`elementFromPoint` → `credit|SPAN`) on all three root files at
  1440×900 over `file://`.
- **End-to-end**: drove the real editor, clicked **Build operator file**, saved the download,
  opened it — credit present, stamp present, **76 areas** rendered, zero console errors. This is
  the check that proves `OPERATOR_TEMPLATE` carries it.
- Served dev app (`python3 -m http.server` in `app/`): credit shows, stamp hidden, **no stray
  leading `·`**.
- Editor page no longer scrolls (`scrollHeight == innerHeight == 900`); canvas scrolls internally.
- **102/102** green (`tests/run_ci.py`). Zero console errors anywhere.
- **Not verified by machine:** narrow/mobile widths (the footer is `flex` + `justify-content:
  flex-end`, should just wrap up against the right edge), and the user has not eyeballed it yet.

## Files touched — all in `87aceaa`

- `app/index.html`, `app/editor.html` — the footer markup.
- `app/css/styles.css` — `.app-footer` flex + `.credit` + the conditional separator.
- `app/css/editor.css` — the `min-height: 0` containment fix.
- `app/js/app.js` — `#appFooter` → `#buildStamp`.
- The three root `*.html` — regenerated, never hand-edit.
- Playwright check scripts lived in the session scratchpad and are **gone**; ~30 lines each, and
  the `elementFromPoint` technique above is the part worth keeping.

## Branch state

`claude/heat-map-startup-skill-yuwpe7` was reset to `origin/main` after the merge and carries only
this handoff. Nothing is stacked on merged history.

## Suggested next steps

1. **Ask which bug or feature is next.** The user's "minor bugs" list has produced exactly two
   named items across two sessions (zoom/selection, then this credit request, which was a
   feature). Nothing is known-broken right now.
2. If the next report is interaction-shaped (clicks, drags, hover, zoom) → `page.mouse` Playwright
   repro on the built `POC3-Dwelling-Inventory-Map.html`. If it is layout/overlap-shaped →
   `elementFromPoint` + a `getBoundingClientRect` probe, as above.
3. Still-unclaimed 3-line fix (third session running): extend `.githooks/pre-commit` to also fire
   on `Claude Package/POC3-bam-project.json` and run `build/import-bam-project.py` first, so a
   JSON-only commit self-heals instead of failing CI.

## Open questions

- **Which bugs remain?** (blocks step 1)
- Is `Claude Package/POC3-bam-project.json` the *only* place POC3's layout should be edited? If
  yes, `app/data/*.json` could carry a "generated — edit in BAM" note. Still undecided.
- From the domain doc: is the 25+ day IOL callout per-area or per-pallet? It gates scoping.

## Carried forward — still true

- **BAM → app is two commands, in order**, and a new `POC3-bam-project.json` committed *alone*
  **fails CI** (a step re-imports and diffs). The pre-commit hook doesn't cover it, and the user
  has no local clone so hooks never run for them:
  ```bash
  python3 build/import-bam-project.py     # project JSON -> app/data/ (+ backgrounds)
  python3 build/build-standalone.py       # app/data/ -> the three root *.html
  ```
- **`tests/run_ci.py` runs fine in a Code-on-web container.** `pip install playwright` (~40s), then
  run from the repo root with this shim (**scratch only, not repo code**), and
  `rm -rf tests/__pycache__` afterwards. The same `executable_path` makes ad-hoc
  `sync_playwright()` scripts work for `file://` checks:
  ```python
  import sys
  from playwright.sync_api import BrowserType
  _orig = BrowserType.launch
  def launch(self, **kw):
      kw.setdefault("executable_path", "/opt/pw-browsers/chromium")
      return _orig(self, **kw)
  BrowserType.launch = launch
  sys.path.insert(0, "tests"); import run_ci; sys.exit(run_ci.main())
  ```
- **The zoom toolbar overlays the operator viewport's top-left corner.** A Playwright test that
  picks an area by `bounding_box()` centre will silently click a `<button>` and report a false
  failure. Confirm with `document.elementFromPoint(x, y).classList.contains('area')` first.
- **`page.mouse.click()` is move → down → up with no travel**, so it stays under the pan handler's
  3px capture threshold — click-selection is testable this way without special-casing.
- **The unit suite structurally cannot catch interaction bugs** — `map.js` isn't imported by
  `tests.js`, and synthetic events don't reproduce pointer-capture retargeting or native DnD. Don't
  add a vacuous unit test to "cover" one; a `page.mouse` script is the real net.
- **Automated tests cannot catch native drag-and-drop bugs.** Three green rounds ran while a total
  drag lock-up was live. If it returns, the diagnostic is *when* the no-drop cursor appears: at the
  press vs. after a few pixels.
- **Domain reframe (highest-value fact on file):** this tool counts **dwelling** pallets — aged
  stock, 3+ days, escalating at 25 and 30 days (IOL) — so the objective is *stop anything
  reaching 30 days*, not volume. `Claude Package/Claude Ideas/AGE-BANDS-AND-IOL.md`.
- **Area IDs are the editor's duplicate-artifacts** (`copy-of-…` names something else entirely).
  **Do not clean them up:** counts live in `localStorage` keyed by area id, so renaming orphans
  every associate's count. Needs a `COUNTS_KEY_VERSION` bump + `storage.js` `loadCounts`
  migration if ever worth it.
- **Doc counts are hand-maintained** and drift on every import: `README.md` (2), `app/README.md`
  (4), three hard-coded numbers in `app/tests/tests.js`. Keep them literal, not derived.
- **Dead ideas — do not re-propose:** BAM autosave to localStorage · rapid count mode ·
  merge-vs-replace on import (exists, `app/js/app.js:175-189`) · "match size" bulk action ·
  capacity/utilisation colouring in *this* tool (belongs to the sibling tool —
  `Claude Package/Claude Ideas/CAPACITY-AND-UTILIZATION.md`).
- **The top-level `*.html` are generated** — never hand-edit; pre-commit rebuilds, CI diffs.
- **Alt and Ctrl are orthogonal** in `editor.js` `pointerdown` — the Alt check **must stay above**
  the Ctrl branch. **Deselect is bound to `#edSvg`, never `document`.**
- **`app/js/model.js` is git-"binary"** (intentional NUL ~line 114) — grep `-a`, hand-merge.
- **`localStorage['claude-test-rounds']` and `format: 'claude-test-round'` must never be
  renamed.** Test Checklist Runner artifact:
  https://claude.ai/code/artifact/29f87e87-3154-4046-8b95-010ab0a27eca — update it via the
  Artifact tool's `url` param, and bump `round.rev` when editing the seed (it only seeds when
  `localStorage` is empty). Claude can't see the user's progress unless they paste it.
- **One floor** ("Green Mile"); **BAM has no persistence** (reload resets it — that's what makes
  destructive testing safe).
- **The user is on Windows PowerShell 5.1 with no local clone** — `&&` is a syntax error there
  and Python is `python`, not `python3`.
- **Do NOT gitignore `Claude Package/`** — fresh Code-on-web sessions see only committed files,
  so this handoff and the idea docs must stay tracked. (The `handoff` skill says to gitignore it;
  **this repo overrides that**.)
- **Branch deletion over git is blocked** (proxy 403) — use the GitHub web UI. Squash-merged
  branches show "1 ahead / N behind"; check `git cherry` or an empty `git diff` vs `main` before
  calling one unsafe to delete.
