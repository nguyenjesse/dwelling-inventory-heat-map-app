# HANDOFF — Code → Code · 2026-08-18 17:49 UTC

## What happened this session

The user dropped in a fresh BAM **Save project** export (76 areas), and we closed the loop it
had been missing: `Claude Package/POC3-bam-project.json` is now the **source** POC3's seed data
is imported from, instead of an inert record. New script `build/import-bam-project.py` (the
exact reverse of "Save project") rewrites `app/data/*.json` + `app/assets/` from the bundle; a
CI step re-imports and fails on any diff so the two can't drift.

Merged to `main` by the user as **b33bb46 "updated editor base seed"** (squash — the branch
commit `366a0a0` is *not* an ancestor). Two commits landed on `main` this session: `ed05127`
(the raw JSON drop) and `b33bb46` (the importer + regenerated standalones + docs).

Next session is for **minor bug fixes** — the user hasn't named them yet.

## The workflow that now exists (this is the point of the session)

Editing POC3's layout in BAM → getting it into the app is **two commands**, in this order:

```bash
python3 build/import-bam-project.py     # project JSON -> app/data/ (+ backgrounds)
python3 build/build-standalone.py       # app/data/  -> the three root *.html
```

**Consequence the user's habit collides with:** committing a new `POC3-bam-project.json`
*alone* now **fails CI** (the new "app/data matches the saved BAM project" step re-imports and
diffs). `ed05127` — a JSON-only commit — would fail under today's `main`. Any session that
accepts a new export must run both commands in the same commit. The pre-commit hook does not
cover this: it fires on `app/` and `build/` changes only, and the user has **no local clone**,
so hooks never run on their machine anyway.

## Verification status — trust this section

- **102/102 tests green** (`app/tests/tests.html`). The README's "55/55" was years stale; fixed.
- Both POC3 standalones **opened from `file://` in real Chromium**: fully styled, 76 region
  shapes, background at 1484×1060, the new/renamed areas present, **zero console errors**.
- **Round-trip proven**: clicking "Save project" in the rebuilt editor produces a bundle
  **field-for-field identical** to `Claude Package/POC3-bam-project.json`, mapping order
  included. Import → build → export is a fixed point.
- Importer guards were **exercised, not just written**: a bundle with a bad `departmentId` and
  a missing region exits 1 and writes nothing; a `version: 9` bundle is refused.
- Re-running the importer on unchanged input is a **git no-op** (verified).
- **Not verified by machine:** nothing. No user-eyes item is pending.

## `tests/run_ci.py` DOES run in a Code-on-web container — the previous baton was wrong

The last handoff said it can't. It can, and the node/`playwright-core` workaround it describes
is unnecessary. `pip install playwright` succeeds through the proxy; the only mismatch is that
pip's playwright wants Chromium build 1234 while the image ships 1194 at
`/opt/pw-browsers/chromium`. Six-line shim, run from the repo root — **keep it in scratch, it
is not repo code**:

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

`rm -rf tests/__pycache__` afterwards — importing `run_ci` leaves it behind and it is untracked
noise. The same `executable_path` makes ad-hoc `sync_playwright()` scripts work for `file://`
render checks and for driving the editor (that is how the round-trip above was proven —
`accept_downloads=True`, then `expect_download()` around a click on `#saveProject`).

## What the import actually changed in the layout

`app/data` was **two exports behind**, not one: it sat at 74 areas while the new bundle had 76.
The 75-area export committed last session (`effc7d7`) was never imported, so "Presort Buffer"
arrived in the app without ever having been in `app/data`.

- **New:** `copy-of-inbound-overflow` = "Presort Buffer" (J10), `copy-of-docksort-downstack-phase-2`
  = "RPN Lane Buffer" (K21), with regions.
- **Renamed:** IB Dock L21/L22 → Inbound Overflow 1/2 · RPN F21 → RPN Overflow · Inbound
  Overflow → Pallet Receive Buffer (pole K10 → J9).
- **Resized:** both presort boxes, `copy-of-presort-phase-1`, `docksort-downstack-phase-2`.
- 63 I-beam mappings. Background image **byte-identical** — no asset churn.

## Gotchas discovered this session

- **Area IDs are the editor's duplicate-artifacts** — `copy-of-docksort-downstack-phase-2` is
  named "RPN Lane Buffer". Cosmetically confusing when reading data by eye, and it will keep
  happening (BAM derives the id from the area that was duplicated). **Do not "clean up" these
  ids:** pallet counts live in `localStorage` keyed by area id, so renaming one silently
  orphans every associate's count for that area. If it is ever worth doing, it needs a
  `COUNTS_KEY_VERSION` bump + a migration in `storage.js` `loadCounts`.
- **Doc counts are hand-maintained** and drift on every import: `README.md` (2 places),
  `app/README.md` (4), and three hard-coded numbers in `app/tests/tests.js` (`76 areas`,
  `63 unique I-beams`, `Object.keys(c).length`). All updated; expect to touch them again next
  import. The tests are canaries — keep them literal rather than deriving from `seed`.
