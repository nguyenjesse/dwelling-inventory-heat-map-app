// app.js — bootstrap & wiring for the main operator app.
import { loadSeed, createModel } from './model.js';
import { validateManifest } from './validate.js';
import { colorMap, positiveExtent } from './heatmap.js';
import { createMapView } from './map.js';
import { createEntryForm } from './form.js';
import { createPanel } from './panel.js';
import { createLegend } from './legend.js';
import { exportCsv, exportJson, importRecords, download } from './importexport.js';

const $ = (sel) => document.querySelector(sel);

async function main() {
  let seed;
  try {
    seed = await loadSeed();
  } catch (err) {
    showFatal('Could not load map data. The app must be served over HTTP (e.g. '
      + '`python3 -m http.server` in the app folder), not opened directly from disk.', err);
    return;
  }

  // ---- startup validation (no silent failures) ----
  const { errors, warnings } = validateManifest(seed);
  renderBanner(errors, warnings);
  if (errors.length) return; // integrity broken; stop before wiring UI

  const model = createModel(seed);

  // ---- selection state (always empty on load) ----
  let selectedAreaId = null;
  let relocatingRecordId = null;

  const legend = createLegend($('#legend'));
  const panel = createPanel($('#panel'), model, {
    onRemove: (id) => { model.removeRecord(id); refresh(); },
    onRelocate: (id) => startRelocate(id),
  });

  const map = createMapView($('#map'), model, {
    onSelect: (areaId) => {
      if (relocatingRecordId) { finishRelocate(areaId); return; }
      selectedAreaId = areaId;
      renderSelection();
    },
  });

  const form = createEntryForm($('#entry'), model, { onChange: refresh });

  // ---- department filter (dims non-matching areas) ----
  const deptFilter = $('#deptFilter');
  deptFilter.innerHTML = '<option value="">All departments</option>' +
    seed.departments.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');
  deptFilter.addEventListener('change', renderSelection);
  $('#hideEmpty').addEventListener('change', renderSelection);

  // ---- reset selection ----
  $('#resetSelection').addEventListener('click', () => {
    selectedAreaId = null; cancelRelocate(); renderSelection(); panel.renderEmpty();
  });

  // ---- import / export ----
  $('#exportCsv').addEventListener('click', () =>
    download('poc3-dwelling-records.csv', exportCsv(model), 'text/csv'));
  $('#exportJson').addEventListener('click', () =>
    download('poc3-dwelling-records.json', exportJson(model), 'application/json'));
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const fmt = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv';
    const { records, errors: errs, total } = importRecords(model, text, fmt);
    e.target.value = '';
    if (errs.length) {
      const preview = errs.slice(0, 8).map((x) => `• line ${x.line}: ${x.message}`).join('\n');
      const more = errs.length > 8 ? `\n…and ${errs.length - 8} more.` : '';
      const proceed = confirm(
        `${errs.length} of ${total} rows are invalid and will be skipped:\n\n${preview}${more}\n\n`
        + `Import the ${records.length} valid rows?`);
      if (!proceed) { setStatus('Import cancelled.'); return; }
    }
    if (records.length === 0) { setStatus('Nothing imported — no valid rows.', 'error'); return; }
    const replace = confirm(`Import ${records.length} records.\n\nOK = replace current data, `
      + `Cancel = append to existing.`);
    const existing = replace ? [] : model.getRecords().map((r) => ({
      containerId: r.containerId, iBeamLocation: r.iBeamLocation, areaId: r.areaId,
    }));
    model.replaceRecords([...existing, ...records].map((r) => {
      const area = model.getArea(r.areaId);
      const now = new Date().toISOString();
      return { id: 'r_' + Math.random().toString(36).slice(2, 10), ...r,
        departmentId: area.departmentId, createdAt: now, updatedAt: now };
    }));
    setStatus(`Imported ${records.length} records${errs.length ? ` (${errs.length} skipped)` : ''}.`, 'success');
    refresh();
  });

  // ---- relocate flow ----
  function startRelocate(id) {
    relocatingRecordId = id;
    const rec = model.getRecords().find((r) => r.id === id);
    setStatus(`Relocating "${rec.containerId}" — click a target area on the map (Esc to cancel).`);
  }
  function finishRelocate(areaId) {
    const area = model.getArea(areaId);
    model.updateRecord(relocatingRecordId, { areaId, iBeamLocation: area.iBeamLocation });
    relocatingRecordId = null;
    selectedAreaId = areaId;
    setStatus(`Moved to ${area.name}.`, 'success');
    refresh();
  }
  function cancelRelocate() {
    if (relocatingRecordId) { relocatingRecordId = null; setStatus(''); }
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { cancelRelocate(); } });

  // ---- render helpers ----
  function renderColors() {
    const counts = model.countsByArea();
    const cmap = colorMap(counts);
    map.setColors(cmap, counts);
    legend.update(positiveExtent(Object.values(counts)));
    return counts;
  }

  function renderSelection() {
    // Zone = other areas in the same department as the selected area.
    let zoneIds = [];
    if (selectedAreaId) {
      const area = model.getArea(selectedAreaId);
      zoneIds = model.areasInDept(area.departmentId).map((a) => a.id).filter((id) => id !== selectedAreaId);
    }
    map.setSelection(selectedAreaId, zoneIds);
    applyFilterDim();
    if (selectedAreaId) panel.render(selectedAreaId);
  }

  function applyFilterDim() {
    const dept = deptFilter.value;
    const hideEmpty = $('#hideEmpty').checked;
    const counts = model.countsByArea();
    document.querySelectorAll('#map .area').forEach((rect) => {
      const a = model.getArea(rect.dataset.areaId);
      const deptOk = !dept || a.departmentId === dept;
      const emptyOk = !hideEmpty || counts[a.id] > 0;
      rect.classList.toggle('is-dimmed', !(deptOk && emptyOk));
    });
  }

  function refresh() {
    renderColors();
    renderSelection();
    if (selectedAreaId) panel.render(selectedAreaId);
    setCount();
  }

  function setCount() {
    $('#recordCount').textContent = `${model.recordCount()} active record${model.recordCount() === 1 ? '' : 's'}`;
  }

  function setStatus(text, kind = '') {
    const el = $('#status');
    el.textContent = text || '';
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  // initial paint
  refresh();
  setStatus('');
}

function renderBanner(errors, warnings) {
  const el = $('#validation');
  if (!errors.length && !warnings.length) { el.hidden = true; return; }
  el.hidden = false;
  const block = (title, items, cls) => items.length
    ? `<div class="banner ${cls}"><strong>${title} (${items.length})</strong><ul>${
        items.slice(0, 12).map((m) => `<li>${m}</li>`).join('')}${
        items.length > 12 ? `<li>…and ${items.length - 12} more</li>` : ''}</ul></div>`
    : '';
  el.innerHTML = block('Data errors', errors, 'banner-error') + block('Warnings', warnings, 'banner-warn');
}

function showFatal(msg, err) {
  console.error(err);
  document.body.innerHTML = `<div class="fatal"><h1>Unable to start</h1><p>${msg}</p></div>`;
}

main();
