// model.js — domain layer: areas, departments, I-beam mappings, and per-area
// pallet counts. No DOM here.

import { loadCounts, saveCounts } from './storage.js';

// Fetch and assemble the static seed manifest. In the single-file standalone
// build the data is inlined as a global SEED_DATA, so no HTTP/fetch is needed
// (that build opens straight from disk via file://).
export async function loadSeed() {
  if (typeof SEED_DATA !== 'undefined' && SEED_DATA) return SEED_DATA;
  const base = new URL('./data/', document.baseURI);
  const [areas, departments, ibeam, regions] = await Promise.all([
    fetch(new URL('areas.json', base)).then((r) => r.json()),
    fetch(new URL('departments.json', base)).then((r) => r.json()),
    fetch(new URL('ibeam-mappings.json', base)).then((r) => r.json()),
    fetch(new URL('regions.json', base)).then((r) => r.json()),
  ]);
  return { areas, departments, ibeamMappings: ibeam, regions };
}

// Coerce any user/import value to a non-negative integer count.
function normalizeCount(n) {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function createModel(seed) {
  const areasById = new Map(seed.areas.map((a) => [a.id, a]));
  const deptsById = new Map(seed.departments.map((d) => [d.id, d]));
  const ibeamToAreas = new Map(seed.ibeamMappings.map((m) => [m.iBeamLocation, m.areaIds]));
  const areasByDept = new Map();
  for (const a of seed.areas) {
    if (!areasByDept.has(a.departmentId)) areasByDept.set(a.departmentId, []);
    areasByDept.get(a.departmentId).push(a.id);
  }
  const uniqueIBeams = [...ibeamToAreas.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }));

  // { areaId -> count }. Only positive areas are stored; zeros are absent.
  let counts = loadCounts();

  const api = {
    seed,
    areasById,
    deptsById,
    regions: seed.regions,

    // ---- lookups ----
    getArea: (id) => areasById.get(id) || null,
    getDept: (id) => deptsById.get(id) || null,
    uniqueIBeams: () => uniqueIBeams.slice(),
    areasForIBeam: (ib) => (ibeamToAreas.get(ib) || []).map((id) => areasById.get(id)).filter(Boolean),
    areasInDept: (deptId) => (areasByDept.get(deptId) || []).map((id) => areasById.get(id)).filter(Boolean),
    isValidAreaForIBeam: (ib, areaId) => (ibeamToAreas.get(ib) || []).includes(areaId),

    // ---- counts ----
    getCount: (areaId) => counts[areaId] || 0,
    areasWithCount: () => Object.keys(counts).filter((id) => counts[id] > 0).length,

    // Set an area's absolute pallet count. Non-positive clears the entry.
    setCount(areaId, n) {
      if (!areasById.has(areaId)) throw new Error(`Unknown area: ${areaId}`);
      const v = normalizeCount(n);
      if (v > 0) counts[areaId] = v;
      else delete counts[areaId];
      saveCounts(counts);
      return v;
    },

    // Replace the entire count map (used by import). Assumes validated input;
    // keys are filtered to known areas and values normalized.
    replaceCounts(newCounts) {
      const next = {};
      for (const [areaId, n] of Object.entries(newCounts || {})) {
        if (!areasById.has(areaId)) continue;
        const v = normalizeCount(n);
        if (v > 0) next[areaId] = v;
      }
      counts = next;
      saveCounts(counts);
    },

    // ---- derived ----
    // { areaId -> count } for EVERY area (zero-filled).
    countsByArea() {
      const out = {};
      for (const a of seed.areas) out[a.id] = counts[a.id] || 0;
      return out;
    },

    departmentTotal(deptId) {
      return (areasByDept.get(deptId) || []).reduce((sum, id) => sum + (counts[id] || 0), 0);
    },

    totalPallets: () => Object.values(counts).reduce((sum, n) => sum + n, 0),
  };

  return api;
}
