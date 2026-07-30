// modal.js — a minimal promise-based choice dialog. Used where a native
// confirm() (only OK/Cancel) can't express more than two clearly-labelled
// actions — e.g. the import "fully replace / merge / cancel" decision.
//
// chooseAction resolves to the picked action's `value`, or `cancelValue`
// (default null) if the user dismisses via Escape, the backdrop, or a button
// carrying that value.

export function chooseAction({ title, message, actions, cancelValue = null }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    if (title) {
      const heading = document.createElement('h2');
      heading.className = 'modal-title';
      heading.textContent = title;
      dialog.appendChild(heading);
    }
    if (message) {
      const body = document.createElement('p');
      body.className = 'modal-msg';
      body.textContent = message;
      dialog.appendChild(body);
    }

    const btnRow = document.createElement('div');
    btnRow.className = 'modal-actions';

    function close(value) {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(value);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(cancelValue); }
    }

    (actions || []).forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn' + (a.variant ? ' btn-' + a.variant : '');
      b.textContent = a.label;
      b.addEventListener('click', () => close(a.value));
      btnRow.appendChild(b);
    });
    dialog.appendChild(btnRow);

    overlay.appendChild(dialog);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(cancelValue); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);

    const first = btnRow.querySelector('button');
    if (first) first.focus();
  });
}
