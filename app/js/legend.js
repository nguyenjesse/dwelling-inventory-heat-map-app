// legend.js — heat-map legend. Reflects the actual scale (gray zero + a
// continuous green->yellow->red ramp) and the current positive range.
import { ZERO_COLOR, colorForRatio } from './heatmap.js';

export function createLegend(root) {
  root.innerHTML = `
    <div class="legend">
      <div class="legend-row">
        <span class="legend-swatch" style="background:${ZERO_COLOR}"></span>
        <span>Zero pallets</span>
      </div>
      <div class="legend-row legend-ramp-row">
        <span class="legend-ramp" style="background:linear-gradient(to right, ${colorForRatio(0)}, ${colorForRatio(0.5)}, ${colorForRatio(1)})"></span>
      </div>
      <div class="legend-scale"><span data-lo>low</span><span>medium</span><span data-hi>high</span></div>
    </div>`;

  // Update the numeric low/high labels from the current positive extent.
  function update(extent) {
    const lo = root.querySelector('[data-lo]');
    const hi = root.querySelector('[data-hi]');
    if (extent) { lo.textContent = `low (${extent.min})`; hi.textContent = `high (${extent.max})`; }
    else { lo.textContent = 'low'; hi.textContent = 'high'; }
  }
  return { update };
}