- **The importer normalizes I-beam mapping order** with a natural sort (`J9` before `J10`)
  matching `deriveIbeamMappings` in `editor.js:56`. The committed file had been plain
  lexicographic; that is why the mappings diff looks larger than the change.
- `floors.json` / `departments.json` / `categories.json` came out **byte-identical** to what
  was already committed — the importer's formatting conventions match the repo's by design,
  so an unrelated diff there means a real content change, not reformatting.

## Files touched / produced — all on disk, all on `main`

- `build/import-bam-project.py` — **new**, ~220 lines, documented at the top.
- `.github/workflows/ci.yml` — new "app/data matches the saved BAM project" step, before the
  standalone-staleness step.
- `app/data/{areas,ibeam-mappings,regions}.json`, the two root POC3 `*.html`, `README.md`,
  `app/README.md`, `app/tests/tests.js`.
- Scratch Playwright drivers (render check, round-trip) lived in the session scratchpad and are
  **gone** — the shim above is the only part worth keeping.

## Suggested next steps

1. **Ask the user which bugs.** They said "minor bugs" without naming them; nothing in this
   session's work is known-broken, so the list is entirely theirs.
2. Before any commit: run the two commands above if `Claude Package/POC3-bam-project.json`
   changed, and remember the pre-commit hook regenerates the three root `*.html` for you.
3. **Optional 3-line fix worth proposing:** extend `.githooks/pre-commit` to also fire on
   `Claude Package/POC3-bam-project.json` and run `import-bam-project.py` first, so a
   JSON-only commit from a session with a clone self-heals instead of failing CI.
4. `claude/updated-json-editor-udjacw` was squash-merged; it has been reset to `origin/main` for
   this handoff. Force-push is safe on it — it carries no unmerged work.

## Open questions

- **Which bugs?** (blocks next session's first move — see step 1)
- Is `Claude Package/POC3-bam-project.json` now the *only* place POC3's layout should be
  edited? Today it is the source of truth for `app/data/`, but nothing stops someone hand-
  editing `app/data/` — CI will just fail them. If the answer is yes, `app/data/*.json` could
  carry a "generated — edit in BAM" note.

## Carried forward — still true

- **Automated tests cannot catch native drag-and-drop bugs.** Synthetic mouse events never
  trigger native DnD; three green Playwright rounds ran while a total drag lock-up was live.
  Test the *mechanism*, not the gesture. If the lock-up returns, the diagnostic is *when* the
  no-drop cursor appears: at the press vs. after a few pixels.
- **Domain reframe (highest-value fact on file):** this tool counts **dwelling** pallets — aged
  stock, 3+ days, escalating at 25 and 30 days (IOL) — so the real objective is *stop anything
  reaching 30 days*, not volume. Full write-up:
  `Claude Package/Claude Ideas/AGE-BANDS-AND-IOL.md`. Still-open question there: is the 25+ day
  callout per-area or per-pallet? It gates scoping.
- **Dead ideas — do not re-propose:** BAM autosave to localStorage · rapid count mode ·
  merge-vs-replace on import (already exists, `app/js/app.js:175-189`) · "match size" bulk
  action · capacity/utilisation colouring in *this* tool (belongs to the planned sibling
  total-pallet tool — `Claude Package/Claude Ideas/CAPACITY-AND-UTILIZATION.md`).
- **The top-level `*.html` are generated** — never hand-edit; pre-commit rebuilds, CI diffs.
- **Alt and Ctrl are orthogonal** in `editor.js` `pointerdown` — the Alt check **must stay
  above** the Ctrl branch. **Deselect is bound to `#edSvg`, never `document`.**
- **`app/js/model.js` is git-"binary"** (intentional NUL ~line 114) — grep `-a`, hand-merge.
- **`localStorage['claude-test-rounds']` and `format: 'claude-test-round'` must never be
  renamed.** Test Checklist Runner artifact:
  https://claude.ai/code/artifact/29f87e87-3154-4046-8b95-010ab0a27eca — update it by passing
  the `url` param to the Artifact tool, and bump `round.rev` when editing the seed (it only
  seeds when `localStorage` is empty). Claude cannot see the user's progress unless they paste.
- **The site has one floor** ("Green Mile"); **BAM has no persistence** (reload resets it, which
  is what makes destructive testing safe).
- **The user is on Windows PowerShell 5.1 with no local clone** — `&&` is a syntax error there
  and Python is `python`, not `python3`.
- **Do NOT gitignore `Claude Package/`** — fresh Code-on-web sessions see only committed files,
  so this handoff and the idea docs must stay tracked. (The `handoff` skill says to gitignore
  it; **this repo overrides that**.)
- **Branch deletion over git is blocked** (proxy 403) — use the GitHub web UI. Squash-merged
  branches show "1 ahead / N behind"; check `git cherry` or an empty `git diff` vs `main`
  before calling one unsafe to delete.
