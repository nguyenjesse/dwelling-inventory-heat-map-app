// breakdown.js — "Area Breakdown" table. A per-department roll-up of pallet
// counts (business "Area" = department here), each row expandable to its areas
// (business "Physical Location"), showing Area, Pole Location (I-Beam), and
// Pallet Count. Read-only; mirrors the factory pattern of panel.js.

export function createBreakdown(root, model, { floorId } = {}) {
  let currentFloorId = floorId || model.defaultFloorId();
  // Departments the user has expanded — kept across re-renders so a count edit
  // doesn't collapse an open section.
  const openDepts = new Set();

  // Departments that have at least one area on the current floor, each with its
  // floor-filtered areas and subtotal. Preserves data order (departments.json,
  // areas.json). Every such department and every one of its areas is listed,
  // including zero counts.
  function rows() {
    return model.seed.departments
      .map((d) => {
        const areas = model.areasInDept(d.id).filter((a) => a.floorId === currentFloorId)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        const total = areas.reduce((sum, a) => sum + model.getCount(a.id), 0);
        return { dept: d, areas, total };
      })
      .filter((r) => r.areas.length > 0);
  }

  function render() {
    const groups = rows();
    if (!groups.length) {
      root.innerHTML = '<div class="panel-empty">No areas on this floor.</div>';
      return;
    }
    const bodies = groups.map(({ dept, areas, total }) => {
      const open = openDepts.has(dept.id);
      const areaRows = areas.map((a) => `
        <tr>
          <td>${a.name}</td>
          <td>${a.iBeamLocation}</td>
          <td class="bd-num">${model.getCount(a.id)}</td>
        </tr>`).join('');
      return `
      <tbody class="bd-group${open ? ' is-open' : ''}" data-dept="${dept.id}">
        <tr class="bd-dept" role="button" tabindex="0" aria-expanded="${open}">
          <td class="bd-dept-name"><span class="bd-caret" aria-hidden="true"></span>${dept.name}</td>
          <td class="bd-num">${total}</td>
        </tr>
        <tr class="bd-sub">
          <td colspan="2">
            <table class="bd-inner">
              <thead><tr><th>Area</th><th>Pole Location</th><th class="bd-num">Pallet Count</th></tr></thead>
              <tbody>${areaRows}</tbody>
            </table>
          </td>
        </tr>
      </tbody>`;
    }).join('');

    root.innerHTML = `
      <table class="breakdown">
        <thead><tr><th>Area</th><th class="bd-num">Pallet Count</th></tr></thead>
        ${bodies}
      </table>`;
  }

  function toggle(deptId) {
    if (openDepts.has(deptId)) openDepts.delete(deptId);
    else openDepts.add(deptId);
    const group = root.querySelector(`.bd-group[data-dept="${deptId}"]`);
    if (!group) return;
    const open = openDepts.has(deptId);
    group.classList.toggle('is-open', open);
    group.querySelector('.bd-dept').setAttribute('aria-expanded', String(open));
  }

  root.addEventListener('click', (e) => {
    const deptRow = e.target.closest('.bd-dept');
    if (deptRow && root.contains(deptRow)) toggle(deptRow.closest('.bd-group').dataset.dept);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const deptRow = e.target.closest('.bd-dept');
    if (deptRow && root.contains(deptRow)) {
      e.preventDefault();
      toggle(deptRow.closest('.bd-group').dataset.dept);
    }
  });

  render();

  return {
    render,
    setFloor(fid) { currentFloorId = fid; render(); },
  };
}
