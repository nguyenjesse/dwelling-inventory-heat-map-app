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

// A drag from (x0,y0) to (x1,y1) as a positive-extent rect, so a marquee swept
// up-and-left describes the same region as one swept down-and-right.
export function normalizeRect(x0, y0, x1, y1) {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
  };
}

// The ids of `entries` ({ id, x, y, w, h }) whose box overlaps rect `r`, in the order
// given. Overlap is *intersection*, not containment — brushing a box is enough to
// catch it, which is the forgiving behaviour every rubber-band select has and the
// only workable one on a dense floor plan. Edges that merely touch don't count, so a
// zero-area marquee (a plain click) selects nothing.
export function rectHits(entries, r) {
  const hits = [];
  for (const e of entries) {
    if (e.x < r.x + r.w && e.x + e.w > r.x && e.y < r.y + r.h && e.y + e.h > r.y) hits.push(e.id);
  }
  return hits;
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
