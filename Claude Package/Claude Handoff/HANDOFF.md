# HANDOFF — Code → Code · 2026-07-31 01:15 PT

## What happened this session
Built **Building Area Manager (BAM)** — the region editor reworked into a single
double-click file the user can hand to *another warehouse* so that site sets up
its own map and generates its own operator heat-map file, entirely in the browser
(no Python, terminal, or repo). Committed as **`2676abd`** and **pushed** to
`claude/startup-skill-e9mcuv`. **Not yet reviewed and no PR opened** — see next
steps; the user explicitly wants the repo reviewed before anything merges.

## Changes on disk (commit `2676abd`, branch `claude/startup-skill-e9mcuv`)
Point to the diff, don't re-read all of it. Key pieces:
- **`app/js/opbuild.js`** (new) — in-browser operator-file generation: `fillOperatorTemplate`
  (token replace via *replacer functions* so `$`-sequences in base64/JSON aren't mangled)
  and `readImageDataUrl` (File → base64, down-scales >2000px wide via canvas).
- **`app/js/editor.js`** (rewritten) — BAM: Site-code field, per-department flow-category
  picker, capture of loaded image **bytes** (`bgFiles` Map), **Build operator file**,
  **Save/Load project** (JSON incl. `bgImageDataUris`), **New site**, zero-floor empty state.
- **`app/js/model.js`** — categories now **derived from seed** (`deriveCategories`) instead of
  a hard-coded const; added `siteCode()`/`siteName()`; `normalizeSeed` now leaves a truly-empty
  manifest floor-less (for BAM's blank start).
- **`app/js/storage.js`** — counts key namespaced by site (`dwelling.counts.v1.<code>`); adopts
  legacy `poc3.counts.v1` only for POC3/dev.
- **`app/js/iosummary.js`**, **`app/js/app.js`** — iterate `model.categories()`; app sets the
  operator title/h1 + export filenames from the site code.
- **`app/data/departments.json`** (+`categoryId`), **`app/data/categories.json`** (new).
- **`app/editor.html`** + **`app/css/editor.css`** — BAM rebrand + new controls/empty state.
- **`build/build-standalone.py`** — emits 3 files (below); embeds the operator page as a
  token-placeholder `OPERATOR_TEMPLATE` in the editor.
- **`POC3-Region-Editor.html` → `POC3-Building-Area-Manager.html`** (renamed/superseded).
  Build outputs: `POC3-Dwelling-Inventory-Map.html` (operator), `POC3-Building-Area-Manager.html`
  (POC3-seeded editor), **`Building-Area-Manager.html`** (blank — the file to send other sites).
- READMEs updated (root + `app/`).

## Decisions taken and why (don't re-litigate)
- **In-browser "Build operator file" button, NOT a Python script** — the whole point is that a
  receiving site needs no repo/terminal. A browser can't run Python, so the build logic was
  reimplemented in JS; `build-standalone.py` embeds the operator HTML as a string template that
  BAM fills at runtime.
- **Send ONE file** (`Building-Area-Manager.html`) to other sites — no folder. The only thing a
  site supplies is its own floor-plan image.
- **Categories = fixed Inbound/Outbound** (user picked "like it is now" over site-defined custom
  names) — but stored as **per-site seed data** so each site's grouping travels into its file.
- **POC3 layout preserved** — `app/data/*.json` only got an additive `categoryId`; the user is
  still mid-work on POC3, so its editor + operator map keep building unchanged.
- **Counts namespaced by site code** so two sites' files can't clash localStorage on one browser.

## Verification status
- Test suite **47/47 green** (added: seed-derived categories, namespaced-storage + legacy
  adoption, `$`-safe template fill). Run served: `python3 -m http.server` in `app/`, open
  `tests/tests.html`.
- **Full end-to-end passed in real Chromium**: blank BAM → Load project → Build operator file →
  the generated `<CODE>-Dwelling-Inventory-Map.html` opens from `file://` with correct title,
  Inbound/Outbound summary, map areas, and **inlined background**; POC3 operator + POC3-seeded
  BAM both unchanged (74 areas, green-mile, "POC3…" title). Screenshots eyeballed.
- **What still needs the USER's eyes**: (1) a **code review of the branch** — nothing has been
  reviewed; (2) a real-world dry run in their own browser with an actual second-site floor plan
  (multi-floor, a large image to confirm down-scaling, Save→reload→Build).
- Verification harness (`verify.mjs`, screenshots, `project.json`) lives in the **session
  scratchpad only** — ephemeral, not on the repo disk, will vanish with the session.

## Dead ends & gotchas
- **`</script>` in the embedded template breaks the editor page.** The operator HTML is embedded
  as a JS string inside BAM's own `<script>`; its literal `</script>` closed the tag early and
  blanked the editor. Fixed by escaping every `<` → `<` in `build-standalone.py`
  (`template_literal`). First build hit exactly this — **don't remove that escape.**
- **`chromium` (full) won't run headless** here ("Old Headless mode removed"). Use
  **headless_shell** at `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`,
  served over HTTP. (Carried from last session — still true.)
- **`pkill -f "http.server 8137"` killed the shell** mid-verify — `-f` matched the pkill command's
  own line. Use `fuser -k <port>/tcp` instead.
- Playwright ran from the **scratchpad** (`playwright-core` installed there). Never commit
  `node_modules`/`package*.json` — this stays a dependency-free static project.
- **Do NOT gitignore `Claude Package/`** — fresh Code-on-web sessions clone the repo and see only
  committed files, so the handoff must stay tracked. (Standing decision; overrides the generic
  advice.)
- Background bytes: fresh loads come from `File`→`readAsDataURL`; already-baked/project images
  fall back to `BG_IMAGE_DATA_URIS` / the project's `bgImageDataUris`. `uniqueImageName` de-dupes
  filenames so two floors can't collide on one image key.

## Suggested next steps
1. **Review the repo — this is the priority the user called out.** Review the `2676abd` diff on
   `claude/startup-skill-e9mcuv` (run `/code-review`, and/or read the rewritten `app/js/editor.js`
   + `build/build-standalone.py` closely). Nothing here has been reviewed yet.
2. **Real-world dry run**: open `Building-Area-Manager.html` by double-click, build a small
   fake site with a genuine floor-plan PNG, Save project → New site → Load project → Build
   operator file; open the result and confirm it looks right. Especially exercise a **multi-floor**
   site and a **large image** (down-scale path) — the automated e2e used a tiny synthetic PNG.
3. **Decide on a PR / merge** once reviewed (user must confirm — no PR was opened this session).
4. Optional follow-ups if wanted: localStorage **autosave** in BAM (today only explicit
   Save/Load guards against a tab close); a build-time check that warns if `OPERATOR_TEMPLATE`
   is missing.

## Open questions
- Open a PR for this branch, or hold at the pushed commit pending review? (Not decided.)
- OK that `POC3-Region-Editor.html` was removed/renamed to `POC3-Building-Area-Manager.html`?
  (Assumed yes — it's the same tool, now BAM-branded and able to Build operator files.)
