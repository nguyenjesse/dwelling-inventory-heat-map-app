// storage.js — per-area pallet counts persisted in the browser (localStorage).
// Single-user, offline, per-machine. Import/export moves data in and out.
//
// Shape: a plain object { areaId: count }. Areas at zero are simply absent.
//
// The key is namespaced by site code so two different sites' generated operator
// files opened on the same browser (file:// shares one origin) keep separate
// counts. The site code is baked into SEED_DATA by the build / the Building Area
// Manager editor; the served dev app and unit tests have none, so they use
// 'default'.

const SITE = (typeof SEED_DATA !== 'undefined' && SEED_DATA && SEED_DATA.siteCode)
  ? String(SEED_DATA.siteCode) : 'default';
const KEY = `dwelling.counts.v1.${SITE}`;
const LEGACY_COUNTS_KEY = 'poc3.counts.v1';   // pre-namespacing (POC3-only) key
const LEGACY_RECORDS_KEY = 'poc3.records.v1';  // pre-count model: array of records

// The legacy POC3 keys belong to the original single-site build. Only adopt them
// for the user's own contexts (the POC3 standalone and the served dev app) — a
// different site's file must never absorb POC3's counts.
const ADOPT_LEGACY = SITE === 'POC3' || SITE === 'default';

function readObject(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    console.error('Failed to load counts from localStorage:', err);
    return null;
  }
}

// One-time migration: if there are no counts yet but the old per-container
// records exist, tally them per area so existing associate data isn't lost.
// The legacy key is left in place as a fallback; it is no longer read after this.
function migrateFromRecords() {
  try {
    const raw = localStorage.getItem(LEGACY_RECORDS_KEY);
    if (!raw) return null;
    const records = JSON.parse(raw);
    if (!Array.isArray(records) || records.length === 0) return null;
    const counts = {};
    for (const r of records) {
      if (r && r.areaId) counts[r.areaId] = (counts[r.areaId] || 0) + 1;
    }
    saveCounts(counts);
    return counts;
  } catch (err) {
    console.error('Failed to migrate legacy records:', err);
    return null;
  }
}

export function loadCounts() {
  const existing = readObject(KEY);
  if (existing) return existing;
  if (ADOPT_LEGACY) {
    // Adopt pre-namespacing POC3 counts, then fall back to the record model.
    const legacyCounts = readObject(LEGACY_COUNTS_KEY);
    if (legacyCounts) { saveCounts(legacyCounts); return legacyCounts; }
    return migrateFromRecords() || {};
  }
  return {};
}

export function saveCounts(counts) {
  try {
    localStorage.setItem(KEY, JSON.stringify(counts));
    return true;
  } catch (err) {
    console.error('Failed to save counts to localStorage:', err);
    return false;
  }
}

export function clearCounts() {
  try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ }
}
