// iosummary.js — flow-category pallet roll-up. A compact read-only summary of the
// site's flow categories (Inbound / Outbound) plus the grand total. Categories
// come from the seed (model.categories()), so this adapts to each site's own
// department grouping rather than assuming fixed ids. Mirrors panel.js.

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export function createIoSummary(root, model) {
  function render() {
    const rows = model.categories()
      .map((c) => `<div><dt>${esc(c.name)}</dt><dd>${model.categoryTotal(c.id)}</dd></div>`)
      .join('');
    const total = model.totalPallets();
    root.innerHTML = `
      <dl class="panel-stats io-stats">
        ${rows}
        <div class="io-total"><dt>Total</dt><dd>${total}</dd></div>
      </dl>`;
  }
  render();
  return { render };
}
