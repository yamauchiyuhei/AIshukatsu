import { Row } from '../types/sheet';
import { urgencyForDate } from './conditionalFormat';

export interface Stats {
  total: number;
  byStatus: Record<string, number>;
  urgentCount: number; // due within 7 days, undone
  offerCount: number;
}

export function computeStats(rows: Row[]): Stats {
  const byStatus: Record<string, number> = {};
  let urgentCount = 0;
  let offerCount = 0;
  for (const r of rows) {
    const s = String(r.cells['status'] ?? '');
    if (s) byStatus[s] = (byStatus[s] ?? 0) + 1;
    if (s === '内定') offerCount++;
    const completed = s === '内定' || s === 'お祈り';
    if (!completed) {
      const dates = ['es_deadline', 'webtest_deadline', 'interview_at'];
      for (const k of dates) {
        const u = urgencyForDate(r.cells[k], false);
        if (u === 'overdue' || u === 'today' || u === 'soon' || u === 'week') {
          urgentCount++;
          break; // count each row at most once
        }
      }
    }
  }
  return { total: rows.length, byStatus, urgentCount, offerCount };
}
