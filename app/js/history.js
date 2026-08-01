// history.js — a generic, bounded undo/redo stack over opaque snapshots. The
// caller decides what a "snapshot" is (any value) and how to capture and restore
// it; this only manages the two stacks and the current baseline.
//
// Model: `baseline` is the live (current) state. commit(next) files the previous
// baseline as undoable and makes `next` the baseline, discarding the redo future.
// undo()/redo() move the baseline between the stacks and return the snapshot to
// restore. Older-than-limit undo steps are dropped.

export function createHistory({ limit = 100 } = {}) {
  let undoStack = [];   // past snapshots, oldest -> newest
  let redoStack = [];   // undone snapshots, available to redo
  let baseline = null;  // the last committed snapshot = current live state

  return {
    // Seed the current state and drop all history (e.g. after load / new).
    init(snapshot) { baseline = snapshot; undoStack = []; redoStack = []; },

    // Record a newly-committed state: the previous baseline becomes undoable and
    // the redo future is cleared.
    commit(snapshot) {
      if (baseline !== null) {
        undoStack.push(baseline);
        if (undoStack.length > limit) undoStack.shift();
      }
      baseline = snapshot;
      redoStack = [];
    },

    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,

    // Step back one state; returns the snapshot to restore, or null if none.
    undo() {
      if (!undoStack.length) return null;
      redoStack.push(baseline);
      baseline = undoStack.pop();
      return baseline;
    },

    // Step forward one state; returns the snapshot to restore, or null if none.
    redo() {
      if (!redoStack.length) return null;
      undoStack.push(baseline);
      baseline = redoStack.pop();
      return baseline;
    },

    clear() { undoStack = []; redoStack = []; baseline = null; },
  };
}
