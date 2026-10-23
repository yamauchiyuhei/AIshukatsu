// Minimal, dependency-free RFC 4180 CSV codec.
//
// We deliberately do NOT reuse the `xlsx` library for the file-backed source
// of truth: `XLSX.read` runs type inference that silently corrupts the values
// that matter most here — a leading-zero login id "0123" becomes the number
// 123, ISO date strings become Excel date serials, "TRUE" becomes a boolean.
// In a CSV every value is just text; typing is the caller's job (see
// csvStore.ts), so a tiny hand-rolled codec gives byte-stable, git-friendly,
// idempotent round-trips.

const NEEDS_QUOTE = /[",\n\r]/;

/** Quote a single field iff it contains a delimiter/quote/newline or has
 *  leading/trailing whitespace. Escapes embedded quotes by doubling them. */
function quoteField(v: string): string {
  if (v === '') return '';
  const needs = NEEDS_QUOTE.test(v) || v !== v.trim();
  return needs ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Serialize a header row + data rows into an RFC 4180 CSV string.
 * Uses LF line endings, no BOM, and a single trailing newline — chosen for
 * clean git diffs and easy editing by Claude. (Excel prefers CRLF+BOM, but
 * the consumers here are the app, Claude, and git.)
 */
export function serializeCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(quoteField).join(',')];
  for (const row of rows) lines.push(row.map(quoteField).join(','));
  return lines.join('\n') + '\n';
}

/**
 * Parse an RFC 4180 CSV string. Tolerates a leading BOM and CRLF / CR / LF
 * line endings, and correctly handles quoted fields containing commas,
 * quotes, and newlines. A trailing newline does NOT produce a phantom empty
 * record. Returns the first record as `headers` and the rest as `rows`.
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  let s = text;
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // strip BOM

  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  // Tracks whether the in-progress record has any content, so EOF after a
  // trailing newline doesn't emit a spurious empty record.
  let pending = false;

  const endField = () => {
    record.push(field);
    field = '';
  };
  const endRecord = () => {
    endField();
    records.push(record);
    record = [];
    pending = false;
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      pending = true;
    } else if (c === ',') {
      pending = true;
      endField();
    } else if (c === '\n') {
      endRecord();
    } else if (c === '\r') {
      if (s[i + 1] === '\n') i++; // CRLF
      endRecord();
    } else {
      field += c;
      pending = true;
    }
  }
  if (pending || field !== '' || record.length > 0) endRecord();

  if (records.length === 0) return { headers: [], rows: [] };
  const [headers, ...rows] = records;
  return { headers, rows };
}
