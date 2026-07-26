// heatmap.js — corrected green -> yellow -> red heat scale.
//
// Fixes the two quirks the migration brief calls out:
//  1. Zero counts are neutral gray and are EXCLUDED from normalization, so the
//     smallest positive value is a true green rather than being dragged toward
//     the midpoint by zeros.
//  2. A genuine 3-stop green -> yellow -> red interpolation (the Excel RGB math
//     produced an olive midpoint instead of yellow).

export const ZERO_COLOR = '#808080'; // neutral gray for zero-pallet areas

// Three colour stops. Vivid and clearly distinct in the legend.
const STOP_LOW = [0x2c, 0xa2, 0x5f];  // green  (low)
const STOP_MID = [0xff, 0xd4, 0x00];  // yellow (medium)
const STOP_HIGH = [0xe6, 0x00, 0x00]; // red    (high)

// When every positive area holds the same count we can't say which is high or
// low, so fall back to the midpoint (yellow) rather than the Excel behaviour of
// painting them all red. Tunable in one place.
const EQUAL_FALLBACK_T = 0.5;

function lerp(a, b, u) { return a + (b - a) * u; }

function toHex(rgb) {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v)))
    .toString(16).padStart(2, '0')).join('');
}

// Interpolate a normalized value t in [0,1] across the 3 stops.
export function colorForRatio(t) {
  t = Math.max(0, Math.min(1, t));
  let from, to, u;
  if (t <= 0.5) { from = STOP_LOW; to = STOP_MID; u = t / 0.5; }
  else { from = STOP_MID; to = STOP_HIGH; u = (t - 0.5) / 0.5; }
  return toHex([0, 1, 2].map((i) => lerp(from[i], to[i], u)));
}

// Compute the min/max of POSITIVE counts only. Zeros are ignored.
export function positiveExtent(counts) {
  const pos = counts.filter((c) => c > 0);
  if (pos.length === 0) return null; // no positive data at all
  return { min: Math.min(...pos), max: Math.max(...pos) };
}

// Map a single count -> fill color given the current positive extent.
// `extent` is the result of positiveExtent() over ALL area counts.
export function colorForCount(count, extent) {
  if (!count || count <= 0) return ZERO_COLOR;
  if (!extent) return colorForRatio(EQUAL_FALLBACK_T); // count>0 but no extent (shouldn't happen)
  const { min, max } = extent;
  if (max === min) return colorForRatio(EQUAL_FALLBACK_T); // all positives equal
  const t = (count - min) / (max - min);
  return colorForRatio(t);
}

// Convenience: build a { areaId -> color } map from a { areaId -> count } map.
export function colorMap(countsByArea) {
  const counts = Object.values(countsByArea);
  const extent = positiveExtent(counts);
  const out = {};
  for (const [areaId, count] of Object.entries(countsByArea)) {
    out[areaId] = colorForCount(count, extent);
  }
  return out;
}
