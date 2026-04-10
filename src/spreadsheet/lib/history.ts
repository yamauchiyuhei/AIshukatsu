import { Sheet } from '../types/sheet';

interface Snapshot {
  sheetId: string;
  columns: Sheet['columns'];
  rows: Sheet['rows'];
}

const MAX_DEPTH = 50;

export class HistoryStack {
  private past: Snapshot[] = [];
  private future: Snapshot[] = [];

  push(snap: Snapshot) {
    this.past.push(snap);
    if (this.past.length > MAX_DEPTH) this.past.shift();
    this.future = [];
  }

  /**
   * Pops a snapshot for undo and pushes the *current* snapshot to the redo stack.
   */
  undo(current: Snapshot): Snapshot | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push(current);
    if (this.future.length > MAX_DEPTH) this.future.shift();
    return prev;
  }

  redo(current: Snapshot): Snapshot | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(current);
    if (this.past.length > MAX_DEPTH) this.past.shift();
    return next;
  }

  canUndo() {
    return this.past.length > 0;
  }
  canRedo() {
    return this.future.length > 0;
  }

  clear() {
    this.past = [];
    this.future = [];
  }
}

export const historyStack = new HistoryStack();
