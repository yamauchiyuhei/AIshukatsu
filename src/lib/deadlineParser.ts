/**
 * Parses the `## 締切日一覧` markdown table inside a 選考フロー・ステータス.md body.
 *
 * Expected shape:
 *   ## 締切日一覧
 *   | 項目 | 締切日 | 状態 |
 *   |------|--------|------|
 *   | エントリー |  | 未 |
 *   | ES提出 | 2026-04-15 | 未 |
 *   ...
 */

export interface DeadlineRow {
  item: string;        // "エントリー" / "ES提出" / "1次面接" 等
  date: string | null; // YYYY-MM-DD など。空なら null
  state: string;       // "未" / "済" / "完了" 等
  rowIndex: number;    // 元 md における (テーブル先頭からの) 行 index
}

const TABLE_HEADER_RE = /##\s*締切日一覧/;

export function parseDeadlines(body: string): DeadlineRow[] {
  const lines = body.split(/\r?\n/);
  let inTable = false;
  let dataStart = false;
  const rows: DeadlineRow[] = [];
  let dataIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inTable) {
      if (TABLE_HEADER_RE.test(line)) {
        inTable = true;
      }
      continue;
    }
    // Inside the table now: skip until first table row, then read data rows
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      // header row, divider row, or data row
      if (!dataStart) {
        // First | line is header. Next | line is divider. After that → data.
        // We track via a counter.
        if (trimmed.includes('項目') || /^\|\s*-+/.test(trimmed)) {
          // header or divider — keep inTable, mark dataStart only after divider seen
          if (/^\|\s*-+/.test(trimmed) || trimmed.includes('---')) {
            dataStart = true;
          }
          continue;
        }
        // Could be that there's no header (lenient parsing) — treat as data
      }
      // Data row
      const cells = trimmed
        .split('|')
        .slice(1, -1) // strip leading/trailing empty splits
        .map((c) => c.trim());
      if (cells.length >= 1) {
        const item = cells[0] ?? '';
        const date = cells[1] ?? '';
        const state = cells[2] ?? '';
        if (item) {
          rows.push({
            item,
            date: date || null,
            state: state || '',
            rowIndex: dataIndex,
          });
          dataIndex++;
        }
      }
    } else if (trimmed === '') {
      // Empty line: keep parsing in case of weird formatting, but if we already have rows, end here
      if (rows.length > 0) break;
    } else if (trimmed.startsWith('#')) {
      // Next heading → end of table
      break;
    }
  }

  return rows;
}

/**
 * Update a deadline row by item name. Pass `date` and/or `state` to overwrite
 * those fields; omitted fields are preserved. Returns the new body string,
 * or the original body if the row was not found.
 */
export function replaceDeadlineRow(
  body: string,
  itemName: string,
  patch: { date?: string | null; state?: string },
): string {
  const lines = body.split(/\r?\n/);
  let inTable = false;
  let dataStart = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inTable) {
      if (TABLE_HEADER_RE.test(line)) inTable = true;
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      if (trimmed === '' && dataStart) continue;
      if (trimmed.startsWith('#')) break;
      continue;
    }
    if (!dataStart) {
      if (/^\|\s*-+/.test(trimmed) || trimmed.includes('---')) {
        dataStart = true;
      }
      continue;
    }
    const cells = trimmed.split('|').slice(1, -1).map((c) => c.trim());
    if (cells[0] === itemName) {
      const item = cells[0];
      const currentDate = cells[1] ?? '';
      const currentState = cells[2] ?? '未';
      const nextDate =
        patch.date === undefined ? currentDate : (patch.date ?? '');
      const nextState = patch.state === undefined ? currentState : patch.state;
      lines[i] = `| ${item} | ${nextDate} | ${nextState} |`;
      return lines.join('\n');
    }
  }
  return body;
}
