// schema.js — one explicit version for the whole persisted/portable data model,
// plus a forward-migration hook. Every artifact that outlives a page load — BAM
// project files, generated operator SEED_DATA, and localStorage counts — carries
// a version so a future shape change can migrate old data instead of silently
// breaking on it (or, for a too-new file, warn instead of mis-reading).
//
// The baseline is the CURRENT shape, so nothing is migrated today: the registry
// is empty and migrate() is a no-op. When the model shape changes, bump
// SCHEMA_VERSION and register MIGRATIONS[n] to upgrade a v(n) object to v(n+1).

export const SCHEMA_VERSION = 1;

// Version embedded in the localStorage counts key (dwelling.counts.v<N>.<site>).
// Bumping it starts a fresh key; migrate old counts in storage.js's loadCounts.
export const COUNTS_KEY_VERSION = 1;

// { [fromVersion]: (obj) => upgradedObj } — each entry upgrades by exactly one.
const MIGRATIONS = {};

// Apply the ordered chain of migrations to bring `obj` from fromV up to toV.
// Missing steps are skipped (best-effort forward compatibility).
export function migrate(obj, fromV, toV) {
  let out = obj;
  for (let v = fromV; v < toV; v++) {
    const step = MIGRATIONS[v];
    if (step) out = step(out);
  }
  return out;
}

// Read a schema/format version off a payload, tolerating absence + junk. BAM
// bundles use `version`; seeds use `schemaVersion`.
export function readVersion(obj, fallback = SCHEMA_VERSION) {
  const v = obj && (obj.schemaVersion ?? obj.version);
  return Number.isInteger(v) && v > 0 ? v : fallback;
}

// Decide what to do with a loaded BAM project bundle given the app's current
// schema version. Pure (no DOM/side effects) so it's unit-testable.
// Returns { bundle, warning } — warning is '' when there's nothing to flag.
export function resolveProjectBundle(b, current = SCHEMA_VERSION) {
  const v = readVersion(b, 1); // pre-versioned bundles predate versioning: treat as v1
  if (v > current) {
    return {
      bundle: b,
      warning: `This project was made with a newer Building Area Manager `
        + `(format v${v}; this app reads v${current}). Some data may not load correctly.`,
    };
  }
  if (v < current) return { bundle: migrate(b, v, current), warning: '' };
  return { bundle: b, warning: '' };
}
