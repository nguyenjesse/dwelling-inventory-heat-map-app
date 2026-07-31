// editor.js — Building Area Manager (BAM). Load the seed, draw editable
// rectangles over each floor's background, and manage a site end-to-end: floors
// (add / rename / delete, each with its own image), areas (create / rename /
// delete / duplicate, with Pole + Department), and departments (create / rename,
// each tagged into a flow category). Then generate the site's standalone operator
// heat-map file in the browser — no server or build step — plus save/load the
// whole layout (images included) as a project file.
import { loadSeed, bgSrcFor } from './model.js';
import { download } from './importexport.js';
import { fillOperatorTemplate, readImageDataUrl } from './opbuild.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const $ = (s) => document.querySelector(s);

// slug from a display name; stable machine id, never changes on rename.
function slugify(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'area';
}
function uniqueId(base, existing) {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
// A filesystem-ish code for built filenames (e.g. "MEM 1" -> "MEM-1").
function fileCode(code) {
  return slugify(code).toUpperCase() || 'SITE';
}
// Local build timestamp for a generated operator file: "YYYY-MM-DD HH:MM UTC±H".
// (toISOString is UTC-only, so format the local parts by hand + the offset.)
function buildStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const offMin = -d.getTimezoneOffset(); // minutes east of UTC
  const sign = offMin >= 0 ? '+' : '-';
  const offH = Math.floor(Math.abs(offMin) / 60);
  const offRem = Math.abs(offMin) % 60;
  const off = `UTC${sign}${offH}${offRem ? ':' + p(offRem) : ''}`;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
    + `${p(d.getHours())}:${p(d.getMinutes())} ${off}`;
}
// [{ iBeamLocation, floorId, areaIds }], derived from areas so it never goes
// stale. I-beam locations are scoped per floor, so group by (floorId, pole).
function deriveIbeamMappings(areas) {
  const byKey = new Map();
  for (const a of areas) {
    const p = (a.iBeamLocation || '').trim();
    if (!p) continue;
    const key = `${a.floorId} ${p}`;
    if (!byKey.has(key)) byKey.set(key, { iBeamLocation: p, floorId: a.floorId, areaIds: [] });
    byKey.get(key).areaIds.push(a.id);
  }
  return [...byKey.values()].sort((x, y) =>
    x.floorId.localeCompare(y.floorId) ||
    x.iBeamLocation.localeCompare(y.iBeamLocation, undefined, { numeric: true }));
}

const DEFAULT_CATEGORIES = [
  { id: 'outbound', name: 'Outbound' },
  { id: 'inbound', name: 'Inbound' },
];

