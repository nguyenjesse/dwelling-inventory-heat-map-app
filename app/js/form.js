// form.js — area pallet-count editor. Pick an area (dropdown, grouped by
// department) or have one pushed in from a map-region click, then type the
// area's pallet count directly. Replaces the old scan-one-container form.

export function createCountEditor(root, model, { onChange, onSelectArea, floorId } = {}) {
  root.innerHTML = `
    <form class="entry-form" autocomplete="off" novalidate>
      <div class="field">
        <label for="areaSelect">Area</label>
        <select id="areaSelect" name="areaSelect">
          <option value="">Select an area…</option>
        </select>
      </div>
      <div class="field">
        <label for="iBeam">I-Beam Location</label>
        <input id="iBeam" name="iBeam" type="text" readonly tabindex="-1" placeholder="—" />
      </div>
      <div class="field">
        <label for="dept">Department</label>
        <input id="dept" name="dept" type="text" readonly tabindex="-1" placeholder="—" />
      </div>
      <div class="field">
        <label for="pallets">Pallets</label>
        <input id="pallets" name="pallets" type="number" min="0" step="1"
               inputmode="numeric" placeholder="0" disabled />
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary" disabled data-act="save">Save count</button>
        <button type="button" class="btn" data-act="clear" disabled>Clear</button>
      </div>
      <label class="inline form-advance">
        <input id="advanceNext" type="checkbox" /> Advance to next area after Save
      </label>
      <p class="form-msg" role="status" aria-live="polite"></p>
    </form>`;

  const form = root.querySelector('form');
  const areaEl = form.areaSelect;
  const ibeamEl = form.iBeam;
  const deptEl = form.dept;
  const palletsEl = form.pallets;
  const saveBtn = form.querySelector('[data-act="save"]');
  const clearBtn = form.querySelector('[data-act="clear"]');
  const advanceEl = form.querySelector('#advanceNext');
  const msgEl = form.querySelector('.form-msg');

  // Area IDs in the dropdown's (department-grouped) order for the current floor.
  // Drives "advance to next area after Save"; rebuilt whenever the floor changes.
  let orderedIds = [];

  function setMsg(text, kind = '') {
    msgEl.textContent = text || '';
    msgEl.className = 'form-msg' + (kind ? ' ' + kind : '');
  }

  // Rebuild the area dropdown for one floor (departments are global; only that
  // floor's areas are listed). Clears the current selection.
  function buildOptions(fid) {
    const onFloor = new Set(model.areasOnFloor(fid).map((a) => a.id));
    orderedIds = [];
    const optgroups = model.seed.departments.map((d) => {
      const areas = model.areasInDept(d.id).filter((a) => onFloor.has(a.id));
      areas.forEach((a) => orderedIds.push(a.id));
      const opts = areas
        .map((a) => `<option value="${a.id}">${a.name}</option>`).join('');
      return opts ? `<optgroup label="${d.name}">${opts}</optgroup>` : '';
    }).join('');
    areaEl.innerHTML = `<option value="">Select an area…</option>${optgroups}`;
    areaEl.value = '';
    setMsg('');
    populate();
  }

  // Populate the read-only fields + count for the currently selected area.
  function populate() {
    const area = model.getArea(areaEl.value);
    if (!area) {
      ibeamEl.value = '';
      deptEl.value = '';
      palletsEl.value = '';
      palletsEl.disabled = true;
      saveBtn.disabled = true;
      clearBtn.disabled = true;
      return;
    }
    ibeamEl.value = area.iBeamLocation;
    deptEl.value = model.getDept(area.departmentId).name;
    palletsEl.value = model.getCount(area.id);
    palletsEl.disabled = false;
    saveBtn.disabled = false;
    clearBtn.disabled = false;
  }

  areaEl.addEventListener('change', () => {
    setMsg('');
    populate();
    if (areaEl.value && onSelectArea) onSelectArea(areaEl.value);
  });

  // Restrict the count field to whole, non-negative numbers as the user types.
  // A native number input otherwise accepts ".", "e", "+" and "-"; block those
  // keys and strip anything non-digit from pastes so only 0,1,2,… survive.
  palletsEl.addEventListener('keydown', (e) => {
    if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
  });
  palletsEl.addEventListener('input', () => {
    const cleaned = palletsEl.value.replace(/\D+/g, '');
    if (cleaned !== palletsEl.value) palletsEl.value = cleaned;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const area = model.getArea(areaEl.value);
    if (!area) { setMsg('Select an area first.', 'error'); areaEl.focus(); return; }
    const raw = palletsEl.value.trim();
    if (raw === '') { setMsg('Enter a pallet count.', 'error'); palletsEl.focus(); return; }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      setMsg('Pallet count must be a whole number of 0 or more.', 'error');
      palletsEl.focus();
      return;
    }
    const saved = model.setCount(area.id, n);
    palletsEl.value = saved;
    setMsg(`Set ${area.name} to ${saved} pallet${saved === 1 ? '' : 's'}.`, 'success');
    if (onChange) onChange();

    // Rapid entry: hop straight to the next area on the floor and focus its count
    // field, so a full sweep is type-Enter-type-Enter with no dropdown trips.
    if (advanceEl.checked) {
      const idx = orderedIds.indexOf(area.id);
      const nextId = idx >= 0 ? orderedIds[idx + 1] : undefined;
      if (nextId) {
        selectArea(nextId);
        if (onSelectArea) onSelectArea(nextId); // sync map highlight + panel
      } else {
        setMsg(`Set ${area.name} to ${saved} pallet${saved === 1 ? '' : 's'}. `
          + 'Reached the last area.', 'success');
      }
    }
  });

  clearBtn.addEventListener('click', () => {
    const area = model.getArea(areaEl.value);
    if (!area) return;
    model.setCount(area.id, 0);
    palletsEl.value = 0;
    setMsg(`Cleared ${area.name}.`, '');
    if (onChange) onChange();
  });

  // Programmatically select an area (e.g. from a map-region click). Populates
  // the fields and focuses the count input, but does NOT fire onSelectArea —
  // the caller already owns the selection state.
  function selectArea(areaId) {
    if (areaId && model.getArea(areaId)) {
      areaEl.value = areaId;
      populate();
      setMsg('');
      palletsEl.focus();
      palletsEl.select();
    } else {
      areaEl.value = '';
      populate();
    }
  }

  // initial population for the starting floor
  buildOptions(floorId || model.defaultFloorId());

  return {
    selectArea,
    getAreaId: () => areaEl.value || null,
    // Re-read the current area's stored count (after external changes/import).
    refresh: () => populate(),
    // Repopulate the dropdown for a different floor.
    setFloor: (fid) => buildOptions(fid),
  };
}
