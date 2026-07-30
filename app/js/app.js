// app.js — bootstrap & wiring for the main operator app.
import { loadSeed, createModel } from './model.js';
import { validateManifest } from './validate.js';
import { colorMap, positiveExtent } from './heatmap.js';
import { createMapView } from './map.js';
import { createCountEditor } from './form.js';
import { createPanel } from './panel.js';
import { createLegend } from './legend.js';
import { createBreakdown } from './breakdown.js';
import { createIoSummary } from './iosummary.js';
import { exportCsv, exportJson, importCounts, download } from './importexport.js';
import { chooseAction } from './modal.js';

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

  // ---- selection + floor state ----
  let selectedAreaId = null;
  let currentFloorId = model.defaultFloorId();

  const legend = createLegend($('#legend'));
  const panel = createPanel($('#panel'), model);
  const breakdown = createBreakdown($('#breakdown'), model, { floorId: currentFloorId });
  const ioSummary = createIoSummary($('#io-summary'), model);

  const map = createMapView($('#map'), model, {
    onSelect: (areaId) => setSelected(areaId), // map click drives editor too
    floorId: currentFloorId,
  });

  const editor = createCountEditor($('#entry'), model, {
    onChange: refresh,
    onSelectArea: (areaId) => setSelected(areaId, { syncEditor: false }),
    floorId: currentFloorId,
  });

  // Single source of truth for the selected area. `syncEditor` pushes the
  // selection into the editor (used for map clicks); the editor's own dropdown
  // already holds it, so it opts out to avoid a redundant repopulate.
  function setSelected(areaId, { syncEditor = true } = {}) {
    selectedAreaId = areaId;
    if (syncEditor) editor.selectArea(areaId);
    renderSelection();
  }

  // ---- floor selector ----
  const floorSelect = $('#floorSelect');
  const floors = model.floors();
  floorSelect.innerHTML = floors.map((f) => `<option value="${f.id}">${f.name}</option>`).join('');
  floorSelect.value = currentFloorId;
  // Hide the control entirely when there's only one floor — nothing to switch.
  floorSelect.closest('.floor-control').style.display = floors.length < 2 ? 'none' : '';
  floorSelect.addEventListener('change', () => {
    currentFloorId = floorSelect.value;
    selectedAreaId = null;
    map.setFloor(currentFloorId);   // rebuilds boxes + background, clears selection
    editor.setFloor(currentFloorId); // repopulates the area dropdown
    breakdown.setFloor(currentFloorId); // re-rolls the per-department table
    panel.renderEmpty();
    refresh();
  });

  // ---- department filter (dims non-matching areas) ----
  // Departments are grouped by flow category, and each group offers a
  // "<Category> (all)" option (value `cat:<id>`) to filter the whole category.
  const deptFilter = $('#deptFilter');
  deptFilter.innerHTML = '<option value="">All departments</option>' +
    model.categories().map((c) => {
      const opts = c.deptIds
        .map((id) => model.getDept(id))
        .filter(Boolean)
        .map((d) => `<option value="${d.id}">${d.name}</option>`).join('');
      return `<optgroup label="${c.name}">`
        + `<option value="cat:${c.id}">${c.name} (all)</option>${opts}</optgroup>`;
    }).join('');
  deptFilter.addEventListener('change', renderSelection);
  $('#hideEmpty').addEventListener('change', renderSelection);

  // ---- reset selection ----
  $('#resetSelection').addEventListener('click', () => {
    selectedAreaId = null;
    editor.selectArea(null);
    renderSelection();
    panel.renderEmpty();
  });

  // ---- import / export ----
  $('#exportCsv').addEventListener('click', () =>
    download('poc3-dwelling-counts.csv', exportCsv(model), 'text/csv'));
  $('#exportJson').addEventListener('click', () =>
    download('poc3-dwelling-counts.json', exportJson(model), 'application/json'));
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const fmt = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv';
    const { counts, errors: errs, total } = importCounts(model, text, fmt);
    e.target.value = '';
    const areaCount = Object.keys(counts).length;
    if (errs.length) {
      const preview = errs.slice(0, 8).map((x) => `• line ${x.line}: ${x.message}`).join('\n');
      const more = errs.length > 8 ? `\n…and ${errs.length - 8} more.` : '';
      const proceed = confirm(
        `${errs.length} of ${total} rows are invalid and will be skipped:\n\n${preview}${more}\n\n`
        + `Import the ${areaCount} valid area${areaCount === 1 ? '' : 's'}?`);
      if (!proceed) { setStatus('Import cancelled.'); return; }
    }
    if (areaCount === 0) { setStatus('Nothing imported — no valid rows.', 'error'); return; }
    const action = await chooseAction({
      title: `Import ${areaCount} area${areaCount === 1 ? '' : 's'}`,
      message: 'How should these counts be applied?\n\n'
        + '• Fully replace — clear every other area, then set these.\n'
        + '• Merge — update only these areas, leave the rest as-is.',
      actions: [
        { label: 'Fully replace', value: 'replace', variant: 'primary' },
        { label: 'Merge', value: 'merge' },
        { label: 'Cancel', value: 'cancel' },
      ],
      cancelValue: 'cancel',
    });
    if (action === 'cancel') { setStatus('Import cancelled.'); return; }
    if (action === 'replace') {
      model.replaceCounts(counts);
    } else {
      for (const [areaId, n] of Object.entries(counts)) model.setCount(areaId, n);
    }
    setStatus(`Imported ${areaCount} area${areaCount === 1 ? '' : 's'}`
      + `${errs.length ? ` (${errs.length} skipped)` : ''}.`, 'success');
    editor.refresh();
    refresh();
  });

  // ---- render helpers ----
  function renderColors() {
    // Heat scale normalizes per visible floor: only this floor's counts feed the
    // color map and legend extent.
    const counts = model.countsForFloor(currentFloorId);
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
    const sel = deptFilter.value;
    const hideEmpty = $('#hideEmpty').checked;
    const counts = model.countsByArea();
    // "" = all; "cat:<id>" = a flow category; anything else = a single department.
    let deptMatch;
    if (!sel) deptMatch = () => true;
    else if (sel.startsWith('cat:')) {
      const catId = sel.slice(4);
      deptMatch = (a) => { const c = model.categoryOfDept(a.departmentId); return !!c && c.id === catId; };
    } else deptMatch = (a) => a.departmentId === sel;
    document.querySelectorAll('#map .area').forEach((rect) => {
      const a = model.getArea(rect.dataset.areaId);
      const emptyOk = !hideEmpty || counts[a.id] > 0;
      rect.classList.toggle('is-dimmed', !(deptMatch(a) && emptyOk));
    });
  }

  function refresh() {
    renderColors();
    renderSelection();
    breakdown.render();
    ioSummary.render();
    updateHeaderCount();
  }

  function updateHeaderCount() {
    const total = model.totalPallets();
    const areas = model.areasWithCount();
    $('#recordCount').textContent =
      `${total} pallet${total === 1 ? '' : 's'} across ${areas} area${areas === 1 ? '' : 's'}`;
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
