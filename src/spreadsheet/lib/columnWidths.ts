const KEY = 'shukatsu-col-widths-v1';

type WidthMap = Record<string, number>;

export function loadWidths(): WidthMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as WidthMap;
  } catch {
    return {};
  }
}

export function saveWidth(colId: string, width: number) {
  try {
    const map = loadWidths();
    map[colId] = Math.round(width);
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getWidth(colId: string, fallback: number): number {
  const map = loadWidths();
  return map[colId] ?? fallback;
}
