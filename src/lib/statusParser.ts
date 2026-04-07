import { STATUS_VALUES, Status } from '../types';

const STATUS_SET: ReadonlySet<string> = new Set(STATUS_VALUES);

function isStatus(v: string): v is Status {
  return STATUS_SET.has(v);
}

/**
 * Parse the current status from a 選考フロー・ステータス.md body.
 * Looks for a markdown blockquote line like:
 *   > **未応募**
 * The first matching line wins. Also extracts the flow line if present:
 *   `未応募` → `エントリー済` → ...
 */
export function parseStatus(body: string): {
  status: Status | null;
  flow?: Status[];
} {
  let status: Status | null = null;
  const flow: Status[] = [];

  const lines = body.split(/\r?\n/);

  for (const line of lines) {
    if (status === null) {
      const m = line.match(/^>\s*\*\*(.+?)\*\*/);
      if (m) {
        const candidate = m[1].trim();
        if (isStatus(candidate)) {
          status = candidate;
        }
      }
    }
    // Try to extract status flow from inline-code arrow chains
    if (flow.length === 0 && line.includes('`') && line.includes('→')) {
      const codes = Array.from(line.matchAll(/`([^`]+)`/g)).map((m) =>
        m[1].trim(),
      );
      const matched = codes.filter(isStatus);
      if (matched.length >= 3) {
        flow.push(...matched);
      }
    }
  }

  return { status, flow: flow.length > 0 ? flow : undefined };
}

/**
 * Replace the blockquote status line with a new value, leaving the rest of the
 * file untouched. If no blockquote exists, the body is returned unchanged.
 */
export function replaceStatus(body: string, newStatus: Status): string {
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^>\s*\*\*(.+?)\*\*/.test(lines[i])) {
      lines[i] = `> **${newStatus}**`;
      return lines.join('\n');
    }
  }
  return body;
}
