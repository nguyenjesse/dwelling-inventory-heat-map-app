# HANDOFF — Code → Code · 2026-07-31 02:00 PT

## What happened this session
Consolidated the repo onto a single, up-to-date `main`. The work had drifted across two branches —
`main` had the PR #8 POC3 work (import replace/merge modal, IO Total drift fix, whole-number input);
the Building Area Manager (BAM) lived only on `claude/startup-skill-e9mcuv`, which had been cut before
PR #8 so its POC3 was stale. Merged BAM into `main` so `main` now has **both**, verified end-to-end,
and pushed. Deleted the redundant branches — the repo is now just `main`.

## Changes on disk (merge commit `362179d` on `main`, pushed)
Point to the diff, don't re-read all of it. Key pieces of the merge resolution:
- **`app/js/model.js`** — hand-merged. Kept BAM's seed-derived categories (`deriveCategories`,
  `siteCode`/`siteName`, empty-manifest handling) and applied PR #8's `totalPallets` fix on top
  (`seed.areas.reduce((sum, a) => sum + (counts[a.id] || 0), 0)` — sum over KNOWN areas only).
- **`app/tests/tests.js`** — fixed a test-isolation bug the merge exposed: two `totalPallets` tests
  seeded the legacy `poc3.counts.v1` key without clearing BAM's namespaced key first, so a prior
  test's counts leaked in. They now `clearAllCountKeys()` around the seed.
- **`README.md`, `app/README.md`** — combined both feature sets (BAM build-operator flow + three
  outputs; PR #8 import modes / roll-ups / whole-number rule). README test count now says 49/49.
- **`POC3-Dwelling-Inventory-Map.html`, `POC3-Building-Area-Manager.html`, `Building-Area-Manager.html`**
  — regenerated from merged source via `build/build-standalone.py` (not line-merged).
- Everything else (BAM's `opbuild.js`, `editor.js`, `storage.js`, `app/data/*.json`, and PR #8's
  `form.js`, `modal.js`, `styles.css`) came in via clean auto-merge.

## Decisions taken and why (don't re-litigate)
- **Everything consolidated onto `main` via a merge commit**, not a rebase — the user was confused by
  multiple branches/PRs and asked for one up-to-date `main`. A non-ff merge keeps both histories and
  makes "main has everything" unambiguous.
- **Merged straight to `main`, no PR.** The user earlier wanted a review before merge but then
  explicitly chose to consolidate directly. The full BAM diff was analyzed closely during the merge in
  lieu of a separate review pass.
- **`model.js` resolution = BAM base + PR #8's one-line `totalPallets` fix.** The two edits are
  logically compatible; only git's binary flag forced a manual merge.
- **Standalones regenerated from source**, never trusting a 3-way merge of generated HTML.

## Verification status
- **49/49 unit tests green** (headless_shell over HTTP). Covers the Total fix, category roll-ups,
  import round-trips, and in-browser operator-file generation.
- **All three standalones load from `file://` with zero JS errors**; POC3 operator renders 74 regions,
  IO Total, correct "POC3…" title.
- **Full BAM "Build operator file" flow passed end-to-end**: driving the POC3-seeded BAM generated a
  valid ~3.5 MB operator file that opens and renders 74 regions with an inlined base64 background, no
  JS errors. PR #8's import replace/merge modal still resolves correctly.
- **What still needs the USER's eyes** (carried from the prior session, still not done by a human): a
  real-world dry run of BAM with an actual second-site floor plan — **multi-floor** and a **large
  image** to exercise the >2000px canvas down-scale path, plus Save → New site → Load → Build. The
  automated e2e used POC3's own data, not a fresh site with a big image.
- Verification harness (playwright scripts, generated test files) lived in the **session scratchpad
  only** — ephemeral, already gone with the session; nothing to find on the repo disk.

## Dead ends & gotchas
- **`app/js/model.js` is git-"binary" and won't auto-merge.** Line ~114 uses an intentional NUL byte as
  a map-key delimiter (`` `${floorId}\0${ib}` ``), present on all branches — **not corruption.** Any
  future merge touching `model.js` must be hand-merged; don't "fix" the NUL.
- **Storage is namespaced** (`dwelling.counts.v1.<siteCode>`; `default` for dev/tests). Legacy
  `poc3.counts.v1` is adopted only for POC3/default, and only when the namespaced key is empty. A test
  that seeds the legacy key must `clearAllCountKeys()` first or a prior test's namespaced counts win —
  this exact trap broke one test during the merge.
- **The three top-level `*.html` files are GENERATED** by `build/build-standalone.py` — never hand-edit;
  rebuild after any `app/` source change. Keep the `<` → `&lt;` escaping of the embedded
  `OPERATOR_TEMPLATE`, or a literal `</script>` blanks the editor.
- **Headless browser:** full `chromium` won't run headless here ("Old Headless mode removed"). Use
  `headless_shell` at `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell` over
  HTTP; `playwright-core` installs into the (ephemeral) scratchpad. Stop servers with
  `fuser -k <port>/tcp`, never `pkill -f` (it matches its own command line and kills the shell).
- **Branch deletion over git is blocked** — `git push origin --delete` returns proxy `403`, and the
  GitHub MCP has no delete-branch tool. `e9mcuv` was deleted by the user via the GitHub web UI. The
  repo is now a single `main` branch.
- **Do NOT gitignore `Claude Package/`** — fresh Code-on-web sessions clone the repo and see only
  committed files, so the handoff must stay tracked. (Standing decision.)

## Suggested next steps
1. **Real-world BAM dry run (the human-eyes item above).** Double-click `Building-Area-Manager.html`,
   build a small real second site with a genuine **multi-floor** layout and at least one **large
   (>2000px) PNG** to confirm the down-scale path, then Save project → New site → Load project → Build
   operator file, and open the result to confirm title, Inbound/Outbound summary, areas, and background.
2. Optional follow-ups if wanted: localStorage **autosave** in BAM (today only explicit Save/Load
   guards against a tab close); a build-time check that warns if `OPERATOR_TEMPLATE` is missing before
   emitting the editor.

## Open questions
- None blocking. (The earlier "open a PR / hold for review?" question is resolved — consolidated
  straight to `main`. The POC3 rename to `POC3-Building-Area-Manager.html` is likewise settled and now
  on `main`.)