(async function main() {
  let seed;
  try { seed = await loadSeed(); }
  catch { $('#editor').innerHTML = '<p class="fatal">Serve the app over HTTP to use the editor.</p>'; return; }

  // Mutable working copies — everything below edits these; build/save serialize them.
  const regions = { ...(seed.regions.regions || seed.regions) };
  let areas = seed.areas.map((a) => ({ ...a }));
  let departments = seed.departments.map((d) => ({ ...d }));
  let floors = seed.floors.map((f) => ({ ...f }));
  let categories = (Array.isArray(seed.categories) && seed.categories.length ? seed.categories : DEFAULT_CATEGORIES)
    .map((c) => ({ ...c }));
  let currentFloorId = (floors[0] || {}).id || null;
  const deptName = (id) => (departments.find((d) => d.id === id) || {}).name || id;

  // Background sources. Freshly loaded images are held as File objects (keyed by
  // floorId) so their bytes can be inlined at build/save time; already-baked or
  // project-loaded images live as data URIs keyed by image filename. objUrlCache
  // holds one object URL per floor for on-screen display.
  const bgFiles = new Map();      // floorId -> File
  const bgUriByName = new Map();  // image filename -> data: URI
  const objUrlCache = new Map();  // floorId -> object URL
  if (typeof BG_IMAGE_DATA_URIS !== 'undefined' && BG_IMAGE_DATA_URIS) {
    for (const [k, v] of Object.entries(BG_IMAGE_DATA_URIS)) bgUriByName.set(k, v);
  }

  const currentFloor = () => floors.find((f) => f.id === currentFloorId) || floors[0] || null;
  const hasFloor = () => !!currentFloor();
  const floorAreas = () => areas.filter((a) => a.floorId === currentFloorId);

  function displaySrc(f) {
    if (!f) return '';
    if (bgFiles.has(f.id)) {
      if (!objUrlCache.has(f.id)) objUrlCache.set(f.id, URL.createObjectURL(bgFiles.get(f.id)));
      return objUrlCache.get(f.id);
    }
    return bgUriByName.get(f.image) || bgSrcFor(f);
  }
  // A background filename unique across floors, so two loaded images never share
  // a key in the operator file's image map. Optionally excludes one floor's own.
  function uniqueImageName(name, exceptFloorId) {
    const used = new Set(floors.filter((f) => f.id !== exceptFloorId).map((f) => f.image).filter(Boolean));
    if (!used.has(name)) return name;
    const dot = name.lastIndexOf('.');
    const base = dot >= 0 ? name.slice(0, dot) : name;
    const ext = dot >= 0 ? name.slice(dot) : '';
    let i = 2;
    while (used.has(`${base}-${i}${ext}`)) i++;
    return `${base}-${i}${ext}`;
  }

  // ---- stage ----
  const stage = document.createElement('div');
  stage.className = 'stage';
  stage.innerHTML = `<img id="edImg" alt="" />
    <svg id="edSvg" preserveAspectRatio="none"></svg>`;
  $('#editor').appendChild(stage);
  const svg = $('#edSvg');
  const edImg = $('#edImg');

  let W = 1808, H = 1125; // current floor's pixel dimensions
  function applyFloorStage() {
    const f = currentFloor();
    $('#edEmpty').hidden = !!f;
    stage.hidden = !f;
    if (!f) { svg.innerHTML = ''; return; }
    W = f.imageWidth; H = f.imageHeight;
    edImg.src = displaySrc(f);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  }

  let activeId = null;
  const rectEls = new Map();

  function drawAll() {
    svg.innerHTML = '';
    rectEls.clear();
    for (const a of floorAreas()) {
      const g = regions[a.id];
      if (!g) continue;
      const r = document.createElementNS(SVGNS, 'rect');
      r.setAttribute('class', 'ed-area' + (a.id === activeId ? ' active' : ''));
      r.setAttribute('x', g.x); r.setAttribute('y', g.y);
      r.setAttribute('width', g.w); r.setAttribute('height', g.h);
      r.dataset.id = a.id;
      svg.appendChild(r);
      rectEls.set(a.id, r);
    }
    if (activeId && regions[activeId]) drawHandles(activeId);
  }

  function drawHandles(id) {
    const g = regions[id];
    // Skip the resize handles when locked — nothing should be grabbable.
    if (!locked) {
      const corners = [['nw', g.x, g.y], ['ne', g.x + g.w, g.y], ['sw', g.x, g.y + g.h], ['se', g.x + g.w, g.y + g.h]];
      const s = Math.max(6, W / 160);
      for (const [pos, cx, cy] of corners) {
        const h = document.createElementNS(SVGNS, 'rect');
        h.setAttribute('class', 'ed-handle');
        h.setAttribute('x', cx - s / 2); h.setAttribute('y', cy - s / 2);
        h.setAttribute('width', s); h.setAttribute('height', s);
        h.dataset.handle = pos; h.dataset.id = id;
        svg.appendChild(h);
      }
    }
    const label = document.createElementNS(SVGNS, 'text');
    label.setAttribute('class', 'ed-label');
    label.setAttribute('x', g.x + 3); label.setAttribute('y', g.y - 4);
    label.textContent = (areas.find((a) => a.id === id) || {}).name || id;
    svg.appendChild(label);
  }

  // ---- coordinate mapping (screen px -> viewBox units) ----
  function toUnits(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width * W,
      y: (clientY - rect.top) / rect.height * H,
    };
  }

  // ---- interaction ----
  let drag = null; // {mode:'move'|handle, id, start:{x,y}, orig:{...}}
  let locked = true; // in-memory; boots locked to prevent accidental drags
  svg.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.ed-handle');
    const area = e.target.closest('.ed-area');
    // When locked, still select on click but never arm a drag/resize.
    if (locked) {
      if (handle) setActive(handle.dataset.id);
      else if (area) setActive(area.dataset.id);
      return;
    }
    if (handle) {
      setActive(handle.dataset.id);
      drag = { mode: handle.dataset.handle, id: handle.dataset.id, start: toUnits(e.clientX, e.clientY), orig: { ...regions[handle.dataset.id] } };
    } else if (area) {
      setActive(area.dataset.id);
      drag = { mode: 'move', id: area.dataset.id, start: toUnits(e.clientX, e.clientY), orig: { ...regions[area.dataset.id] } };
    } else { return; }
    svg.setPointerCapture(e.pointerId);
  });

  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toUnits(e.clientX, e.clientY);
    const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    const o = drag.orig;
    let g = { ...regions[drag.id] };
    if (drag.mode === 'move') { g.x = o.x + dx; g.y = o.y + dy; }
    else {
      let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h;
      if (drag.mode.includes('w')) x0 = o.x + dx;
      if (drag.mode.includes('e')) x1 = o.x + o.w + dx;
      if (drag.mode.includes('n')) y0 = o.y + dy;
      if (drag.mode.includes('s')) y1 = o.y + o.h + dy;
      g = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
    }
    regions[drag.id] = round(clampBox(g));
    updateActiveRect();
  });
  const end = () => { if (drag) { drag = null; drawAll(); syncFields(); } };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);

  function clampBox(g) {
    g.w = Math.max(4, g.w); g.h = Math.max(4, g.h);
    g.x = Math.max(0, Math.min(W - g.w, g.x));
    g.y = Math.max(0, Math.min(H - g.h, g.y));
    return g;
  }
  function round(g) { return { x: +g.x.toFixed(1), y: +g.y.toFixed(1), w: +g.w.toFixed(1), h: +g.h.toFixed(1) }; }

  function updateActiveRect() {
    const g = regions[activeId];
    const r = rectEls.get(activeId);
    if (r && g) { r.setAttribute('x', g.x); r.setAttribute('y', g.y); r.setAttribute('width', g.w); r.setAttribute('height', g.h); }
    svg.querySelectorAll('.ed-handle, .ed-label').forEach((n) => n.remove());
    if (activeId) drawHandles(activeId);
    syncFields();
  }

  // ---- sidebar list ----
  const list = $('#areaList');
  function renderList(filter = '') {
    const f = filter.trim().toLowerCase();
    list.innerHTML = '';
    for (const a of floorAreas()) {
      if (f && !a.name.toLowerCase().includes(f) && !(a.iBeamLocation || '').toLowerCase().includes(f)) continue;
      const li = document.createElement('li');
      li.dataset.id = a.id;
      if (a.id === activeId) li.classList.add('active');
      li.innerHTML = `<span>${a.name}</span>` +
        (regions[a.id] ? `<span class="dept">${deptName(a.departmentId)}</span>` : '<span class="missing">no region</span>');
      li.addEventListener('click', () => setActive(a.id, true));
      list.appendChild(li);
    }
  }
  $('#areaSearch').addEventListener('input', (e) => renderList(e.target.value));

  function setActive(id, _scrollMap = false) {
    activeId = id;
    if (id && !regions[id]) regions[id] = { x: W / 2 - 40, y: H / 2 - 20, w: 80, h: 40 }; // seed a default box
    drawAll();
    renderList($('#areaSearch').value);
    syncFields();
    syncAttrs();
    $('#selName').textContent = (areas.find((a) => a.id === id) || {}).name || 'No area selected';
  }

  // ---- numeric x/y/w/h fields ----
  const fx = $('#fx'), fy = $('#fy'), fw = $('#fw'), fh = $('#fh');
  function syncFields() {
    const g = regions[activeId];
    if (!g) { [fx, fy, fw, fh].forEach((el) => (el.value = '')); return; }
    fx.value = g.x; fy.value = g.y; fw.value = g.w; fh.value = g.h;
  }
  [fx, fy, fw, fh].forEach((el) => el.addEventListener('input', () => {
    if (!activeId) return;
    regions[activeId] = round(clampBox({ x: +fx.value || 0, y: +fy.value || 0, w: +fw.value || 4, h: +fh.value || 4 }));
    updateActiveRect();
  }));

  // ---- region lock toggle (in-memory; boots locked) ----
  const lockToggle = $('#lockRegions');
  function applyLock() {
    locked = lockToggle.checked;
    svg.classList.toggle('locked', locked);
    drawAll(); // re-render so resize handles appear/disappear
  }
  lockToggle.addEventListener('change', applyLock);
  svg.classList.toggle('locked', locked); // reflect initial state

  // ---- floor selector + management ----
  const floorSelect = $('#floorSelect');
  function fillFloorSelect() {
    if (!floors.length) { floorSelect.innerHTML = '<option value="">(no floors)</option>'; return; }
    floorSelect.innerHTML = floors.map((f) =>
      `<option value="${f.id}"${f.id === currentFloorId ? ' selected' : ''}>${f.name}</option>`).join('');
  }
  function switchFloor(fid) {
    currentFloorId = fid;
    activeId = null;
    applyFloorStage();
    drawAll();
    renderList($('#areaSearch').value);
    syncFields();
    syncAttrs();
    $('#selName').textContent = 'No area selected';
    fillFloorSelect();
    updateControls();
  }
  floorSelect.addEventListener('change', () => switchFloor(floorSelect.value));

  // Prompt for a local image and report its natural dimensions.
  function pickImage(cb) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.addEventListener('change', () => {
      const file = inp.files[0];
      if (!file) return;
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); cb(file, img.naturalWidth, img.naturalHeight); };
      img.src = url;
    });
    inp.click();
  }

  $('#addFloor').addEventListener('click', () => {
    const name = (prompt('New floor name:') || '').trim();
    if (!name) return;
    status('Pick a background image for the new floor…');
    pickImage((file, natW, natH) => {
      const id = uniqueId('floor-' + slugify(name), new Set(floors.map((f) => f.id)));
      const image = uniqueImageName(file.name);
      floors.push({ id, name, image, imageWidth: natW, imageHeight: natH });
      bgFiles.set(id, file);
      switchFloor(id);
      status(`Added floor "${name}" (${natW}×${natH}). Create areas and place their boxes; the image is baked into the operator file you build.`);
    });
  });

  $('#renameFloor').addEventListener('click', () => {
    const f = currentFloor();
    if (!f) { status('No floor to rename — add one first.'); return; }
    const name = (prompt('Rename floor:', f.name) || '').trim();
    if (!name) return;
    f.name = name;
    fillFloorSelect();
    status(`Renamed floor to "${name}".`);
  });

  $('#delFloor').addEventListener('click', () => {
    const f = currentFloor();
    if (!f) { status('No floor to delete.'); return; }
    if (floors.length <= 1) {
      // Allow clearing the last floor back to the empty state.
      if (!confirm(`Delete the only floor "${f.name}"? The site will have no floors.`)) return;
    } else if (!confirm(`Delete floor "${f.name}"?`)) return;
    const owned = areas.filter((a) => a.floorId === f.id);
    if (owned.length) {
      status(`Floor "${f.name}" still has ${owned.length} area${owned.length === 1 ? '' : 's'} — delete or reassign them first.`);
      return;
    }
    floors = floors.filter((x) => x.id !== f.id);
    bgFiles.delete(f.id);
    if (objUrlCache.has(f.id)) { URL.revokeObjectURL(objUrlCache.get(f.id)); objUrlCache.delete(f.id); }
    switchFloor((floors[0] || {}).id || null);
    status(`Deleted floor "${f.name}".`);
  });

  // ---- area attribute panel (name / pole / department / category) ----
  const aName = $('#aName'), aPole = $('#aPole'), aDept = $('#aDept'), aCat = $('#aCat'), poleList = $('#poleList');
  const btnDup = $('#dupArea'), btnDel = $('#delArea'), btnDeptAdd = $('#deptAdd'), btnDeptRename = $('#deptRename');

  function fillDeptOptions(selectedId) {
    aDept.innerHTML = departments.map((d) =>
      `<option value="${d.id}"${d.id === selectedId ? ' selected' : ''}>${d.name}</option>`).join('');
  }
  function fillCatOptions(selectedId) {
    aCat.innerHTML = categories.map((c) =>
      `<option value="${c.id}"${c.id === selectedId ? ' selected' : ''}>${c.name}</option>`).join('');
  }
  function fillPoleList() {
    // I-beam locations are per floor; suggest only the current floor's poles.
    const poles = [...new Set(floorAreas().map((a) => (a.iBeamLocation || '').trim()).filter(Boolean))]
      .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
    poleList.innerHTML = poles.map((p) => `<option value="${p}"></option>`).join('');
  }
  function syncAttrs() {
    const a = areas.find((x) => x.id === activeId);
    const on = !!a;
    [aName, aPole, aDept, btnDup, btnDel, btnDeptRename].forEach((el) => (el.disabled = !on));
    aCat.disabled = !on;
    fillPoleList();
    if (!a) { aName.value = ''; aPole.value = ''; aDept.innerHTML = ''; aCat.innerHTML = ''; return; }
    aName.value = a.name;
    aPole.value = a.iBeamLocation || '';
    fillDeptOptions(a.departmentId);
    const dept = departments.find((d) => d.id === a.departmentId);
    fillCatOptions(dept ? dept.categoryId : (categories[0] || {}).id);
  }

  aName.addEventListener('input', () => {
    const a = areas.find((x) => x.id === activeId); if (!a) return;
    a.name = aName.value;
    $('#selName').textContent = a.name || 'No area selected';
    // update label + active list row without a full redraw
    const label = svg.querySelector('.ed-label'); if (label) label.textContent = a.name || a.id;
    const li = list.querySelector('li.active span'); if (li) li.textContent = a.name;
  });
  aPole.addEventListener('input', () => {
    const a = areas.find((x) => x.id === activeId); if (!a) return;
    a.iBeamLocation = aPole.value.trim();
  });
  aDept.addEventListener('change', () => {
    const a = areas.find((x) => x.id === activeId); if (!a) return;
    a.departmentId = aDept.value;
    const dept = departments.find((d) => d.id === a.departmentId);
    fillCatOptions(dept ? dept.categoryId : (categories[0] || {}).id);
    renderList($('#areaSearch').value);
  });
  // The category belongs to the department; changing it here retags the whole
  // department (all its areas), matching how the operator app groups them.
  aCat.addEventListener('change', () => {
    const a = areas.find((x) => x.id === activeId); if (!a) return;
    const dept = departments.find((d) => d.id === a.departmentId);
    if (!dept) return;
    dept.categoryId = aCat.value;
    status(`Department "${dept.name}" set to ${(categories.find((c) => c.id === aCat.value) || {}).name || aCat.value}.`);
  });

  // ---- department create / rename ----
  btnDeptAdd.addEventListener('click', () => {
    const name = (prompt('New department name:') || '').trim();
    if (!name) return;
    const id = uniqueId(slugify(name), new Set(departments.map((d) => d.id)));
    // Default the new department's flow category to the one currently shown (or
    // the first category); the user can retag it via the Flow category selector.
    const categoryId = (aCat.value || (categories[0] || {}).id || 'outbound');
    departments.push({ id, name, categoryId });
    const a = areas.find((x) => x.id === activeId);
    if (a) a.departmentId = id;
    fillDeptOptions(a ? a.departmentId : id);
    fillCatOptions(categoryId);
    renderList($('#areaSearch').value);
    status(`Added department "${name}" (${(categories.find((c) => c.id === categoryId) || {}).name || categoryId}).`);
  });
  btnDeptRename.addEventListener('click', () => {
    const d = departments.find((x) => x.id === aDept.value);
    if (!d) return;
    const name = (prompt('Rename department:', d.name) || '').trim();
    if (!name) return;
    d.name = name;
    fillDeptOptions(d.id);
    renderList($('#areaSearch').value);
    status(`Renamed department to "${name}".`);
  });

  // ---- new / duplicate / delete area ----
  function nextName(base) {
    const taken = new Set(areas.map((a) => a.name));
    if (!taken.has(base)) return base;
    let i = 2; while (taken.has(`${base} ${i}`)) i++;
    return `${base} ${i}`;
  }
  $('#newArea').addEventListener('click', () => {
    if (!hasFloor()) { status('Add a floor first — click ＋ next to Floor.'); return; }
    const name = nextName('New area');
    const id = uniqueId(slugify(name), new Set(areas.map((a) => a.id)));
    areas.push({ id, name, departmentId: (departments[0] || {}).id || '', iBeamLocation: '', mapRegionId: id, floorId: currentFloorId });
    setActive(id);                 // seeds a default centered box
    updateControls();
    aName.focus(); aName.select();
    status(`Created "${name}" on this floor — name it, set Pole + Department, then place its box.`);
  });
  btnDup.addEventListener('click', () => {
    const src = areas.find((x) => x.id === activeId);
    const g = regions[activeId];
    if (!src || !g) return;
    const name = nextName(`Copy of ${src.name}`);
    const id = uniqueId(slugify(name), new Set(areas.map((a) => a.id)));
    areas.push({ id, name, departmentId: src.departmentId, iBeamLocation: src.iBeamLocation, mapRegionId: id, floorId: src.floorId });
    // identical size (w/h), nudged position so it's visible and not exactly overlapping
    regions[id] = round(clampBox({ x: g.x + 12, y: g.y + 12, w: g.w, h: g.h }));
    setActive(id);
    status(`Duplicated "${src.name}" (same size ${g.w}×${g.h}).`);
  });
  btnDel.addEventListener('click', () => {
    const a = areas.find((x) => x.id === activeId);
    if (!a) return;
    if (!confirm(`Delete area "${a.name}"? This removes it and its region box.`)) return;
    areas = areas.filter((x) => x.id !== activeId);
    delete regions[activeId];
    activeId = null;
    drawAll(); renderList($('#areaSearch').value); syncFields(); syncAttrs();
    updateControls();
    $('#selName').textContent = 'No area selected';
    status(`Deleted "${a.name}".`);
  });

  // ---- keyboard nudge (skips when typing in a field, or when locked) ----
  document.addEventListener('keydown', (e) => {
    if (locked) return; // lock also freezes arrow-key nudging; use the x/y/w/h fields instead
    if (!activeId || !regions[activeId]) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    const step = e.shiftKey ? 0 : (e.altKey ? 1 : 4);
    const rstep = e.shiftKey ? (e.altKey ? 1 : 4) : 0;
    let g = { ...regions[activeId] };
    if (e.key === 'ArrowLeft') { g.x -= step; g.w -= rstep; }
    else if (e.key === 'ArrowRight') { g.x += step; g.w += rstep; }
    else if (e.key === 'ArrowUp') { g.y -= step; g.h -= rstep; }
    else if (e.key === 'ArrowDown') { g.y += step; g.h += rstep; }
    else return;
    e.preventDefault();
    regions[activeId] = round(clampBox(g));
    drawAll(); syncFields();
  });

  // ---- background swap for the current floor ----
  $('#bgFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const f = currentFloor();
    if (!f) { status('Add a floor first, then load its background.'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      f.image = uniqueImageName(file.name, f.id);   // export references this filename
      bgFiles.set(f.id, file);
      if (objUrlCache.has(f.id)) { URL.revokeObjectURL(objUrlCache.get(f.id)); objUrlCache.delete(f.id); }
      edImg.src = displaySrc(f);
      status(`Floor "${f.name}" background set (${img.naturalWidth}×${img.naturalHeight}). ` +
        (img.naturalWidth === W && img.naturalHeight === H
          ? 'Matches the region grid.'
          : `Region grid stays ${W}×${H}.`));
    };
    img.src = url;
  });

  // ---- site code ----
  const siteInput = $('#siteCode');
  siteInput.value = seed.siteCode || '';
  siteInput.addEventListener('input', updateControls);

  // ---- collect background data URIs for build/save (async) ----
  // Fresh loads come from their File bytes (down-scaled if huge); already-baked or
  // project-loaded images come from the data-URI cache. Throws if a floor has no
  // image available at all.
  async function collectBgUris() {
    const out = {};
    for (const f of floors) {
      const name = f.image;
      if (!name || out[name]) continue;
      if (bgFiles.has(f.id)) {
        const { dataUri } = await readImageDataUrl(bgFiles.get(f.id));
        out[name] = dataUri;
        bgUriByName.set(name, dataUri);
      } else if (bgUriByName.has(name)) {
        out[name] = bgUriByName.get(name);
      } else {
        throw new Error(`floor "${f.name}" has no background image loaded`);
      }
    }
    return out;
  }

  function assembleSeed(code) {
    return {
      siteCode: code,
      siteName: code,
      builtAt: buildStamp(), // local time this operator file was generated
      floors: floors.map((f) => ({ ...f })),
      areas: areas.map((a) => ({ ...a })),
      departments: departments.map((d) => ({ ...d })),
      categories: categories.map((c) => ({ ...c })),
      regions: { regions },
      ibeamMappings: deriveIbeamMappings(areas),
    };
  }

  // ---- build the site's operator heat-map file ----
  $('#buildOperator').addEventListener('click', async () => {
    if (typeof OPERATOR_TEMPLATE === 'undefined' || !OPERATOR_TEMPLATE) {
      status('This build of the editor can’t generate operator files — use the packaged Building Area Manager.'); return;
    }
    const code = siteInput.value.trim();
    if (!code) { status('Enter a Site code first.'); siteInput.focus(); return; }
    if (!floors.length) { status('Add at least one floor before building.'); return; }
    if (!areas.length) { status('Add at least one area before building.'); return; }
    status('Building operator file…');
    let bgUris;
    try { bgUris = await collectBgUris(); }
    catch (err) { status('Cannot build: ' + err.message + '.'); return; }
    const html = fillOperatorTemplate(OPERATOR_TEMPLATE, { seed: assembleSeed(code), bgUris });
    const fname = `${fileCode(code)}-Dwelling-Inventory-Map.html`;
    download(fname, html, 'text/html');
    const mb = (new Blob([html]).size / (1024 * 1024)).toFixed(1);
    status(`Built ${fname} (${mb} MB) — hand this one file to ${code} associates (double-click, offline).`);
  });

  // ---- save / load the whole project (layout + images) ----
  $('#saveProject').addEventListener('click', async () => {
    const code = siteInput.value.trim() || 'site';
    status('Reading images to save…');
    let bgImageDataUris;
    try { bgImageDataUris = await collectBgUris(); }
    catch (err) { status('Cannot save: ' + err.message + '.'); return; }
    const bundle = {
      version: 1,
      siteCode: code,
      floors, areas, departments, categories,
      regions: { regions },
      ibeamMappings: deriveIbeamMappings(areas),
      bgImageDataUris,
    };
    download(`${fileCode(code)}-bam-project.json`, JSON.stringify(bundle), 'application/json');
    status('Saved project — reload it any time with “Load project”.');
  });

  $('#loadProject').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let b;
      try { b = JSON.parse(reader.result); }
      catch { status('That file isn’t a valid project (.json).'); return; }
      applyBundle(b);
      status(`Loaded project “${b.siteCode || ''}”. Review, then Build operator file.`);
    };
    reader.readAsText(file);
  });

  function applyBundle(b) {
    floors = (b.floors || []).map((f) => ({ ...f }));
    areas = (b.areas || []).map((a) => ({ ...a }));
    departments = (b.departments || []).map((d) => ({ ...d }));
    categories = (Array.isArray(b.categories) && b.categories.length ? b.categories : DEFAULT_CATEGORIES).map((c) => ({ ...c }));
    const rmap = (b.regions && (b.regions.regions || b.regions)) || {};
    for (const k of Object.keys(regions)) delete regions[k];
    Object.assign(regions, rmap);
    bgFiles.clear();
    objUrlCache.forEach((u) => URL.revokeObjectURL(u)); objUrlCache.clear();
    if (b.bgImageDataUris) for (const [k, v] of Object.entries(b.bgImageDataUris)) bgUriByName.set(k, v);
    siteInput.value = b.siteCode || '';
    currentFloorId = (floors[0] || {}).id || null;
    activeId = null;
    refreshAll();
  }

  // ---- new (empty) site ----
  $('#newSite').addEventListener('click', () => {
    if (!confirm('Start a new, empty site? This clears the areas, departments and floors in the editor. Saved project files and already-built operator files are not affected.')) return;
    floors = []; areas = []; departments = [];
    categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
    for (const k of Object.keys(regions)) delete regions[k];
    bgFiles.clear();
    objUrlCache.forEach((u) => URL.revokeObjectURL(u)); objUrlCache.clear();
    currentFloorId = null; activeId = null;
    siteInput.value = '';
    refreshAll();
    siteInput.focus();
    status('New site — enter a Site code, then add your first floor (＋ next to Floor).');
  });

  function status(msg) { $('#editorStatus').textContent = msg; }

  // Enable/disable controls that need a floor or areas.
  function updateControls() {
    const floored = hasFloor();
    $('#newArea').disabled = !floored;
    $('#buildOperator').disabled = !(floored && areas.length > 0 && siteInput.value.trim());
    $('#saveProject').disabled = !floored;
  }

  function refreshAll() {
    applyFloorStage();
    fillFloorSelect();
    renderList();
    drawAll();
    syncFields();
    syncAttrs();
    updateControls();
    $('#selName').textContent = 'No area selected';
  }

  // init
  refreshAll();
})();
