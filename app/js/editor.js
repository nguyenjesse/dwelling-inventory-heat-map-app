// editor.js — region editor. Load the seed areas + regions, draw editable
// rectangles over the floor plan, drag/resize/nudge them, and export regions.json.
import { loadSeed } from './model.js';
import { download } from './importexport.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const $ = (s) => document.querySelector(s);

(async function main() {
  let seed;
  try { seed = await loadSeed(); }
  catch { $('#editor').innerHTML = '<p class="fatal">Serve the app over HTTP to use the editor.</p>'; return; }

  const meta = seed.regions.meta || { imageWidth: 1808, imageHeight: 1125 };
  const regions = { ...(seed.regions.regions || seed.regions) };
  const areas = seed.areas;
  const deptName = (id) => (seed.departments.find((d) => d.id === id) || {}).name || id;

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
    const label = document.createElementNS(SVGNS, 'text');
    label.setAttribute('class', 'ed-label');
    label.setAttribute('x', g.x + 3); label.setAttribute('y', g.y - 4);
    label.textContent = (seed.areas.find((a) => a.id === id) || {}).name || id;
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
  svg.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.ed-handle');
    const area = e.target.closest('.ed-area');
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
  const end = (e) => { if (drag) { drag = null; drawAll(); syncFields(); } };
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
    // redraw handles cheaply
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
      if (f && !a.name.toLowerCase().includes(f) && !a.iBeamLocation.toLowerCase().includes(f)) continue;
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

  function setActive(id, scrollMap = false) {
    activeId = id;
    if (!regions[id]) regions[id] = { x: W / 2 - 40, y: H / 2 - 20, w: 80, h: 40 }; // seed a default box
    drawAll();
    renderList($('#areaSearch').value);
    syncFields();
    $('#selName').textContent = (areas.find((a) => a.id === id) || {}).name || id;
  }

  // ---- numeric fields ----
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

  // ---- keyboard nudge ----
  document.addEventListener('keydown', (e) => {
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
      $('#editorStatus').textContent =
        `Background: ${file.name} (${img.naturalWidth}×${img.naturalHeight}). ` +
        (img.naturalWidth === W && img.naturalHeight === H
          ? 'Matches region grid — good.'
          : `Region grid is ${W}×${H}; export keeps that grid.`);
    };
    img.src = url;
  });

  // ---- export ----
  $('#exportRegions').addEventListener('click', () => {
    const out = { meta, regions };
    download('regions.json', JSON.stringify(out, null, 2), 'application/json');
    $('#editorStatus').textContent = 'Exported regions.json — drop it into app/data/ to apply.';
  });

  // init
  renderList();
  drawAll();
})();
