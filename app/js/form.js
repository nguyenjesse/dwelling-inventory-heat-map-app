// form.js — pallet entry: unique I-beam (searchable), area filtered by I-beam,
// department auto-derived, validation with visible messages.

export function createEntryForm(root, model, { onChange } = {}) {
  const ibeams = model.uniqueIBeams();
  root.innerHTML = `
    <form class="entry-form" autocomplete="off" novalidate>
      <div class="field">
        <label for="containerId">Container ID</label>
        <input id="containerId" name="containerId" type="text" inputmode="text"
               placeholder="Scan or type…" autocomplete="off" autofocus />
      </div>
      <div class="field">
        <label for="iBeam">I-Beam Location</label>
        <input id="iBeam" name="iBeam" type="text" list="ibeamList" placeholder="e.g. J12" autocomplete="off" />
        <datalist id="ibeamList">
          ${ibeams.map((b) => `<option value="${b}"></option>`).join('')}
        </datalist>
      </div>
      <div class="field">
        <label for="area">Area</label>
        <select id="area" name="area" disabled>
          <option value="">Select I-beam first…</option>
        </select>
      </div>
      <div class="field">
        <label for="dept">Department</label>
        <input id="dept" name="dept" type="text" readonly tabindex="-1" placeholder="—" />
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Add pallet</button>
        <button type="button" class="btn" data-act="undo" disabled>Undo last</button>
      </div>
      <p class="form-msg" role="status" aria-live="polite"></p>
    </form>`;

  const form = root.querySelector('form');
  const containerEl = form.containerId;
  const ibeamEl = form.iBeam;
  const areaEl = form.area;
  const deptEl = form.dept;
  const msgEl = form.querySelector('.form-msg');
  const undoBtn = form.querySelector('[data-act="undo"]');

  let lastAddedId = null;

  function setMsg(text, kind = '') {
    msgEl.textContent = text || '';
    msgEl.className = 'form-msg' + (kind ? ' ' + kind : '');
  }

  function populateAreas() {
    const ib = ibeamEl.value.trim();
    const areas = model.areasForIBeam(ib);
    const prev = areaEl.value;
    if (areas.length === 0) {
      areaEl.innerHTML = '<option value="">' +
        (ib ? 'No areas for this I-beam' : 'Select I-beam first…') + '</option>';
      areaEl.disabled = true;
      deptEl.value = '';
      return;
    }
    areaEl.disabled = false;
    areaEl.innerHTML = (areas.length > 1 ? '<option value="">Select area…</option>' : '') +
      areas.map((a) => `<option value="${a.id}">${a.name}</option>`).join('');
    // Preserve prior area only if still valid for the new I-beam (quirk 7.6).
    if (prev && areas.some((a) => a.id === prev)) areaEl.value = prev;
    else if (areas.length === 1) areaEl.value = areas[0].id;
    else areaEl.value = '';
    updateDept();
  }

  function updateDept() {
    const area = model.getArea(areaEl.value);
    deptEl.value = area ? model.getDept(area.departmentId).name : '';
  }

  ibeamEl.addEventListener('input', () => { populateAreas(); setMsg(''); });
  ibeamEl.addEventListener('change', populateAreas);
  areaEl.addEventListener('change', () => { updateDept(); setMsg(''); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const containerId = containerEl.value.trim();
    const ib = ibeamEl.value.trim();
    const areaId = areaEl.value;

    if (!containerId) { setMsg('Enter a Container ID.', 'error'); containerEl.focus(); return; }
    if (!ib || model.areasForIBeam(ib).length === 0) {
      setMsg('Select a valid I-beam location.', 'error'); ibeamEl.focus(); return;
    }
    if (!areaId) { setMsg('Select an area.', 'error'); areaEl.focus(); return; }
    if (!model.isValidAreaForIBeam(ib, areaId)) {
      setMsg('That area is not valid for the selected I-beam.', 'error'); return;
    }
    if (model.hasContainer(containerId)) {
      setMsg(`Container "${containerId}" is already recorded. Click its area on the map to relocate it.`, 'error');
      return;
    }

    const rec = model.addRecord({ containerId, iBeamLocation: ib, areaId });
    lastAddedId = rec.id;
    undoBtn.disabled = false;
    const area = model.getArea(areaId);
    setMsg(`Added "${containerId}" to ${area.name}.`, 'success');

    // Reset for the next scan; keep I-beam/area for rapid same-location entry.
    containerEl.value = '';
    containerEl.focus();
    if (onChange) onChange();
  });

  undoBtn.addEventListener('click', () => {
    if (!lastAddedId) return;
    model.removeRecord(lastAddedId);
    setMsg('Removed last entry.', '');
    lastAddedId = null;
    undoBtn.disabled = true;
    if (onChange) onChange();
  });

  return {
    focus: () => containerEl.focus(),
    refresh: () => { /* form is self-contained; hook for future use */ },
  };
}
