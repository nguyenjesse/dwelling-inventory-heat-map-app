// panel.js — area information panel. Shows selected-area details plus
// department/zone totals, and the list of containers in the selected area.

const EMPTY = 'Select an area to view details.';

export function createPanel(root, model, { onRelocate, onRemove } = {}) {
  function renderEmpty() {
    root.innerHTML = `<div class="panel-empty">${EMPTY}</div>`;
  }

  function render(areaId) {
    const area = model.getArea(areaId);
    if (!area) { renderEmpty(); return; }
    const dept = model.getDept(area.departmentId);
    const counts = model.countsByArea();
    const areaCount = counts[area.id] || 0;
    const deptTotal = model.departmentTotal(area.departmentId);
    const grandTotal = model.totalPallets();
    const pct = grandTotal ? Math.round((areaCount / grandTotal) * 100) : 0;
    const containers = model.recordsForArea(area.id);

    root.innerHTML = `
      <div class="panel-head">
        <h3>${area.name}</h3>
        <dl class="panel-stats">
          <div><dt>I-Beam</dt><dd>${area.iBeamLocation}</dd></div>
          <div><dt>Pallets</dt><dd>${areaCount}</dd></div>
          <div><dt>Department</dt><dd>${dept.name}</dd></div>
          <div><dt>Dept total</dt><dd>${deptTotal}</dd></div>
          <div><dt>% of all pallets</dt><dd>${pct}%</dd></div>
        </dl>
      </div>
      <div class="panel-containers">
        <h4>Containers (${containers.length})</h4>
        ${containers.length === 0
          ? '<p class="muted">No containers here.</p>'
          : `<ul class="container-list">${containers.map((c) => `
              <li>
                <span class="cid">${c.containerId}</span>
                <span class="row-actions">
                  <button type="button" data-relocate="${c.id}" title="Relocate">Move</button>
                  <button type="button" data-remove="${c.id}" title="Remove">✕</button>
                </span>
              </li>`).join('')}</ul>`}
      </div>`;

    root.querySelectorAll('[data-remove]').forEach((b) =>
      b.addEventListener('click', () => { if (onRemove) onRemove(b.dataset.remove); }));
    root.querySelectorAll('[data-relocate]').forEach((b) =>
      b.addEventListener('click', () => { if (onRelocate) onRelocate(b.dataset.relocate); }));
  }

  renderEmpty();
  return { render, renderEmpty };
}
