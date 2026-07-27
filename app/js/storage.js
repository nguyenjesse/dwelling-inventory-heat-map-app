// storage.js — per-area pallet counts persisted in the browser (localStorage).
// Single-user, offline, per-machine. Import/export moves data in and out.
//
// Shape: a plain object { areaId: count }. Areas at zero are simply absent.

const KEY = 'poc3.counts.v1';
const LEGACY_RECORDS_KEY = 'poc3.records.v1'; // pre-count model: array of records

function readObject() {
  try {
    const raw = localStorage.getItem(KEY);
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
  const existing = readObject();
  if (existing) return existing;
  return migrateFromRecords() || {};
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
