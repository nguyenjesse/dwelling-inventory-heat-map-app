// iosummary.js — Inbound vs Outbound pallet roll-up. A compact read-only summary
// of the two flow categories plus the grand total. Mirrors panel.js.

export function createIoSummary(root, model) {
  function render() {
    const out = model.categoryTotal('outbound');
    const inb = model.categoryTotal('inbound');
    const total = model.totalPallets();
    root.innerHTML = `
      <dl class="panel-stats io-stats">
        <div><dt>Outbound</dt><dd>${out}</dd></div>
        <div><dt>Inbound</dt><dd>${inb}</dd></div>
        <div class="io-total"><dt>Total</dt><dd>${total}</dd></div>
      </dl>`;
  }
  render();
  return { render };
}
