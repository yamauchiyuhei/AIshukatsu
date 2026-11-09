import type { Column, Row, Workbook } from '../spreadsheet/types/sheet';
import { localDateKey } from '../lib/cellValues';
import { parseLocalDate } from '../lib/deadlines';

export const PLANNER_ID = 'career-planner-v1';
export type ItemKind = 'event' | 'task' | 'es';
export interface CareerItem {
  id: string; company: string; title: string; kind: ItemKind;
  date: string; time: string; endTime: string; location: string; url: string;
  notes: string; minutes: number; done: boolean; source: string;
  entrySheetId: string; entryRowId: string; versions: EsVersion[];
}
export interface EsVersion { text: string; savedAt: string; submitted: boolean; }
export type CareerDraft = Omit<CareerItem, 'id' | 'versions'> & { id?: string; versions?: EsVersion[] };
export const newDraft = (patch: Partial<CareerDraft> = {}): CareerDraft => ({
  company: '', title: '', kind: 'task', date: '', time: '', endTime: '', location: '', url: '',
  notes: '', minutes: 30, done: false, source: '', entrySheetId: '', entryRowId: '', ...patch,
});
const columns: Column[] = [
  { id: 'company', name: '企業名', type: 'text', role: 'company', width: 180 },
  { id: 'title', name: '予定・対応事項', type: 'text', width: 230 },
  { id: 'kind', name: '種類', type: 'select', options: ['event','task','es'] },
  { id: 'status', name: '対応状況', type: 'select', role: 'status', options: ['未完了','完了'] },
  { id: 'due_date', name: '日付', type: 'date' }, { id: 'due_at', name: '日時', type: 'datetime' },
  { id: 'end_time', name: '終了時刻', type: 'text' }, { id: 'location', name: '会場', type: 'text' },
  { id: 'meeting_url', name: '参加・案内URL', type: 'url' }, { id: 'minutes', name: '所要時間（分）', type: 'text' },
  { id: 'memo', name: 'メモ', type: 'longtext', width: 260 }, { id: 'source', name: '取り込み元', type: 'text' },
  { id: 'entry_sheet', name: '関連シート', type: 'text' }, { id: 'entry_row', name: '関連エントリー', type: 'text' },
  { id: 'es_versions', name: 'ESの保存履歴', type: 'longtext' },
];
export function safeUrl(raw: string) {
  if (!raw.trim()) return '';
  try { const u = new URL(raw.trim()); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function validateDraft(draft: CareerDraft) {
  if (!draft.company.trim() || !draft.title.trim()) throw new Error('企業名とタイトルを入力してください。');
  if (draft.date && !parseLocalDate(draft.date)) throw new Error('日付を確認してください。');
  if (draft.time && (!draft.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))) throw new Error('開始時刻と日付を確認してください。');
  if (draft.endTime && (!draft.time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.endTime) || draft.endTime <= draft.time)) throw new Error('終了時刻は開始時刻より後にしてください。日をまたぐ予定は分けて登録してください。');
  if (draft.url && !safeUrl(draft.url)) throw new Error('URLは https:// または http:// から始めてください。');
  if (!Number.isFinite(draft.minutes) || draft.minutes < 1 || draft.minutes > 720) throw new Error('所要時間は1〜720分で入力してください。');
}
const str = (r: Row, key: string) => String(r.cells[key] ?? '');
export function careerItems(workbook: Workbook): CareerItem[] {
  return (workbook.sheets.find(s => s.id === PLANNER_ID)?.rows ?? []).map(r => {
    let versions: EsVersion[] = []; try { const v = JSON.parse(str(r, 'es_versions') || '[]'); if (Array.isArray(v)) versions = v.filter(x => typeof x.text === 'string' && typeof x.savedAt === 'string'); } catch { /* Keep the user's raw cell intact. */ }
    const at = str(r, 'due_at');
    return { id: r.id, company: str(r,'company'), title: str(r,'title'), kind: str(r,'kind') as ItemKind,
      date: at ? at.slice(0,10) : str(r,'due_date'), time: at ? at.slice(11,16) : '', endTime: str(r,'end_time'),
      location: str(r,'location'), url: str(r,'meeting_url'), notes: str(r,'memo'), minutes: Number(r.cells.minutes) || 30,
      done: str(r,'status') === '完了', source: str(r,'source'), entrySheetId: str(r,'entry_sheet'), entryRowId: str(r,'entry_row'), versions };
  });
}
function rowOf(draft: CareerDraft, id: string): Row {
  validateDraft(draft);
  return { id, cells: { company: draft.company.trim(), title: draft.title.trim(), kind: draft.kind, status: draft.done ? '完了' : '未完了',
    due_date: draft.time ? '' : draft.date, due_at: draft.time ? `${draft.date}T${draft.time}` : '', end_time: draft.endTime,
    location: draft.location, meeting_url: safeUrl(draft.url), minutes: String(draft.minutes), memo: draft.notes,
    source: draft.source, entry_sheet: draft.entrySheetId, entry_row: draft.entryRowId, es_versions: JSON.stringify(draft.versions ?? []) } };
}
export function itemFingerprint(item: CareerDraft) {
  return JSON.stringify([item.company.replace(/[\s　]/g,''), item.kind, item.title.trim(), item.date, item.time]);
}
export function addCareerItems(workbook: Workbook, drafts: CareerDraft[]) {
  const seen = new Set(careerItems(workbook).map(itemFingerprint)); const rows: Row[] = []; let skipped = 0;
  for (const draft of drafts) {
    validateDraft(draft); const key = itemFingerprint(draft);
    if (seen.has(key)) { skipped++; continue; } seen.add(key);
    rows.push(rowOf(draft, `plan_${crypto.randomUUID()}`));
  }
  if (!rows.length) return { workbook, ids: [] as string[], skipped };
  const existing = workbook.sheets.find(s => s.id === PLANNER_ID);
  if (existing && columns.some(c => !existing.columns.some(e => e.id === c.id))) throw new Error('予定とタスクの列が変更されています。バックアップを確認してから列を復元してください。');
  const sheet = existing ? { ...existing, rows: [...existing.rows, ...rows] } : { id: PLANNER_ID, name: '予定とタスク', columns, rows };
  return { workbook: { ...workbook, sheets: existing ? workbook.sheets.map(s => s.id === PLANNER_ID ? sheet : s) : [...workbook.sheets, sheet] }, ids: rows.map(r => r.id), skipped };
}
export function changeCareerItem(workbook: Workbook, id: string, patch: Partial<CareerItem>): Workbook {
  const previous = careerItems(workbook).find(x => x.id === id);
  if (!previous) throw new Error('対象が見つかりません。画面を開き直してください。');
  const row = rowOf({ ...previous, ...patch }, id);
  return { ...workbook, sheets: workbook.sheets.map(s => s.id === PLANNER_ID ? { ...s, rows: s.rows.map(r => r.id === id ? { ...r, cells: { ...r.cells, ...row.cells } } : r) } : s) };
}
export function shiftDay(date: string, amount: number) { const d = parseLocalDate(date); if (!d) return ''; d.setDate(d.getDate()+amount); return localDateKey(d); }
export function preparationTasks(item: CareerItem): CareerDraft[] {
  if (!item.date || item.kind !== 'event') return [];
  const link = { company: item.company, entrySheetId: item.entrySheetId, entryRowId: item.entryRowId, source: `準備:${item.id}` };
  return [newDraft({ ...link, title: `${item.title}の準備`, date: shiftDay(item.date,-1), minutes: 30, notes: '企業研究・提出ES・自己紹介・逆質問を確認する。' }),
    newDraft({ ...link, title: `${item.title}の振り返り`, date: item.date, minutes: 10, notes: '聞かれた質問／答えられたこと／次回改善すること／次の連絡予定' })];
}
export function companyEntries(workbook: Workbook) { return workbook.sheets.filter(s => s.id !== PLANNER_ID).flatMap(s => s.rows.filter(r => r.cells.company).map(r => ({ sheetId: s.id, rowId: r.id, company: String(r.cells.company), status: String(r.cells.status ?? ''), url: safeUrl(String(r.cells.mypage_url ?? '')) }))); }
