// panel.js — area information panel. Read-only summary of the selected area:
// its pallet count plus department and overall totals.

const EMPTY = 'Select an area to view details.';

export function createPanel(root, model) {
  function renderEmpty() {
    root.innerHTML = `<div class="panel-empty">${EMPTY}</div>`;
  }

  function render(areaId) {
    const area = model.getArea(areaId);
    if (!area) { renderEmpty(); return; }
    const dept = model.getDept(area.departmentId);
    const areaCount = model.getCount(area.id);
    const deptTotal = model.departmentTotal(area.departmentId);
    const grandTotal = model.totalPallets();
    const pct = grandTotal ? Math.round((areaCount / grandTotal) * 100) : 0;

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
      </div>`;
  }

  renderEmpty();
  return { render, renderEmpty };
}
