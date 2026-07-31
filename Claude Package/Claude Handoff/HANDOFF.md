# HANDOFF — Code → Code · 2026-07-30 20:37 PT

## What happened this session
Picked up the prior consolidation baton and closed out its two remaining items.
The carried-over **human-eyes item — a real-world BAM dry run — is now DONE**: the
user built/opened a real site and confirmed it "looks good." Implemented the
optional **build-time `OPERATOR_TEMPLATE` guard** (the second suggested follow-up),
opened PR #9, and the user merged it to `main`. `main` is current and green.

## Changes on disk (commit `d292625` on `main`, merged via PR #9 → `4230e93`)
- **`build/build-standalone.py`** — added `validate_operator_template(operator_template, template_literal)`,
  called in `main()` immediately after `template_literal` is computed and **before** the
  editor standalones are written. It raises `SystemExit` (fails the build loudly) if the
  operator page the editor embeds would be a dud:
  - template shorter than 500 chars (body/CSS/JS inlining failed),
  - either placeholder token missing (`__BAM_SEED_DATA__` / `__BAM_BG_IMAGE_DATA_URIS__`)
    that `opbuild.js` substitutes into,
  - no `<script>` block (operator JS bundle missing),
  - a raw `</script` surviving in the escaped literal (the `<` → `<` escaping — see
    Dead ends — failed to apply).
- No `app/` source, tests, standalones, or docs changed — the diff is this one function
  plus its call site. Standalones regenerate **byte-identical**, so runtime behavior is
  provably unchanged.

## Decisions taken and why (don't re-litigate)
- **Item A (BAM localStorage autosave) is DEFERRED — user explicitly said they're probably
  not implementing it.** Don't re-propose it unprompted. BAM still persists only via explicit
  Save/Load; that's the accepted state.
- **The guard lives in the build script, not the runtime.** It protects the *distribution
  artifact* (the manager HTML you email out), catching a broken embed on the builder's
  machine before a receiving site ever generates a blank heat map. It adds no app behavior.
- **Merged to `main` via PR #9** (user opened + merged it themselves this session). The prior
  "straight to main, no PR" convention was situational; here the user chose the PR path.

## Workflow clarification surfaced this session (worth remembering)
The user asked whether receiving sites need the Python. They do **not**. Distribution is a
**single HTML file** (`Building-Area-Manager.html`), which embeds the operator page as
`OPERATOR_TEMPLATE`; the site builds its layout and clicks "Build operator file" to generate
its own self-contained operator heat map in-browser. `build/build-standalone.py` is the
builder's tool only — it *creates* the manager, it is never distributed.

## Verification status
- **Guard verified directly:** build runs clean on current source; all three standalones
  regenerate byte-for-byte identical to committed; a negative test confirmed the guard fires
  on each of the three failure modes (empty template, missing token, raw `</script`) and
  passes valid input.
- **Real-world BAM dry run: DONE by the user** (the item the last two handoffs flagged for
  human eyes). Reported as looking good. No longer outstanding.
- **Unit suite NOT re-run this session** — deliberately. The change is build-only; `app/`
  and `app/tests/` are untouched and the standalones are byte-identical, so the prior
  **49/49** result stands unchanged. Re-run via `headless_shell` over HTTP only if you touch
  `app/` (see Dead ends for the headless invocation).

## Dead ends & gotchas (carried forward — still true)
- **`app/js/model.js` is git-"binary"** (intentional NUL byte as a map-key delimiter at
  ~line 114, on all branches — NOT corruption). Any future merge touching it must be
  hand-merged; never "fix" the NUL.
- **The three top-level `*.html` files are GENERATED** by `build/build-standalone.py` — never
  hand-edit; rebuild after any `app/` change. The new guard now protects the `<` → `<`
  escaping of the embedded `OPERATOR_TEMPLATE` (a raw `</script>` blanks the editor).
- **Storage is namespaced** (`dwelling.counts.v1.<siteCode>`; `default` for dev/tests). A test
  seeding the legacy `poc3.counts.v1` key must `clearAllCountKeys()` first or a prior test's
  namespaced counts win.
- **Headless browser:** full `chromium` won't run headless here. Use `headless_shell` at
  `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell` over HTTP;
  `playwright-core` installs into the (ephemeral) scratchpad. Stop servers with
  `fuser -k <port>/tcp`, never `pkill -f`.
- **Branch deletion over git is blocked** (`git push origin --delete` → proxy 403; no MCP
  delete-branch tool). Delete branches via the GitHub web UI if needed.
- **Do NOT gitignore `Claude Package/`** — fresh Code-on-web sessions clone the repo and see
  only committed files, so the handoff must stay tracked. (Standing decision.)

## Suggested next steps
- **Nothing outstanding — `main` is a clean stopping point.** Both prior follow-ups are
  resolved (dry run done; guard shipped) and item A is deferred by the user.
- If new work is wanted, the only remaining idea on the table is the deferred BAM autosave —
  but **do not start it without the user asking**, since they've said they likely won't.

## Open questions
- None blocking.
