// editor.js — region + area editor. Load the seed, draw editable rectangles over
// the floor plan, and manage areas end-to-end: create / rename / delete /
// duplicate, and assign each area's Pole (I-beam) and Department (with
// department create/rename). Exports a single data bundle to drop back into the
// project.
import { loadSeed } from './model.js';
import { download } from './importexport.js';

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
// { iBeamLocation -> areaIds[] }, derived from areas so it never goes stale.
function deriveIbeamMappings(areas) {
  const byPole = new Map();
  for (const a of areas) {
    const p = (a.iBeamLocation || '').trim();
    if (!p) continue;
    if (!byPole.has(p)) byPole.set(p, []);
    byPole.get(p).push(a.id);
  }
  return [...byPole.entries()]
    .sort((x, y) => x[0].localeCompare(y[0], undefined, { numeric: true }))
    .map(([iBeamLocation, areaIds]) => ({ iBeamLocation, areaIds }));
}

(async function main() {
  let seed;
  try { seed = await loadSeed(); }
  catch { $('#editor').innerHTML = '<p class="fatal">Serve the app over HTTP to use the editor.</p>'; return; }

  const meta = seed.regions.meta || { imageWidth: 1808, imageHeight: 1125 };
  // Mutable working copies — everything below edits these, export serializes them.
  const regions = { ...(seed.regions.regions || seed.regions) };
  let areas = seed.areas.map((a) => ({ ...a }));
  let departments = seed.departments.map((d) => ({ ...d }));
  const deptName = (id) => (departments.find((d) => d.id === id) || {}).name || id;

  // ---- stage ----
  // Standalone build injects the background as a data: URI (BG_IMAGE_DATA_URI);
  // served build falls back to the file in assets/.
  const bgSrc = (typeof BG_IMAGE_DATA_URI !== 'undefined' && BG_IMAGE_DATA_URI)
    ? BG_IMAGE_DATA_URI
    : './assets/' + (meta.image || 'floor-plan.png');
  const stage = document.createElement('div');
  stage.className = 'stage';
  stage.innerHTML = `<img id="edImg" src="${bgSrc}" alt="" />
    <svg id="edSvg" viewBox="0 0 ${meta.imageWidth} ${meta.imageHeight}" preserveAspectRatio="none"></svg>`;
  $('#editor').appendChild(stage);
  const svg = $('#edSvg');
  const W = meta.imageWidth, H = meta.imageHeight;

  let activeId = null;
  const rectEls = new Map();

  function drawAll() {
    svg.innerHTML = '';
    rectEls.clear();
    for (const a of areas) {
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
    for (const a of areas) {
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

  // ---- area attribute panel (name / pole / department) ----
  const aName = $('#aName'), aPole = $('#aPole'), aDept = $('#aDept'), poleList = $('#poleList');
  const btnDup = $('#dupArea'), btnDel = $('#delArea'), btnDeptAdd = $('#deptAdd'), btnDeptRename = $('#deptRename');

  function fillDeptOptions(selectedId) {
    aDept.innerHTML = departments.map((d) =>
      `<option value="${d.id}"${d.id === selectedId ? ' selected' : ''}>${d.name}</option>`).join('');
  }
  function fillPoleList() {
    const poles = [...new Set(areas.map((a) => (a.iBeamLocation || '').trim()).filter(Boolean))]
      .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
    poleList.innerHTML = poles.map((p) => `<option value="${p}"></option>`).join('');
  }
  function syncAttrs() {
    const a = areas.find((x) => x.id === activeId);
    const on = !!a;
    [aName, aPole, aDept, btnDup, btnDel, btnDeptRename].forEach((el) => (el.disabled = !on));
    fillPoleList();
    if (!a) { aName.value = ''; aPole.value = ''; aDept.innerHTML = ''; return; }
    aName.value = a.name;
    aPole.value = a.iBeamLocation || '';
    fillDeptOptions(a.departmentId);
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
    renderList($('#areaSearch').value);
  });

  // ---- department create / rename ----
  btnDeptAdd.addEventListener('click', () => {
    const name = (prompt('New department name:') || '').trim();
    if (!name) return;
    const id = uniqueId(slugify(name), new Set(departments.map((d) => d.id)));
    departments.push({ id, name });
    const a = areas.find((x) => x.id === activeId);
    if (a) a.departmentId = id;
    fillDeptOptions(a ? a.departmentId : id);
    renderList($('#areaSearch').value);
    status(`Added department "${name}".`);
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
    const name = nextName('New area');
    const id = uniqueId(slugify(name), new Set(areas.map((a) => a.id)));
    areas.push({ id, name, departmentId: (departments[0] || {}).id || '', iBeamLocation: '', mapRegionId: id });
    setActive(id);                 // seeds a default centered box
    aName.focus(); aName.select();
    status(`Created "${name}" — name it, set Pole + Department, then place its box.`);
  });
  btnDup.addEventListener('click', () => {
    const src = areas.find((x) => x.id === activeId);
    const g = regions[activeId];
    if (!src || !g) return;
    const name = nextName(`Copy of ${src.name}`);
    const id = uniqueId(slugify(name), new Set(areas.map((a) => a.id)));
    areas.push({ id, name, departmentId: src.departmentId, iBeamLocation: src.iBeamLocation, mapRegionId: id });
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

  // ---- background swap ----
  $('#bgFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      $('#edImg').src = url;
      status(`Background: ${file.name} (${img.naturalWidth}×${img.naturalHeight}). ` +
        (img.naturalWidth === W && img.naturalHeight === H
          ? 'Matches region grid — good.'
          : `Region grid is ${W}×${H}; export keeps that grid.`));
    };
    img.src = url;
  });

  // ---- export the full data bundle ----
  function status(msg) { $('#editorStatus').textContent = msg; }
  $('#exportData').addEventListener('click', () => {
    const bundle = {
      areas,
      departments,
      regions: { meta, regions },
      ibeamMappings: deriveIbeamMappings(areas),
    };
    download('poc3-map-data.json', JSON.stringify(bundle, null, 2), 'application/json');
    status('Exported poc3-map-data.json — send it back to apply (it rebuilds areas, departments & regions).');
  });

  // init
  renderList();
  drawAll();
  syncAttrs();
})();
