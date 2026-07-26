// map.js — interactive SVG map overlay: heat fills, selection/zone outlines,
// hover tooltip, keyboard support, and zoom/pan.

const SVGNS = 'http://www.w3.org/2000/svg';

export function createMapView(root, model, { onSelect } = {}) {
  const meta = model.regions.meta || { imageWidth: 1808, imageHeight: 1125 };
  const regions = model.regions.regions || model.regions;

  root.innerHTML = `
    <div class="map-toolbar">
      <button type="button" data-act="zoom-in" title="Zoom in" aria-label="Zoom in">+</button>
      <button type="button" data-act="zoom-out" title="Zoom out" aria-label="Zoom out">&minus;</button>
      <button type="button" data-act="fit" title="Fit to screen">Fit</button>
      <label class="map-toggle"><input type="checkbox" data-act="toggle-plan" checked> Floor plan</label>
    </div>
    <div class="map-viewport" tabindex="0">
      <div class="map-pan">
        <img class="floor-plan" src="./assets/floor-plan.png" alt="Warehouse floor plan" draggable="false" />
        <svg class="map-overlay" viewBox="0 0 ${meta.imageWidth} ${meta.imageHeight}" preserveAspectRatio="xMidYMid meet"></svg>
      </div>
    </div>
    <div class="map-tooltip" hidden></div>`;

  const viewport = root.querySelector('.map-viewport');
  const pan = root.querySelector('.map-pan');
  const svg = root.querySelector('.map-overlay');
  const img = root.querySelector('.floor-plan');
  const tooltip = root.querySelector('.map-tooltip');

  // --- build one <rect> per area ---
  const rectByArea = new Map();
  for (const area of model.seed.areas) {
    const g = regions[area.mapRegionId || area.id];
    if (!g) continue;
    const rect = document.createElementNS(SVGNS, 'rect');
    rect.setAttribute('x', g.x); rect.setAttribute('y', g.y);
    rect.setAttribute('width', Math.max(1, g.w)); rect.setAttribute('height', Math.max(1, g.h));
    rect.setAttribute('rx', 2);
    rect.classList.add('area');
    rect.dataset.areaId = area.id;
    rect.setAttribute('tabindex', '0');
    rect.setAttribute('role', 'button');
    rect.setAttribute('aria-label', area.name);
    svg.appendChild(rect);
    rectByArea.set(area.id, rect);
  }

  let counts = {};

  // --- selection ---
  function select(areaId) { if (onSelect) onSelect(areaId); }

  svg.addEventListener('click', (e) => {
    const r = e.target.closest('.area');
    if (r) select(r.dataset.areaId);
  });
  svg.addEventListener('keydown', (e) => {
    const r = e.target.closest('.area');
    if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(r.dataset.areaId); }
  });

  // --- hover tooltip ---
  svg.addEventListener('mousemove', (e) => {
    const r = e.target.closest('.area');
    if (!r) { tooltip.hidden = true; return; }
    const area = model.getArea(r.dataset.areaId);
    const c = counts[area.id] || 0;
    tooltip.innerHTML = `<strong>${area.name}</strong><br>${model.getDept(area.departmentId).name} · ${area.iBeamLocation}<br>${c} pallet${c === 1 ? '' : 's'}`;
    tooltip.hidden = false;
    const rootRect = root.getBoundingClientRect();
    let x = e.clientX - rootRect.left + 14;
    let y = e.clientY - rootRect.top + 14;
    if (x + tooltip.offsetWidth > rootRect.width) x = e.clientX - rootRect.left - tooltip.offsetWidth - 14;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  });
  svg.addEventListener('mouseleave', () => { tooltip.hidden = true; });

  // --- heat colors ---
  function setColors(colorMap, countsByArea) {
    counts = countsByArea || {};
    for (const [areaId, rect] of rectByArea) {
      rect.style.fill = colorMap[areaId] || '#808080';
    }
  }

  // --- selection outlines ---
  function setSelection(selectedId, zoneIds) {
    const zone = new Set(zoneIds || []);
    for (const [areaId, rect] of rectByArea) {
      rect.classList.toggle('is-selected', areaId === selectedId);
      rect.classList.toggle('is-zone', areaId !== selectedId && zone.has(areaId));
    }
  }
  function clearSelection() { setSelection(null, []); }

  // --- floor plan visibility toggle ---
  root.querySelector('[data-act="toggle-plan"]').addEventListener('change', (e) => {
    img.style.visibility = e.target.checked ? 'visible' : 'hidden';
  });

  // --- zoom / pan ---
  let scale = 1, tx = 0, ty = 0;
  function apply() { pan.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`; }
  function zoomAt(factor, cx, cy) {
    const rect = viewport.getBoundingClientRect();
    const px = (cx - rect.left - tx) / scale;
    const py = (cy - rect.top - ty) / scale;
    scale = Math.max(1, Math.min(6, scale * factor));
    tx = cx - rect.left - px * scale;
    ty = cy - rect.top - py * scale;
    constrain(); apply();
  }
  function constrain() {
    const rect = viewport.getBoundingClientRect();
    const maxX = 0, minX = rect.width - rect.width * scale;
    const maxY = 0, minY = rect.height - rect.height * scale;
    tx = Math.min(maxX, Math.max(minX, tx));
    ty = Math.min(maxY, Math.max(minY, ty));
  }
  function fit() { scale = 1; tx = 0; ty = 0; apply(); }

  root.querySelector('[data-act="zoom-in"]').addEventListener('click', () => {
    const r = viewport.getBoundingClientRect(); zoomAt(1.25, r.left + r.width / 2, r.top + r.height / 2);
  });
  root.querySelector('[data-act="zoom-out"]').addEventListener('click', () => {
    const r = viewport.getBoundingClientRect(); zoomAt(0.8, r.left + r.width / 2, r.top + r.height / 2);
  });
  root.querySelector('[data-act="fit"]').addEventListener('click', fit);

  viewport.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && Math.abs(e.deltaY) < 1) return;
    e.preventDefault();
    zoomAt(e.deltaY < 0 ? 1.12 : 0.89, e.clientX, e.clientY);
  }, { passive: false });

  // drag to pan (only when zoomed in)
  let dragging = false, sx = 0, sy = 0;
  viewport.addEventListener('pointerdown', (e) => {
    if (scale <= 1) return;
    dragging = true; sx = e.clientX - tx; sy = e.clientY - ty;
    viewport.setPointerCapture(e.pointerId); viewport.classList.add('grabbing');
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    tx = e.clientX - sx; ty = e.clientY - sy; constrain(); apply();
  });
  const endDrag = () => { dragging = false; viewport.classList.remove('grabbing'); };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  return { setColors, setSelection, clearSelection, fit };
}
