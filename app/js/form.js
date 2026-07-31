// form.js — area pallet-count editor. Pick an area (dropdown, grouped by
// department) or have one pushed in from a map-region click, then type the
// area's pallet count directly. Replaces the old scan-one-container form.

// Case-insensitive substring match over an area's name and I-beam location.
// Pure (no DOM) so the search box below and the tests can share it. An empty
// query matches nothing (the results list stays hidden). Mirrors the editor's
// own list filter (editor.js renderList).
export function matchAreas(areas, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  return areas.filter((a) =>
    a.name.toLowerCase().includes(q) ||
    String(a.iBeamLocation || '').toLowerCase().includes(q));
}

export function createCountEditor(root, model, { onChange, onSelectArea, floorId } = {}) {
  root.innerHTML = `
    <form class="entry-form" autocomplete="off" novalidate>
      <div class="field area-search-field">
        <label for="areaSearch">Find area</label>
        <input id="areaSearch" type="search" autocomplete="off"
               placeholder="Search name or I-Beam…" aria-expanded="false"
               role="combobox" aria-controls="areaResults" aria-autocomplete="list" />
        <ul id="areaResults" class="area-results" role="listbox" hidden></ul>
      </div>
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
      <p class="form-msg" role="status" aria-live="polite"></p>
    </form>`;

  const form = root.querySelector('form');
  const areaEl = form.areaSelect;
  const ibeamEl = form.iBeam;
  const deptEl = form.dept;
  const palletsEl = form.pallets;
  const searchEl = form.querySelector('#areaSearch');
  const resultsEl = form.querySelector('#areaResults');
  const saveBtn = form.querySelector('[data-act="save"]');
  const clearBtn = form.querySelector('[data-act="clear"]');
  const msgEl = form.querySelector('.form-msg');

  // The floor whose areas the dropdown + search operate over. Kept in sync by
  // buildOptions (initial paint + floor switches).
  let currentFloorId = floorId || model.defaultFloorId();

  function setMsg(text, kind = '') {
    msgEl.textContent = text || '';
    msgEl.className = 'form-msg' + (kind ? ' ' + kind : '');
  }

  // Rebuild the area dropdown for one floor (departments are global; only that
  // floor's areas are listed). Clears the current selection.
  function buildOptions(fid) {
    currentFloorId = fid;
    hideResults();
    searchEl.value = '';
    const onFloor = new Set(model.areasOnFloor(fid).map((a) => a.id));
    const optgroups = model.seed.departments.map((d) => {
      const areas = model.areasInDept(d.id).filter((a) => onFloor.has(a.id))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
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

  // ---- type-ahead area search ----
  // A quick way to jump to one of the floor's areas by name or I-beam without
  // scrolling the department-grouped dropdown. Selecting a result behaves like
  // picking from the dropdown (syncs map/panel via onSelectArea) and focuses the
  // count field so the operator can type straight away.
  let activeResult = -1; // index of the keyboard-highlighted result, -1 = none
  const MAX_RESULTS = 8;

  function hideResults() {
    resultsEl.hidden = true;
    resultsEl.innerHTML = '';
    activeResult = -1;
    searchEl.setAttribute('aria-expanded', 'false');
  }

  function renderResults() {
    const matches = matchAreas(model.areasOnFloor(currentFloorId), searchEl.value)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .slice(0, MAX_RESULTS);
    if (!matches.length) { hideResults(); return; }
    resultsEl.innerHTML = matches.map((a, i) => {
      const dept = model.getDept(a.departmentId);
      const meta = [a.iBeamLocation || '—', dept ? dept.name : ''].filter(Boolean).join(' · ');
      return `<li data-id="${a.id}" data-i="${i}" role="option">`
        + `<span class="ar-name">${a.name}</span>`
        + `<span class="ar-meta">${meta}</span></li>`;
    }).join('');
    resultsEl.hidden = false;
    activeResult = -1;
    searchEl.setAttribute('aria-expanded', 'true');
  }

  function highlight(i) {
    const items = resultsEl.querySelectorAll('li');
    if (!items.length) return;
    activeResult = (i + items.length) % items.length;
    items.forEach((li, idx) => li.classList.toggle('active', idx === activeResult));
    items[activeResult].scrollIntoView({ block: 'nearest' });
  }

  // Select an area from the search results: mirror the dropdown selection path
  // (populate + notify) and drop focus into the count field.
  function commitSearch(id) {
    if (!model.getArea(id)) return;
    areaEl.value = id;
    populate();
    setMsg('');
    searchEl.value = '';
    hideResults();
    if (onSelectArea) onSelectArea(id);
    palletsEl.focus();
    palletsEl.select();
  }

  searchEl.addEventListener('input', renderResults);
  searchEl.addEventListener('focus', () => { if (searchEl.value) renderResults(); });
  searchEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (resultsEl.hidden) renderResults(); highlight(activeResult + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(activeResult - 1); }
    else if (e.key === 'Enter') {
      // The search box lives inside the entry <form>; keep Enter from submitting.
      const items = resultsEl.querySelectorAll('li');
      if (!items.length) return;
      e.preventDefault();
      const pick = items[activeResult >= 0 ? activeResult : 0];
      commitSearch(pick.dataset.id);
    } else if (e.key === 'Escape') {
      if (!resultsEl.hidden) { e.preventDefault(); hideResults(); }
    }
  });
  // mousedown (not click) so the selection lands before the input's blur hides
  // the list; preventDefault keeps focus off the <li>.
  resultsEl.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    e.preventDefault();
    commitSearch(li.dataset.id);
  });
  searchEl.addEventListener('blur', () => setTimeout(hideResults, 0));

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
