import { Company, STATUS_FILE, Workspace } from '../types';
import { fileExists, readTextFile, writeTextFile } from './fs';
import { parseDeadlines, replaceDeadlineRow } from './deadlineParser';
import { replaceStatus } from './statusParser';
import type { Status } from '../types';

export interface Task {
  company: Company;
  item: string;
  date: string | null;
  state: string;
}

/**
 * Walk all companies, parse their 締切日一覧 tables, and flatten into Task[].
 */
export async function loadAllTasks(workspace: Workspace): Promise<Task[]> {
  const tasks: Task[] = [];
  for (const cat of workspace.categories) {
    for (const company of cat.companies) {
      try {
        if (!(await fileExists(company.handle, STATUS_FILE))) continue;
        const raw = await readTextFile(company.handle, STATUS_FILE);
        const rows = parseDeadlines(raw);
        for (const r of rows) {
          tasks.push({
            company,
            item: r.item,
            date: r.date,
            state: r.state,
          });
        }
      } catch (e) {
        console.warn(`failed to read deadlines for ${company.name}:`, e);
      }
    }
  }
  return tasks;
}

/**
 * Update a company's status by rewriting the blockquote line in 選考フロー・ステータス.md.
 */
export async function updateCompanyStatus(
  company: Company,
  newStatus: Status,
): Promise<void> {
  if (!(await fileExists(company.handle, STATUS_FILE))) {
    throw new Error(`${STATUS_FILE} が存在しません`);
  }
  const raw = await readTextFile(company.handle, STATUS_FILE);
  const next = replaceStatus(raw, newStatus);
  await writeTextFile(company.handle, STATUS_FILE, next);
}

/**
 * Update one row of the 締切日一覧 table for a company.
 */
export async function updateDeadline(
  company: Company,
  itemName: string,
  patch: { date?: string | null; state?: string },
): Promise<void> {
  if (!(await fileExists(company.handle, STATUS_FILE))) {
    throw new Error(`${STATUS_FILE} が存在しません`);
  }
  const raw = await readTextFile(company.handle, STATUS_FILE);
  const next = replaceDeadlineRow(raw, itemName, patch);
  if (next === raw) {
    throw new Error(`「${itemName}」の行が見つかりません`);
  }
  await writeTextFile(company.handle, STATUS_FILE, next);
}

/**
 * Filter tasks to those whose date falls within today..today+7 (inclusive).
 */
export function filterThisWeek(tasks: Task[]): Task[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 7);

  return tasks.filter((t) => {
    if (!t.date) return false;
    const d = parseDate(t.date);
    if (!d) return false;
    return d >= today && d <= horizon;
  });
}

/**
 * Sort tasks by date ascending. Tasks without a date go to the end.
 */
export function sortByDate(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const da = a.date ? parseDate(a.date)?.getTime() ?? Infinity : Infinity;
    const db = b.date ? parseDate(b.date)?.getTime() ?? Infinity : Infinity;
    return da - db;
  });
}

function parseDate(s: string): Date | null {
  // Accept YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY, etc. Be lenient.
  const cleaned = s.trim();
  if (!cleaned) return null;
  // Try ISO first
  let d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;
  // Try YYYY/MM/DD
  const m = cleaned.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m) {
    d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}
