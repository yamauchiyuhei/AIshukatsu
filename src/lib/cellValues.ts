import type { CellValue, Column } from '../spreadsheet/types/sheet';
export function clampRating(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(5, Math.round(number))) : 0;
}
export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function normalizeCell(value: unknown, column: Column): CellValue {
  if (column.type === 'rating') return clampRating(value);
  if (column.type === 'checkbox') return value === true || /^(true|1|✓)$/i.test(String(value));
  if (value == null) return '';
  return typeof value === 'number' || typeof value === 'boolean' ? value : String(value);
}
export function isSecretColumn(column: Column) { return column.type === 'password' || column.id === 'login_id'; }
export function isTextInput(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"],[role="dialog"]');
}
