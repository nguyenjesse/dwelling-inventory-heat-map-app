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
