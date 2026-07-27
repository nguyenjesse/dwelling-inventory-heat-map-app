// importexport.js — per-area CSV/JSON import & export. Validated imports with
// visible errors (no silent skips, unlike the Excel original).

// ---------- CSV helpers ----------
function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Minimal RFC-4180-ish CSV parser (handles quotes, commas, newlines in quotes).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') pushField();
    else if (c === '\n') { pushField(); pushRow(); }
    else if (c === '\r') { /* ignore, handled by \n */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { pushField(); pushRow(); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

// ---------- Export ----------
// One row per area that currently holds pallets.
export function exportCsv(model) {
  const header = ['Area', 'Department', 'I_Beam_Location', 'Pallets'];
  const lines = [header.map(csvEscape).join(',')];
  for (const area of model.seed.areas) {
    const count = model.getCount(area.id);
    if (count <= 0) continue;
    const dept = model.getDept(area.departmentId);
    lines.push([
      csvEscape(area.name),
      csvEscape(dept ? dept.name : area.departmentId),
      csvEscape(area.iBeamLocation),
      csvEscape(count),
    ].join(','));
  }
  return lines.join('\r\n');
}

export function exportJson(model) {
  const out = [];
  for (const area of model.seed.areas) {
    const count = model.getCount(area.id);
    if (count > 0) out.push({ areaId: area.id, area: area.name, count });
  }
  return JSON.stringify(out, null, 2);
}

// ---------- Import ----------
// Build name/id lookup indexes from the model's areas.
function buildAreaIndex(model) {
  const byId = new Map();
  const byName = new Map();
  for (const a of model.seed.areas) {
    byId.set(a.id, a);
    byName.set(a.name.trim().toLowerCase(), a);
  }
  return { byId, byName };
}

function resolveArea(model, idx, value) {
  if (!value) return null;
  const v = String(value).trim();
  return idx.byId.get(v) || idx.byName.get(v.toLowerCase()) || null;
}

// Returns { counts: { areaId: n }, errors: [{line, message}], total }.
// Each row must resolve to a known area and carry a non-negative integer count.
// Duplicate areas within the file are rejected (no silent last-wins).
export function importCounts(model, text, format) {
  const idx = buildAreaIndex(model);
  const errors = [];
  const counts = {};
  const fmt = format || (text.trim().startsWith('[') || text.trim().startsWith('{') ? 'json' : 'csv');

  let rawRows = [];
  if (fmt === 'json') {
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { return { counts: {}, errors: [{ line: 0, message: 'Invalid JSON: ' + e.message }], total: 0 }; }
    const arr = Array.isArray(parsed) ? parsed : (parsed.counts || parsed.records || []);
    rawRows = arr.map((o) => ({
      area: o.areaId ?? o.area ?? o['Area'],
      pallets: o.count ?? o.pallets ?? o['Pallets'],
    }));
  } else {
    const rows = parseCsv(text);
    if (rows.length === 0) return { counts: {}, errors: [{ line: 0, message: 'File is empty.' }], total: 0 };
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = (names) => header.findIndex((h) => names.includes(h));
    const ai = col(['area']);
    const pi = col(['pallets', 'count', 'pallet count']);
    if (ai < 0 || pi < 0) {
      return { counts: {}, errors: [{ line: 1, message: 'Missing required columns "Area" and/or "Pallets".' }], total: 0 };
    }
    rawRows = rows.slice(1).map((r) => ({ area: r[ai], pallets: pi >= 0 ? r[pi] : '' }));
  }

  const total = rawRows.length;
  const seenAreas = new Set();
  rawRows.forEach((raw, i) => {
    const line = i + 2; // account for header + 1-index
    const area = resolveArea(model, idx, raw.area);
    if (!area) { errors.push({ line, message: `Unknown area "${raw.area}".` }); return; }
    const rawCount = String(raw.pallets ?? '').trim();
    const n = Number(rawCount);
    if (rawCount === '' || !Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      errors.push({ line, message: `Invalid pallet count "${raw.pallets}" for "${area.name}" (whole number ≥ 0).` });
      return;
    }
    if (seenAreas.has(area.id)) {
      errors.push({ line, message: `Duplicate area "${area.name}" within import.` });
      return;
    }
    seenAreas.add(area.id);
    if (n > 0) counts[area.id] = n;
  });

  return { counts, errors, total };
}

// Trigger a browser download of text content.
export function download(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
