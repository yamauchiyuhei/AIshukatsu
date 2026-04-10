import { CellValue, COMPLETED_STATUSES, REJECTED_STATUSES, Row } from '../types/sheet';

export type Urgency = 'overdue' | 'today' | 'soon' | 'week' | 'normal' | 'done';

/** Compare a date string ("YYYY-MM-DD" or ISO) with today and return urgency. */
export function urgencyForDate(value: CellValue, completed: boolean): Urgency {
  if (completed) return 'done';
  if (!value || typeof value !== 'string') return 'normal';
  const d = parseDate(value);
  if (!d) return 'normal';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 3) return 'soon';
  if (diff <= 7) return 'week';
  return 'normal';
}

export function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d;
}

export const URGENCY_BG: Record<Urgency, string> = {
  overdue: 'bg-rose-100',
  today: 'bg-rose-100',
  soon: 'bg-orange-50',
  week: 'bg-amber-50',
  normal: '',
  done: 'bg-emerald-50',
};

export const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: 'text-rose-700 font-semibold',
  today: 'text-rose-700 font-semibold',
  soon: 'text-orange-700 font-semibold',
  week: 'text-amber-700',
  normal: 'text-slate-700',
  done: 'text-emerald-700',
};

export interface RowStyle {
  rowBg: string;
  rowText: string;
  strike: boolean;
}

export function rowStyleFor(row: Row): RowStyle {
  const status = String(row.cells['status'] ?? '');
  if (REJECTED_STATUSES.has(status)) {
    return { rowBg: 'bg-slate-100', rowText: 'text-slate-400', strike: true };
  }
  if (COMPLETED_STATUSES.has(status)) {
    return { rowBg: 'bg-emerald-50/60', rowText: 'text-slate-700', strike: false };
  }
  return { rowBg: '', rowText: 'text-slate-800', strike: false };
}

export function isCompletedStatus(s: string | null | undefined): boolean {
  return !!s && COMPLETED_STATUSES.has(s);
}
