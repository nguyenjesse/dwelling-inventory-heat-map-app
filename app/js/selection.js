// selection.js — pure helpers for the editor's multi-select. Kept DOM-free so
// the range math is unit-testable on its own.

// The inclusive slice of `orderedIds` between fromId and toId, in list order,
// regardless of which came first (shift-click range select). If only one id is
// present, that one is returned; if neither is, an empty array.
export function rangeSelect(orderedIds, fromId, toId) {
  const i = orderedIds.indexOf(fromId);
  const j = orderedIds.indexOf(toId);
  if (i < 0 && j < 0) return [];
  if (i < 0) return [toId];
  if (j < 0) return [fromId];
  const [lo, hi] = i <= j ? [i, j] : [j, i];
  return orderedIds.slice(lo, hi + 1);
}

// The largest in-bounds translation of a group of boxes by a *shared* delta: every
// box shifts by the same returned (dx, dy) — preserving their relative layout — clamped
// so the group's bounding box stays inside a WxH canvas. Clamping the group as a whole
// (not each box) is what keeps an aligned row aligned when it reaches an edge: the whole
// group stops together instead of some boxes bunching against the wall. `boxes` is any
// iterable of { x, y, w, h }; an empty group yields no movement.
export function clampGroupDelta(boxes, dx, dy, W, H) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
  }
  if (!Number.isFinite(minX)) return { dx: 0, dy: 0 };
  return {
    dx: Math.max(-minX, Math.min(W - maxX, dx)),
    dy: Math.max(-minY, Math.min(H - maxY, dy)),
  };
}
