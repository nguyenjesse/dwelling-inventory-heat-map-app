// tests.js — dependency-free in-browser test runner.
import { ZERO_COLOR, colorForCount, positiveExtent, colorForRatio, colorMap } from '../js/heatmap.js';
import { validateManifest } from '../js/validate.js';
import { createModel } from '../js/model.js';
import { createBreakdown } from '../js/breakdown.js';
import { createIoSummary } from '../js/iosummary.js';
import { importCounts, exportCsv, exportJson, exportFilename } from '../js/importexport.js';
import { fillOperatorTemplate, SEED_TOKEN, BG_TOKEN } from '../js/opbuild.js';
import { matchAreas } from '../js/form.js';
import { SCHEMA_VERSION, migrate, readVersion, resolveProjectBundle } from '../js/schema.js';
import { createHistory } from '../js/history.js';
import { rangeSelect, clampGroupDelta, normalizeRect, rectHits, paintOrder } from '../js/selection.js';

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
  categories: await loadJson('../data/categories.json'),
};

// Counts are stored under a site-namespaced key; tests have no SEED_DATA global,
// so they use the 'default' namespace. Clear it plus the legacy POC3 keys.
const COUNTS_KEY = 'dwelling.counts.v1.default';
function clearAllCountKeys() {
  localStorage.removeItem(COUNTS_KEY);
  localStorage.removeItem('poc3.counts.v1');
  localStorage.removeItem('poc3.records.v1');
}

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
  clearAllCountKeys();
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
  // Clear the namespaced key first so the legacy counts get adopted (loadCounts
  // reads the namespaced key ahead of the legacy one).
  clearAllCountKeys();
  localStorage.setItem('poc3.counts.v1',
    JSON.stringify({ 'presort-phase-1': 2, 'ghost-removed-area': 4 }));
  const m = createModel(seed);
  eq(m.totalPallets(), 2);
  clearAllCountKeys();
});
test('all-zero counts drive totalPallets to 0 (IO Total reaches 0)', () => {
  clearAllCountKeys();
  localStorage.setItem('poc3.counts.v1',
    JSON.stringify({ 'presort-phase-1': 3, 'end-of-line-a': 5, 'phantom': 4 }));
  const m = createModel(seed);
  m.setCount('presort-phase-1', 0);
  m.setCount('end-of-line-a', 0);
  eq(m.totalPallets(), 0);
  eq(m.categoryTotal('inbound') + m.categoryTotal('outbound'), 0);
  clearAllCountKeys();
});
test('setCount rejects unknown area', () => {
  const m = freshModel();
  let threw = false;
  try { m.setCount('nope', 1); } catch (_) { threw = true; }
  assert(threw, 'unknown area should throw');
});
test('canUndo is false on a fresh model', () => {
  const m = freshModel();
  assert(m.canUndo() === false, 'nothing to undo yet');
  eq(m.undo(), null);
});
test('undo restores the value from before the last setCount', () => {
  const m = freshModel();
  m.setCount('presort-phase-1', 5);
  m.setCount('presort-phase-1', 9);
  assert(m.canUndo(), 'should have an undoable change');
  const done = m.undo();
  eq(done.areaId, 'presort-phase-1'); eq(done.restored, 5);
  eq(m.getCount('presort-phase-1'), 5);
  assert(m.canUndo() === false, 'undo is single-level, no redo');
});
test('undo of a first-time set clears the area (prev was 0)', () => {
  const m = freshModel();
  m.setCount('presort-phase-1', 4);
  m.undo();
  eq(m.getCount('presort-phase-1'), 0);
  eq(m.areasWithCount(), 0);
});
test('undo of a Clear restores the prior count', () => {
  const m = freshModel();
  m.setCount('presort-phase-1', 7);
  m.setCount('presort-phase-1', 0); // Clear
  m.undo();
  eq(m.getCount('presort-phase-1'), 7);
});
test('replaceCounts disables undo (bulk import is not single-undoable)', () => {
  const m = freshModel();
  m.setCount('presort-phase-1', 3);
  m.replaceCounts({ 'end-of-line-a': 2 });
  assert(m.canUndo() === false, 'import replace clears the undo');
  eq(m.undo(), null);
});
test('clearUndo drops the pending undo', () => {
  const m = freshModel();
  m.setCount('presort-phase-1', 3);
  m.clearUndo();
  assert(m.canUndo() === false);
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
test('categories are derived from seed data (order + deptIds)', () => {
  const cats = freshModel().categories();
  eq(cats.length, 2);
  eq(cats[0].id, 'outbound'); eq(cats[1].id, 'inbound'); // order follows categories.json
  assert(cats[0].deptIds.includes('docksort') && cats[0].deptIds.includes('fluid-load'), 'outbound depts');
  assert(cats[1].deptIds.includes('ib-dock') && cats[1].deptIds.includes('rpn'), 'inbound depts');
});
test('categories adapt to a different site grouping', () => {
  const custom = {
    ...seed,
    departments: [
      { id: 'recv', name: 'Receiving', categoryId: 'inbound' },
      { id: 'ship', name: 'Shipping', categoryId: 'outbound' },
    ],
    areas: [], ibeamMappings: [], regions: { regions: {} },
    floors: [{ id: 'f1', name: 'F', image: 'x.png', imageWidth: 10, imageHeight: 10 }],
    categories: [{ id: 'inbound', name: 'Inbound' }, { id: 'outbound', name: 'Outbound' }],
  };
  const m = createModel(custom);
  eq(m.categoryOfDept('recv').id, 'inbound');
  eq(m.categoryOfDept('ship').id, 'outbound');
  eq(m.categories()[0].id, 'inbound'); // order follows this site's categories list
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

// ---------- storage: site namespace + legacy migration ----------
test('counts persist under a site-namespaced key', () => {
  clearAllCountKeys();
  const m = createModel(seed);
  m.setCount('presort-phase-1', 4);
  const raw = localStorage.getItem(COUNTS_KEY);
  assert(raw, 'writes the namespaced key');
  eq(JSON.parse(raw)['presort-phase-1'], 4);
  clearAllCountKeys();
});
test('adopts legacy poc3.counts.v1 on first load', () => {
  clearAllCountKeys();
  localStorage.setItem('poc3.counts.v1', JSON.stringify({ 'presort-phase-1': 6 }));
  const m = createModel(seed);
  eq(m.getCount('presort-phase-1'), 6);
  assert(localStorage.getItem(COUNTS_KEY), 'copies legacy counts into the namespaced key');
  clearAllCountKeys();
});
test('migrates legacy records into per-area counts', () => {
  clearAllCountKeys();
  localStorage.setItem('poc3.records.v1', JSON.stringify([
    { id: 'x1', containerId: 'A1', areaId: 'presort-phase-1' },
    { id: 'x2', containerId: 'A2', areaId: 'presort-phase-1' },
    { id: 'x3', containerId: 'A3', areaId: 'pid-1-2' },
  ]));
  const m = createModel(seed);
  eq(m.getCount('presort-phase-1'), 2);
  eq(m.getCount('pid-1-2'), 1);
  clearAllCountKeys();
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

// ---------- self-dating JSON export wrapper (#12) ----------
test('JSON export wraps counts with schemaVersion + takenAt', () => {
  const m = freshModel();
  m.setCount('presort-phase-1', 3);
  const obj = JSON.parse(exportJson(m, new Date(2026, 0, 2, 3, 4, 5)));
  eq(obj.schemaVersion, SCHEMA_VERSION, 'stamps the current schema version');
  assert(typeof obj.takenAt === 'string' && !Number.isNaN(Date.parse(obj.takenAt)), 'takenAt is an ISO timestamp');
  assert(Array.isArray(obj.counts), 'counts is an array');
  eq(obj.counts.length, 1);
  eq(obj.counts[0].areaId, 'presort-phase-1');
  eq(obj.counts[0].count, 3);
});
test('JSON export omits zero-count areas', () => {
  const m = freshModel();
  m.setCount('presort-phase-1', 0);
  eq(JSON.parse(exportJson(m)).counts.length, 0);
});
test('wrapped JSON export round-trips through importCounts', () => {
  const m = freshModel();
  m.setCount('presort-phase-1', 4);
  m.setCount('end-of-line-a', 9);
  const { counts, errors } = importCounts(m, exportJson(m), 'json');
  eq(errors.length, 0, 'no import errors');
  eq(counts['presort-phase-1'], 4);
  eq(counts['end-of-line-a'], 9);
});
clearAllCountKeys();

// ---------- operator area search (matchAreas) ----------
const searchAreas = [
  { id: 'a1', name: 'Presort Phase 1', iBeamLocation: 'J12', departmentId: 'd' },
  { id: 'a2', name: 'Presort Phase 2', iBeamLocation: 'J13', departmentId: 'd' },
  { id: 'a3', name: 'End of Line A', iBeamLocation: 'K7', departmentId: 'd' },
  { id: 'a4', name: 'RPN Staging', iBeamLocation: '', departmentId: 'd' },
];
test('matchAreas empty query returns nothing', () => {
  eq(matchAreas(searchAreas, '').length, 0);
  eq(matchAreas(searchAreas, '   ').length, 0);
});
test('matchAreas matches on name (case-insensitive)', () => {
  const ids = matchAreas(searchAreas, 'presort').map((a) => a.id).sort();
  eq(ids.join(','), 'a1,a2');
});
test('matchAreas matches on I-beam location', () => {
  const ids = matchAreas(searchAreas, 'k7').map((a) => a.id);
  eq(ids.join(','), 'a3');
});
test('matchAreas tolerates a missing I-beam', () => {
  const ids = matchAreas(searchAreas, 'rpn').map((a) => a.id);
  eq(ids.join(','), 'a4');
});
test('matchAreas no match returns empty', () => {
  eq(matchAreas(searchAreas, 'zzz').length, 0);
});

// ---------- schema versioning ----------
test('readVersion reads version/schemaVersion, falls back on junk', () => {
  eq(readVersion({ version: 3 }), 3);
  eq(readVersion({ schemaVersion: 2 }), 2);
  eq(readVersion({}, 1), 1);
  eq(readVersion({ version: 0 }, 1), 1);
  eq(readVersion({ version: 'x' }, 1), 1);
});
test('migrate is a no-op at the current baseline', () => {
  const obj = { a: 1 };
  eq(migrate(obj, SCHEMA_VERSION, SCHEMA_VERSION), obj);
});
test('resolveProjectBundle passes through a current-version bundle', () => {
  const b = { version: SCHEMA_VERSION, siteCode: 'X' };
  const { bundle, warning } = resolveProjectBundle(b);
  eq(bundle, b); eq(warning, '');
});
test('resolveProjectBundle treats a pre-versioned bundle as current (no warning)', () => {
  const { warning } = resolveProjectBundle({ siteCode: 'X' }); // no version field
  eq(warning, '');
});
test('resolveProjectBundle warns on a newer bundle and still returns it', () => {
  const b = { version: SCHEMA_VERSION + 1, siteCode: 'X' };
  const { bundle, warning } = resolveProjectBundle(b);
  eq(bundle, b);
  assert(/newer/i.test(warning), 'warns the file is newer');
});
test('validateManifest warns on a too-new schemaVersion', () => {
  const { warnings } = validateManifest({ ...seed, schemaVersion: SCHEMA_VERSION + 1 });
  assert(warnings.some((w) => /newer data format/i.test(w)), 'warns on newer format');
});
test('validateManifest does not warn at the current schemaVersion', () => {
  const { warnings } = validateManifest({ ...seed, schemaVersion: SCHEMA_VERSION });
  assert(!warnings.some((w) => /newer data format/i.test(w)), 'no version warning at baseline');
});

// ---------- undo/redo history stack ----------
test('history: fresh stack cannot undo or redo', () => {
  const h = createHistory();
  h.init('s0');
  assert(!h.canUndo() && !h.canRedo(), 'nothing to undo/redo yet');
  eq(h.undo(), null); eq(h.redo(), null);
});
test('history: commit then undo returns the prior snapshot', () => {
  const h = createHistory();
  h.init('s0');
  h.commit('s1');
  assert(h.canUndo(), 'can undo after a commit');
  eq(h.undo(), 's0');
  assert(h.canRedo(), 'can redo after an undo');
});
test('history: redo re-applies the undone snapshot', () => {
  const h = createHistory();
  h.init('s0'); h.commit('s1'); h.undo();
  eq(h.redo(), 's1');
  assert(!h.canRedo(), 'redo consumed');
});
test('history: a new commit clears the redo future', () => {
  const h = createHistory();
  h.init('s0'); h.commit('s1'); h.undo(); // back at s0, redo has s1
  h.commit('s2');
  assert(!h.canRedo(), 'commit drops the redo branch');
  eq(h.undo(), 's0');
});
test('history: multi-step undo/redo walks the timeline', () => {
  const h = createHistory();
  h.init('s0'); h.commit('s1'); h.commit('s2'); h.commit('s3');
  eq(h.undo(), 's2'); eq(h.undo(), 's1');
  eq(h.redo(), 's2'); eq(h.redo(), 's3');
  assert(!h.canRedo());
});
test('history: limit evicts the oldest undo steps', () => {
  const h = createHistory({ limit: 2 });
  h.init('s0'); h.commit('s1'); h.commit('s2'); h.commit('s3');
  // Only 2 undo steps retained: s2, s1 — s0 fell off.
  eq(h.undo(), 's2'); eq(h.undo(), 's1');
  assert(!h.canUndo(), 'oldest step evicted');
});
test('history: clear empties both stacks', () => {
  const h = createHistory();
  h.init('s0'); h.commit('s1');
  h.clear();
  assert(!h.canUndo() && !h.canRedo(), 'cleared');
});

// ---------- dated export filenames ----------
test('exportFilename appends a zero-padded dated stamp', () => {
  const d = new Date(2026, 6, 31, 9, 5); // 2026-07-31 09:05 local
  eq(exportFilename('poc3-dwelling-counts', 'csv', d), 'poc3-dwelling-counts-2026-07-31_0905.csv');
});
test('exportFilename honors base and extension', () => {
  const d = new Date(2026, 11, 1, 23, 59); // 2026-12-01 23:59 local
  eq(exportFilename('site-x', 'json', d), 'site-x-2026-12-01_2359.json');
});
test('two exports a minute apart get distinct names', () => {
  const a = exportFilename('c', 'csv', new Date(2026, 0, 1, 8, 0));
  const b = exportFilename('c', 'csv', new Date(2026, 0, 1, 8, 1));
  assert(a !== b, 'timestamps differ');
});

// ---------- bulk-select range (rangeSelect) ----------
const order = ['a', 'b', 'c', 'd', 'e'];
test('rangeSelect returns an inclusive forward range', () => {
  eq(rangeSelect(order, 'b', 'd').join(','), 'b,c,d');
});
test('rangeSelect is order-independent (reversed range)', () => {
  eq(rangeSelect(order, 'd', 'b').join(','), 'b,c,d');
});
test('rangeSelect same-id returns the single id', () => {
  eq(rangeSelect(order, 'c', 'c').join(','), 'c');
});
test('rangeSelect full span', () => {
  eq(rangeSelect(order, 'a', 'e').join(','), 'a,b,c,d,e');
});
test('rangeSelect with a missing id falls back to the present one', () => {
  eq(rangeSelect(order, 'a', 'zz').join(','), 'a');
  eq(rangeSelect(order, 'zz', 'e').join(','), 'e');
  eq(rangeSelect(order, 'x', 'y').length, 0);
});

// ---------- group translate clamp (clampGroupDelta) ----------
test('clampGroupDelta passes an in-bounds delta through', () => {
  const boxes = [{ x: 10, y: 10, w: 20, h: 20 }, { x: 40, y: 10, w: 20, h: 20 }];
  const d = clampGroupDelta(boxes, 5, -3, 100, 100);
  eq(d.dx, 5); eq(d.dy, -3);
});
test('clampGroupDelta clamps at the right/bottom edge, keeping one shared delta', () => {
  // group bbox maxX=90, maxY=90 on a 100x100 canvas → only +10 of headroom
  const boxes = [{ x: 10, y: 10, w: 20, h: 20 }, { x: 70, y: 70, w: 20, h: 20 }];
  const d = clampGroupDelta(boxes, 50, 50, 100, 100);
  eq(d.dx, 10); eq(d.dy, 10);
});
test('clampGroupDelta clamps at the left/top edge', () => {
  const boxes = [{ x: 5, y: 8, w: 20, h: 20 }];
  const d = clampGroupDelta(boxes, -50, -50, 100, 100);
  eq(d.dx, -5); eq(d.dy, -8);
});
test('clampGroupDelta on an empty group yields no movement', () => {
  const d = clampGroupDelta([], 5, 5, 100, 100);
  eq(d.dx, 0); eq(d.dy, 0);
});

// ---------- marquee select (normalizeRect / rectHits) ----------
test('normalizeRect describes the same region dragged in any direction', () => {
  const want = 'x10 y20 w30 h40';
  const show = (r) => `x${r.x} y${r.y} w${r.w} h${r.h}`;
  eq(show(normalizeRect(10, 20, 40, 60)), want);  // down-right
  eq(show(normalizeRect(40, 60, 10, 20)), want);  // up-left
  eq(show(normalizeRect(40, 20, 10, 60)), want);  // down-left
  eq(show(normalizeRect(10, 60, 40, 20)), want);  // up-right
});
test('normalizeRect of a click (no travel) is a zero-area rect', () => {
  const r = normalizeRect(15, 25, 15, 25);
  eq(r.x, 15); eq(r.y, 25); eq(r.w, 0); eq(r.h, 0);
});

const boxes = [
  { id: 'a', x: 0, y: 0, w: 20, h: 20 },
  { id: 'b', x: 50, y: 50, w: 20, h: 20 },
  { id: 'c', x: 60, y: 60, w: 100, h: 100 },
];
test('rectHits catches a box the marquee only brushes (intersection, not containment)', () => {
  // Clips a's bottom-right corner, nowhere near enclosing it.
  eq(rectHits(boxes, { x: 15, y: 15, w: 10, h: 10 }).join(','), 'a');
});
test('rectHits catches a box larger than the marquee itself', () => {
  // Entirely inside c — containment-only matching would miss this.
  eq(rectHits(boxes, { x: 100, y: 100, w: 5, h: 5 }).join(','), 'c');
});
test('rectHits returns every overlapped box, in entry order', () => {
  eq(rectHits(boxes, { x: 0, y: 0, w: 200, h: 200 }).join(','), 'a,b,c');
  eq(rectHits(boxes, { x: 55, y: 55, w: 10, h: 10 }).join(','), 'b,c');
});
test('rectHits ignores a marquee that merely touches an edge', () => {
  eq(rectHits(boxes, { x: 20, y: 0, w: 10, h: 20 }).length, 0);
});
test('rectHits finds nothing in a gap, and nothing among no entries', () => {
  eq(rectHits(boxes, { x: 25, y: 25, w: 20, h: 20 }).length, 0);
  eq(rectHits([], { x: 0, y: 0, w: 100, h: 100 }).length, 0);
});
test('a zero-area marquee (plain click) on bare canvas selects nothing', () => {
  // This is what makes "click empty space to deselect" need no special case.
  eq(rectHits(boxes, normalizeRect(35, 35, 35, 35)).length, 0);
});

// ---------- paint order (selected boxes stay grabbable) ----------
const paintIds = ['a', 'b', 'c', 'd'];
test('paintOrder moves the raised id last so it paints on top', () => {
  eq(paintOrder(paintIds, (id) => id === 'b').join(','), 'a,c,d,b');
});
test('paintOrder keeps a box that is already last where it is', () => {
  eq(paintOrder(paintIds, (id) => id === 'd').join(','), 'a,b,c,d');
});
test('paintOrder preserves relative order within both groups', () => {
  // A multi-selection must not have its internal order scrambled — the marquee's
  // "primary is the last hit" rule reads that order.
  eq(paintOrder(paintIds, (id) => id === 'a' || id === 'c').join(','), 'b,d,a,c');
});
test('paintOrder is a no-op when nothing or everything is raised', () => {
  eq(paintOrder(paintIds, () => false).join(','), 'a,b,c,d');
  eq(paintOrder(paintIds, () => true).join(','), 'a,b,c,d');
  eq(paintOrder([], () => true).length, 0);
});
test('paintOrder raises a box above the neighbour it was dragged onto', () => {
  // The D20 regression: 'a' is dragged on top of 'b', which comes later in model
  // order. Painted in model order 'b' covers 'a' and swallows the next press.
  const ids = ['a', 'b'];
  eq(paintOrder(ids, (id) => id === 'a').join(','), 'b,a');
});

// ---------- operator-file generation (Building Area Manager) ----------
test('operator template fill inserts JSON verbatim ($-safe)', () => {
  const tmpl = `head ${SEED_TOKEN} mid ${BG_TOKEN} tail`;
  // Values with regex-replacement metacharacters must survive intact.
  const seedObj = { note: '$& $$ $1 $` end', siteCode: 'X1' };
  const bg = { 'plan.png': 'data:image/png;base64,AAAA' };
  const out = fillOperatorTemplate(tmpl, { seed: seedObj, bgUris: bg });
  assert(out.includes(JSON.stringify(seedObj)), 'seed JSON inserted verbatim');
  assert(out.includes('$& $$ $1 $` end'), 'dollar sequences preserved');
  assert(out.includes('data:image/png;base64,AAAA'), 'background inserted');
  assert(!out.includes(SEED_TOKEN) && !out.includes(BG_TOKEN), 'tokens consumed');
});
test('operator template fill defaults missing bgUris to {}', () => {
  const out = fillOperatorTemplate(`${SEED_TOKEN}|${BG_TOKEN}`, { seed: { a: 1 } });
  eq(out, '{"a":1}|{}');
});

// ---------- render ----------
const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
// Machine-readable signal for the CI runner (tests/run_ci.py) — no scraping.
window.__TEST_RESULT__ = { passed, failed, total: results.length };
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
