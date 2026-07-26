// model.js — domain layer: areas, departments, I-beam mappings, pallet records,
// and derived counts. No DOM here.

import { loadRecords, saveRecords } from './storage.js';

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

function uid() {
  return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
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

  let records = loadRecords();

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

    // ---- records ----
    getRecords: () => records.slice(),
    recordCount: () => records.length,
    recordsForArea: (areaId) => records.filter((r) => r.areaId === areaId),
    hasContainer: (containerId) =>
      records.some((r) => r.containerId.toLowerCase() === String(containerId).toLowerCase()),

    addRecord({ containerId, iBeamLocation, areaId }) {
      const area = areasById.get(areaId);
      if (!area) throw new Error(`Unknown area: ${areaId}`);
      const now = new Date().toISOString();
      const rec = {
        id: uid(),
        containerId: String(containerId).trim(),
        iBeamLocation,
        areaId,
        departmentId: area.departmentId,
        createdAt: now,
        updatedAt: now,
      };
      records.push(rec);
      saveRecords(records);
      return rec;
    },

    removeRecord(id) {
      const before = records.length;
      records = records.filter((r) => r.id !== id);
      if (records.length !== before) saveRecords(records);
      return before - records.length;
    },

    updateRecord(id, patch) {
      const rec = records.find((r) => r.id === id);
      if (!rec) return null;
      Object.assign(rec, patch, { updatedAt: new Date().toISOString() });
      if (patch.areaId) {
        const area = areasById.get(patch.areaId);
        if (area) rec.departmentId = area.departmentId;
      }
      saveRecords(records);
      return rec;
    },

    // Replace the entire record set (used by import). Assumes validated input.
    replaceRecords(newRecords) {
      records = newRecords.slice();
      saveRecords(records);
    },

    // ---- derived ----
    // { areaId -> count } for EVERY area (zero-filled).
    countsByArea() {
      const counts = {};
      for (const a of seed.areas) counts[a.id] = 0;
      for (const r of records) if (counts[r.areaId] !== undefined) counts[r.areaId] += 1;
      return counts;
    },

    departmentTotal(deptId) {
      return records.filter((r) => r.departmentId === deptId).length;
    },

    totalPallets: () => records.length,
  };

  return api;
}
