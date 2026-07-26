// storage.js — pallet records persistence in the browser (localStorage).
// Single-user, offline. Import/export moves data in and out.

const KEY = 'poc3.records.v1';

export function loadRecords() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load records from localStorage:', err);
    return [];
  }
}

export function saveRecords(records) {
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
    return true;
  } catch (err) {
    console.error('Failed to save records to localStorage:', err);
    return false;
  }
}

export function clearRecords() {
  try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ }
}
