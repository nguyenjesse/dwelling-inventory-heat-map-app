// tests.js — dependency-free in-browser test runner.
import { ZERO_COLOR, colorForCount, positiveExtent, colorForRatio, colorMap } from '../js/heatmap.js';
import { validateManifest } from '../js/validate.js';
import { createModel } from '../js/model.js';
import { createBreakdown } from '../js/breakdown.js';
import { createIoSummary } from '../js/iosummary.js';
import { importCounts, exportCsv } from '../js/importexport.js';

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, msg: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (a !== b) throw new Error((msg || 'not equal') + ` (got ${a}, expected ${b})`); }

// Load real seed data over HTTP.
async function loadJson(p) { return (await fetch(new URL(p, document.baseURI))).json(); }

const seed = {
  areas: await loadJson('../data/areas.json'),
  departments: await loadJson('../data/departments.json'),
  ibeamMappings: await loadJson('../data/ibeam-mappings.json'),
  regions: await loadJson('../data/regions.json'),
  floors: await loadJson('../data/floors.json'),
};

// ---------- heat map ----------
test('zero count -> gray', () => eq(colorForCount(0, { min: 1, max: 10 }), ZERO_COLOR));
test('negative count -> gray', () => eq(colorForCount(-5, { min: 1, max: 10 }), ZERO_COLOR));
test('positiveExtent ignores zeros', () => {
  const ext = positiveExtent([0, 0, 3, 9, 0]);
  eq(ext.min, 3); eq(ext.max, 9);
});
test('positiveExtent all-zero -> null', () => eq(positiveExtent([0, 0, 0]), null));
test('min positive is pure green', () => eq(colorForCount(3, { min: 3, max: 9 }), colorForRatio(0)));
test('max positive is pure red', () => eq(colorForCount(9, { min: 3, max: 9 }), colorForRatio(1)));
test('midpoint is yellow, not olive', () => {
  const c = colorForCount(6, { min: 3, max: 9 });
  eq(c, colorForRatio(0.5));
  assert(/^#ffd400$/i.test(c), 'expected yellow midpoint');
});
test('all equal positives -> not all red (yellow fallback)', () => {
  const cm = colorMap({ a: 5, b: 5, c: 5 });
  assert(cm.a !== colorForRatio(1), 'should not be red when all equal');
  eq(cm.a, colorForRatio(0.5));
});
test('single positive area gets fallback (not crash)', () => {
  const cm = colorMap({ a: 0, b: 7, c: 0 });
  eq(cm.a, ZERO_COLOR); eq(cm.c, ZERO_COLOR);
  eq(cm.b, colorForRatio(0.5)); // max==min extent
});
test('ramp reads low=green, high=red (green->red shift)', () => {
  const lo = colorForRatio(0), hi = colorForRatio(1);
  const red = (h) => parseInt(h.slice(1, 3), 16);
  const grn = (h) => parseInt(h.slice(3, 5), 16);
  assert(grn(lo) > red(lo), 'low end should be greener than red');
  assert(red(hi) > grn(hi), 'high end should be redder than green');
});

// ---------- manifest integrity ----------
test('manifest validates with no errors', () => {
  const { errors } = validateManifest(seed);
  assert(errors.length === 0, 'errors: ' + errors.join('; '));
});
test('74 areas', () => eq(seed.areas.length, 74));
test('6 departments', () => eq(seed.departments.length, 6));
test('61 unique I-beams', () => eq(seed.ibeamMappings.length, 61));
test('every area lives on a declared floor', () => {
  const fids = new Set(seed.floors.map((f) => f.id));
  assert(fids.size >= 1, 'at least one floor declared');
  for (const a of seed.areas) assert(fids.has(a.floorId), `area ${a.id} on unknown floor ${a.floorId}`);
});
test('all areas have a region', () => {
  const rids = new Set(Object.keys(seed.regions.regions));
  for (const a of seed.areas) assert(rids.has(a.mapRegionId), `no region for ${a.id}`);
});
test('area IDs unique', () => {
  eq(new Set(seed.areas.map((a) => a.id)).size, seed.areas.length);
});
test('one-to-many I-beam mappings present', () => {
  const multi = seed.ibeamMappings.filter((m) => m.areaIds.length > 1).map((m) => m.iBeamLocation);
  ['E16', 'E17', 'E19', 'E20', 'E25', 'F12'].forEach((ib) => assert(multi.includes(ib), `${ib} should map to many`));
});

// ---------- model counts & selection ----------
function freshModel() {
  localStorage.removeItem('poc3.counts.v1');
  localStorage.removeItem('poc3.records.v1');
  return createModel(seed);
}
test('setCount stores per-area count', () => {
  const m = freshModel();
  m.setCount('presort-phase-1', 2);
  m.setCount('pid-1-2', 1);
  const c = m.countsByArea();
  eq(c['presort-phase-1'], 2); eq(c['pid-1-2'], 1);
});
test('countsByArea zero-fills every area', () => {
  const m = freshModel();
  m.setCount('presort-phase-1', 3);
  const c = m.countsByArea();
  eq(Object.keys(c).length, 74);
  eq(c['pid-1-2'], 0);
});
test('setCount to 0 clears the area', () => {
  const m = freshModel();
  m.setCount('presort-phase-1', 5);
  m.setCount('presort-phase-1', 0);
  eq(m.getCount('presort-phase-1'), 0);
  eq(m.areasWithCount(), 0);
});
test('setCount normalizes non-integers/negatives to 0', () => {
  const m = freshModel();
  eq(m.setCount('presort-phase-1', -4), 0);
  eq(m.setCount('presort-phase-1', 2.7), 2);
});
test('department total = sum of its area counts', () => {
  const m = freshModel();
  m.setCount('presort-phase-1', 2); // IB Dock
  m.setCount('pid-1-2', 3);          // IB Dock
  eq(m.departmentTotal('ib-dock'), 5);
});
test('totalPallets sums all areas', () => {
  const m = freshModel();
  m.setCount('presort-phase-1', 2);
  m.setCount('end-of-line-a', 4);
  eq(m.totalPallets(), 6);
  eq(m.areasWithCount(), 2);
});
test('totalPallets ignores stale/unknown areas left in storage', () => {
  // A count for an areaId that is no longer in the layout must not inflate the
  // grand total, or the IO-summary "Total" drifts above the category roll-ups.
  localStorage.setItem('poc3.counts.v1',
    JSON.stringify({ 'presort-phase-1': 2, 'ghost-removed-area': 4 }));
  const m = createModel(seed);
  eq(m.totalPallets(), 2);
  localStorage.removeItem('poc3.counts.v1');
});
test('all-zero counts drive totalPallets to 0 (IO Total reaches 0)', () => {
  localStorage.setItem('poc3.counts.v1',
    JSON.stringify({ 'presort-phase-1': 3, 'end-of-line-a': 5, 'phantom': 4 }));
  const m = createModel(seed);
  m.setCount('presort-phase-1', 0);
  m.setCount('end-of-line-a', 0);
  eq(m.totalPallets(), 0);
  eq(m.categoryTotal('inbound') + m.categoryTotal('outbound'), 0);
  localStorage.removeItem('poc3.counts.v1');
});
test('setCount rejects unknown area', () => {
  const m = freshModel();
  let threw = false;
  try { m.setCount('nope', 1); } catch (_) { threw = true; }
  assert(threw, 'unknown area should throw');
});
test('areasForIBeam returns valid areas; multi works', () => {
  const m = freshModel();
  const areas = m.areasForIBeam('E16').map((a) => a.id).sort();
  assert(areas.length === 2, 'E16 should have 2 areas');
});

// ---------- area breakdown ----------
function renderBreakdown(model) {
  const root = document.createElement('div');
  const view = createBreakdown(root, model, { floorId: model.defaultFloorId() });
  return { root, view };
}
test('breakdown lists one group per department with areas on the floor', () => {
  const m = freshModel();
  const { root } = renderBreakdown(m);
  // All 74 areas live on the single floor, so all 6 departments appear.
  eq(root.querySelectorAll('.bd-group').length, 6);
});
test('breakdown department subtotal equals sum of its area counts', () => {
  const m = freshModel();
  m.setCount('presort-phase-1', 2); // IB Dock
  m.setCount('pid-1-2', 3);          // IB Dock
  const { root } = renderBreakdown(m);
  const group = root.querySelector('.bd-group[data-dept="ib-dock"]');
  eq(group.querySelector('.bd-dept .bd-num').textContent, '5');
});
test('breakdown sub-rows expose Area / Pole / Pallet in that column order', () => {
  const m = freshModel();
  const { root } = renderBreakdown(m);
  const heads = [...root.querySelector('.bd-inner thead').querySelectorAll('th')]
    .map((th) => th.textContent);
  eq(heads[0], 'Area'); eq(heads[1], 'Pole Location'); eq(heads[2], 'Pallet Count');
});
test('breakdown groups start collapsed and toggle open on click', () => {
  const m = freshModel();
  const { root } = renderBreakdown(m);
  const group = root.querySelector('.bd-group');
  assert(!group.classList.contains('is-open'), 'starts collapsed');
  group.querySelector('.bd-dept').click();
  assert(group.classList.contains('is-open'), 'opens on click');
  eq(group.querySelector('.bd-dept').getAttribute('aria-expanded'), 'true');
  group.querySelector('.bd-dept').click();
  assert(!group.classList.contains('is-open'), 'closes on second click');
});
test('breakdown keeps a group open across a re-render', () => {
  const m = freshModel();
  const { root, view } = renderBreakdown(m);
  const deptId = root.querySelector('.bd-group').dataset.dept;
  root.querySelector(`.bd-group[data-dept="${deptId}"] .bd-dept`).click();
  view.render();
  assert(root.querySelector(`.bd-group[data-dept="${deptId}"]`).classList.contains('is-open'),
    'stays open after render');
});

// ---------- flow categories (inbound / outbound) ----------
test('categoryOfDept splits the six departments as specified', () => {
  const m = freshModel();
  const out = ['docksort', 'ob-dock', 'sort', 'fluid-load'];
  const inb = ['ib-dock', 'rpn'];
  out.forEach((d) => eq(m.categoryOfDept(d).id, 'outbound', `${d} should be outbound`));
  inb.forEach((d) => eq(m.categoryOfDept(d).id, 'inbound', `${d} should be inbound`));
});
test('categoryTotal sums only its departments', () => {
  const m = freshModel();
  m.setCount('pid-1-2', 3);          // IB Dock -> inbound
  m.setCount('presort-phase-1', 2);  // IB Dock -> inbound
  m.setCount('end-of-line-a', 4);    // Sort -> outbound
  eq(m.categoryTotal('inbound'), 5);
  eq(m.categoryTotal('outbound'), 4);
});
test('every department is categorized: inbound + outbound = total', () => {
  const m = freshModel();
  m.setCount('pid-1-2', 3);
  m.setCount('end-of-line-a', 4);
  eq(m.categoryTotal('inbound') + m.categoryTotal('outbound'), m.totalPallets());
});
test('io summary renders Outbound / Inbound / Total figures', () => {
  const m = freshModel();
  m.setCount('pid-1-2', 3);          // inbound
  m.setCount('end-of-line-a', 4);    // outbound
  const root = document.createElement('div');
  createIoSummary(root, m);
  const dd = [...root.querySelectorAll('.io-stats dd')].map((el) => el.textContent);
  eq(dd[0], '4'); // Outbound
  eq(dd[1], '3'); // Inbound
  eq(dd[2], '7'); // Total
});

// ---------- migration from legacy records ----------
test('migrates legacy records into per-area counts', () => {
  localStorage.removeItem('poc3.counts.v1');
  localStorage.setItem('poc3.records.v1', JSON.stringify([
    { id: 'x1', containerId: 'A1', areaId: 'presort-phase-1' },
    { id: 'x2', containerId: 'A2', areaId: 'presort-phase-1' },
    { id: 'x3', containerId: 'A3', areaId: 'pid-1-2' },
  ]));
  const m = createModel(seed);
  eq(m.getCount('presort-phase-1'), 2);
  eq(m.getCount('pid-1-2'), 1);
  localStorage.removeItem('poc3.counts.v1');
  localStorage.removeItem('poc3.records.v1');
});

// ---------- import / export round trip ----------
test('CSV export -> import round trip preserves counts', () => {
  const m = freshModel();
  m.setCount('presort-phase-1', 3);
  m.setCount('end-of-line-a', 7);
  const csv = exportCsv(m);
  const { counts, errors } = importCounts(m, csv, 'csv');
  eq(errors.length, 0, 'no import errors');
  eq(counts['presort-phase-1'], 3);
  eq(counts['end-of-line-a'], 7);
});
test('import rejects unknown area with visible error', () => {
  const m = freshModel();
  const csv = 'Area,Pallets\nNonexistent Area,4';
  const { counts, errors } = importCounts(m, csv, 'csv');
  eq(Object.keys(counts).length, 0);
  assert(errors.length === 1 && /Unknown area/.test(errors[0].message));
});
test('import rejects invalid pallet count', () => {
  const m = freshModel();
  const csv = 'Area,Pallets\nPresort Phase 1,-2';
  const { errors } = importCounts(m, csv, 'csv');
  assert(errors.some((e) => /Invalid pallet count/.test(e.message)));
});
test('import rejects duplicate area rows', () => {
  const m = freshModel();
  const csv = 'Area,Pallets\nPresort Phase 1,2\nPresort Phase 1,5';
  const { errors } = importCounts(m, csv, 'csv');
  assert(errors.some((e) => /Duplicate area/.test(e.message)));
});
test('import requires Area and Pallets columns', () => {
  const m = freshModel();
  const { errors } = importCounts(m, 'Foo,Bar\n1,2', 'csv');
  assert(errors.some((e) => /Missing required columns/.test(e.message)));
});
localStorage.removeItem('poc3.counts.v1');
localStorage.removeItem('poc3.records.v1');

// ---------- render ----------
const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
const summary = document.getElementById('summary');
summary.textContent = `${passed}/${results.length} passed` + (failed ? ` — ${failed} FAILED` : ' — all green');
summary.className = 'summary ' + (failed ? 'fail' : 'ok');
const ul = document.getElementById('results');
for (const r of results) {
  const li = document.createElement('li');
  li.className = r.ok ? 'pass' : 'fail';
  li.textContent = r.name + (r.ok ? '' : ` — ${r.msg}`);
  ul.appendChild(li);
}
