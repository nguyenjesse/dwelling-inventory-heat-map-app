// importexport.js — CSV/JSON import & export. Validated imports with visible
// errors (no silent skips, unlike the Excel original).

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
export function exportCsv(model) {
  const header = ['Container ID', 'I_Beam_Location', 'Area', 'Department'];
  const lines = [header.map(csvEscape).join(',')];
  for (const r of model.getRecords()) {
    const area = model.getArea(r.areaId);
    const dept = model.getDept(r.departmentId);
    lines.push([
      csvEscape(r.containerId),
      csvEscape(r.iBeamLocation),
      csvEscape(area ? area.name : r.areaId),
      csvEscape(dept ? dept.name : r.departmentId),
    ].join(','));
  }
  return lines.join('\r\n');
}

export function exportJson(model) {
  return JSON.stringify(model.getRecords(), null, 2);
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

// Returns { records: [...valid], errors: [{line, message}], total }.
// Records are validated: area must resolve, and (if an I-beam is given) the
// area must be valid for that I-beam.
export function importRecords(model, text, format) {
  const idx = buildAreaIndex(model);
  const errors = [];
  const records = [];
  const fmt = format || (text.trim().startsWith('[') || text.trim().startsWith('{') ? 'json' : 'csv');

  let rawRows = [];
  if (fmt === 'json') {
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { return { records: [], errors: [{ line: 0, message: 'Invalid JSON: ' + e.message }], total: 0 }; }
    const arr = Array.isArray(parsed) ? parsed : (parsed.records || []);
    rawRows = arr.map((o) => ({
      containerId: o.containerId ?? o['Container ID'],
      iBeamLocation: o.iBeamLocation ?? o['I_Beam_Location'],
      area: o.areaId ?? o.area ?? o['Area'],
    }));
  } else {
    const rows = parseCsv(text);
    if (rows.length === 0) return { records: [], errors: [{ line: 0, message: 'File is empty.' }], total: 0 };
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = (names) => header.findIndex((h) => names.includes(h));
    const ci = col(['container id', 'containerid', 'container']);
    const ii = col(['i_beam_location', 'i-beam location', 'ibeam', 'i beam location']);
    const ai = col(['area']);
    if (ci < 0 || ai < 0) {
      return { records: [], errors: [{ line: 1, message: 'Missing required columns "Container ID" and/or "Area".' }], total: 0 };
    }
    rawRows = rows.slice(1).map((r) => ({
      containerId: r[ci], iBeamLocation: ii >= 0 ? r[ii] : '', area: r[ai],
    }));
  }

  const total = rawRows.length;
  const seenContainers = new Set();
  rawRows.forEach((raw, i) => {
    const line = i + 2; // account for header + 1-index
    const containerId = String(raw.containerId ?? '').trim();
    const iBeam = String(raw.iBeamLocation ?? '').trim();
    if (!containerId) { errors.push({ line, message: 'Missing Container ID.' }); return; }
    const area = resolveArea(model, idx, raw.area);
    if (!area) { errors.push({ line, message: `Unknown area "${raw.area}".` }); return; }
    if (iBeam && !model.isValidAreaForIBeam(iBeam, area.id)) {
      errors.push({ line, message: `Area "${area.name}" is not valid for I-beam "${iBeam}".` });
      return;
    }
    if (seenContainers.has(containerId.toLowerCase())) {
      errors.push({ line, message: `Duplicate Container ID "${containerId}" within import.` });
      return;
    }
    seenContainers.add(containerId.toLowerCase());
    records.push({
      containerId,
      iBeamLocation: iBeam || area.iBeamLocation,
      areaId: area.id,
    });
  });

  return { records, errors, total };
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
