// File-backed source of truth for the エントリー一覧 spreadsheet.
//
// The primary sheet's rows live in `データ/エントリー一覧.csv` (committed to the
// 就活 git repo, readable & writable by both the app and Claude). Everything a
// flat CSV cannot express — the authoritative column schema, pinned rows, the
// 2nd+ sheets, and login credentials — lives in a hidden, git-ignored sidecar
// `データ/.エントリー一覧.meta.json`.
//
// Credentials (パスワード, ID) are deliberately kept OUT of the CSV so they are
// never pushed to the public GitHub remote; they round-trip through the local
// sidecar instead.

import { CellValue, Column, ColumnType, Row, Sheet, Workbook } from '../types/sheet';
import { createPresetColumns } from './presetColumns';
import {
  createSubdirectory,
  fileExists,
  readTextFile,
  subdirectoryExists,
  writeTextFile,
} from '../../lib/fs';
import { parseCsv, serializeCsv } from './csv';

export const DATA_DIR = 'データ';
export const CSV_NAME = 'エントリー一覧.csv';
export const SIDECAR_NAME = '.エントリー一覧.meta.json';
/** Hash of the sidecar body we last wrote (null right after a load). Lets
 *  saveToCsv persist 2nd+ sheet / credential / pin edits even when the CSV
 *  text is unchanged — otherwise those edits never reach disk and are dropped
 *  on the next reload. */
let lastSidecarHash: string | null = null;
/** Human-facing path used in UI copy. */
export const CSV_DISPLAY_PATH = `${DATA_DIR}/${CSV_NAME}`;

/** A column counts as a credential and is excluded from the committed CSV. */
function isSecret(col: Column): boolean {
  return col.type === 'password' || col.id === 'login_id';
}

interface Sidecar {
  version: 1;
  primarySheetId: string;
  primarySheetName: string;
  primarySheetColor?: string;
  activeSheetId: string;
  /** Full ordered schema for the primary sheet (incl. credential columns). */
  columns: Column[];
  /** 企業名 of pinned rows. */
  pinnedCompanies: string[];
  /** Credential cell values, keyed by 企業名 (never written to the CSV). */
  secrets: { company: string; cells: Record<string, CellValue> }[];
  /** 2nd+ sheets, stored in full (local-only, so secrets may be inline). */
  extraSheets: Sheet[];
  lastWriteHash: string;
  lastWriteAt: string;
}

/* ----------------------------- id helpers ------------------------------ */

let idCounter = 0;
function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${(idCounter++).toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/* --------------------------- value helpers ----------------------------- */

function defaultForType(t: ColumnType): CellValue {
  if (t === 'rating') return 0;
  if (t === 'checkbox') return false;
  return '';
}

/** CellValue → CSV text. Strings pass through; booleans/numbers normalized so
 *  that load→save is byte-stable (idempotent). */
function stringifyCell(value: CellValue, type: ColumnType): string {
  if (value === null || value === undefined) return '';
  if (type === 'checkbox') return value === true || value === 'true' ? 'true' : '';
  if (type === 'rating') {
    const n = typeof value === 'number' ? value : Number(value);
    return n ? String(n) : '';
  }
  if (typeof value === 'boolean') return value ? 'true' : '';
  return String(value);
}

/** CSV text → CellValue, typed by the resolved column. Dates/urls/selects stay
 *  opaque strings (no numeric/date coercion — that's what corrupts round-trips). */
function coerceCell(raw: string, type: ColumnType): CellValue {
  const s = raw ?? '';
  if (type === 'checkbox') return /^true$/i.test(s.trim());
  if (type === 'rating') {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  return s;
}

/* ------------------------------ hashing -------------------------------- */

async function computeHash(text: string): Promise<string> {
  // Content hash (not file mtime/size) — the Tauri FS shim stubs those out.
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* --------------------------- dir / sidecar ----------------------------- */

async function getDataDir(
  root: FileSystemDirectoryHandle,
  create: boolean,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (create) return await createSubdirectory(root, DATA_DIR);
    if (!(await subdirectoryExists(root, DATA_DIR))) return null;
    return await root.getDirectoryHandle(DATA_DIR);
  } catch {
    return null;
  }
}

async function readSidecar(
  dataDir: FileSystemDirectoryHandle,
): Promise<Sidecar | null> {
  try {
    if (!(await fileExists(dataDir, SIDECAR_NAME))) return null;
    const obj = JSON.parse(await readTextFile(dataDir, SIDECAR_NAME));
    return obj && obj.version === 1 ? (obj as Sidecar) : null;
  } catch {
    return null;
  }
}

/* ----------------------- column reconstruction ------------------------- */

/**
 * Resolve the primary sheet's full column schema. The sidecar is authoritative
 * (preserves types, roles, options, renames, custom & credential columns);
 * any CSV header not in the schema is appended as a new text column (Claude
 * added a field). Without a sidecar, fall back to preset name-matching.
 */
function resolvePrimaryColumns(headers: string[], sidecar: Sidecar | null): Column[] {
  if (sidecar?.columns?.length) {
    const cols = sidecar.columns.map((c) => ({ ...c }));
    for (const h of headers) {
      if (h && !cols.some((c) => c.name === h)) {
        cols.push({ id: genId('c'), name: h, type: 'text', width: 130 });
      }
    }
    return cols;
  }
  // Degraded path (sidecar missing): rebuild from presets by header name.
  const presets = createPresetColumns();
  const cols: Column[] = [];
  for (const h of headers) {
    const match = presets.find((c) => c.name === h);
    cols.push(match ? { ...match } : { id: genId('c'), name: h || `列${cols.length + 1}`, type: 'text', width: 130 });
  }
  // Keep credential columns present (their values are lost without a sidecar,
  // but the columns themselves shouldn't vanish from the grid).
  for (const p of presets) {
    if (isSecret(p) && !cols.some((c) => c.id === p.id)) cols.push({ ...p });
  }
  return cols;
}

function companyColIdOf(columns: Column[]): string {
  return columns.find((c) => c.role === 'company')?.id ?? 'company';
}

/* -------------------------------- load --------------------------------- */

export async function loadFromCsv(
  root: FileSystemDirectoryHandle,
): Promise<{ workbook: Workbook; signature: string } | null> {
  try {
    const dataDir = await getDataDir(root, false);
    if (!dataDir || !(await fileExists(dataDir, CSV_NAME))) return null;

    const csvText = await readTextFile(dataDir, CSV_NAME);
    const { headers, rows } = parseCsv(csvText);
    const sidecar = await readSidecar(dataDir);
    lastSidecarHash = null;

    const columns = resolvePrimaryColumns(headers, sidecar);
    // CSV header index → colId (non-secret columns only; secret-named headers
    // are intentionally ignored so credentials never enter via the CSV).
    const headerColIds = headers.map((h) => {
      const col = columns.find((c) => c.name === h && !isSecret(c));
      return col ? col.id : null;
    });

    const companyColId = companyColIdOf(columns);
    const secretsByCompany = new Map<string, Record<string, CellValue>>();
    for (const s of sidecar?.secrets ?? []) secretsByCompany.set(s.company, s.cells);
    const pinned = new Set((sidecar?.pinnedCompanies ?? []).filter(Boolean));

    const sheetRows: Row[] = [];
    for (const arr of rows) {
      if (arr.every((v) => (v ?? '') === '')) continue; // skip blank lines
      const cells: Record<string, CellValue> = {};
      for (const c of columns) cells[c.id] = defaultForType(c.type);
      for (let j = 0; j < headerColIds.length; j++) {
        const colId = headerColIds[j];
        if (!colId) continue;
        const col = columns.find((c) => c.id === colId)!;
        cells[colId] = coerceCell(arr[j] ?? '', col.type);
      }
      const company = String(cells[companyColId] ?? '');
      const sec = secretsByCompany.get(company);
      if (sec) for (const [k, v] of Object.entries(sec)) cells[k] = v;
      const row: Row = { id: genId('r'), cells };
      if (company && pinned.has(company)) row.pinned = true;
      sheetRows.push(row);
    }

    const primaryId = sidecar?.primarySheetId ?? genId('s');
    const primary: Sheet = {
      id: primaryId,
      name: sidecar?.primarySheetName ?? '本選考',
      ...(sidecar?.primarySheetColor ? { color: sidecar.primarySheetColor } : {}),
      columns,
      rows: sheetRows,
    };
    const sheets = [primary, ...(sidecar?.extraSheets ?? [])];
    const activeSheetId = sheets.some((s) => s.id === sidecar?.activeSheetId)
      ? sidecar!.activeSheetId
      : primaryId;

    return {
      workbook: { version: 2, sheets, activeSheetId },
      signature: await computeHash(csvText),
    };
  } catch (e) {
    console.error('[csvStore] loadFromCsv failed', e);
    return null;
  }
}

/* -------------------------------- save --------------------------------- */

export async function saveToCsv(
  root: FileSystemDirectoryHandle,
  workbook: Workbook,
  prevSignature?: string | null,
): Promise<{ signature: string; skipped?: boolean } | null> {
  try {
    const primary = workbook.sheets[0];
    if (!primary) return null;
    const cols = primary.columns;
    const visible = cols.filter((c) => !isSecret(c));

    const headers = visible.map((c) => c.name);
    const rows = primary.rows.map((r) =>
      visible.map((c) => stringifyCell(r.cells[c.id], c.type)),
    );
    const csvText = serializeCsv(headers, rows);
    const signature = await computeHash(csvText);
    // Idempotency: never rewrite identical content (avoids needless disk I/O
    // and spurious git diffs when only non-persisted UI state changed).
    const csvUnchanged = !!prevSignature && signature === prevSignature;

    const companyColId = companyColIdOf(cols);
    const secretCols = cols.filter(isSecret);
    const secrets: Sidecar['secrets'] = [];
    for (const r of primary.rows) {
      const company = String(r.cells[companyColId] ?? '');
      if (!company) continue;
      const cells: Record<string, CellValue> = {};
      let any = false;
      for (const sc of secretCols) {
        const v = r.cells[sc.id];
        if (v !== undefined && v !== null && v !== '') {
          cells[sc.id] = v;
          any = true;
        }
      }
      if (any) secrets.push({ company, cells });
    }

    const sidecarBody: Omit<Sidecar, 'lastWriteHash' | 'lastWriteAt'> = {
      version: 1,
      primarySheetId: primary.id,
      primarySheetName: primary.name,
      ...(primary.color ? { primarySheetColor: primary.color } : {}),
      activeSheetId: workbook.activeSheetId,
      columns: cols,
      pinnedCompanies: primary.rows
        .filter((r) => r.pinned)
        .map((r) => String(r.cells[companyColId] ?? ''))
        .filter(Boolean),
      secrets,
      extraSheets: workbook.sheets.slice(1),
    };
    // The sidecar carries state the CSV does not (2nd+ sheets, credentials,
    // pins). Skip only when *both* are unchanged.
    const sidecarHash = await computeHash(JSON.stringify(sidecarBody));
    const sidecarUnchanged = lastSidecarHash !== null && sidecarHash === lastSidecarHash;
    if (csvUnchanged && sidecarUnchanged) return { signature, skipped: true };
    const sidecar: Sidecar = {
      ...sidecarBody,
      lastWriteHash: signature,
      lastWriteAt: new Date().toISOString(),
    };

    const dataDir = await createSubdirectory(root, DATA_DIR);
    if (!csvUnchanged) await writeTextFile(dataDir, CSV_NAME, csvText);
    await writeTextFile(dataDir, SIDECAR_NAME, JSON.stringify(sidecar, null, 2));
    lastSidecarHash = sidecarHash;
    return { signature };
  } catch (e) {
    console.error('[csvStore] saveToCsv failed', e);
    return null;
  }
}

/* ----------------------- external-change detection --------------------- */

/** SHA-256 of the on-disk CSV, or null if absent/unreadable. Used to detect
 *  edits made by Claude (or anything else) outside the app. */
export async function readCsvSignature(
  root: FileSystemDirectoryHandle,
): Promise<string | null> {
  try {
    const dataDir = await getDataDir(root, false);
    if (!dataDir || !(await fileExists(dataDir, CSV_NAME))) return null;
    return await computeHash(await readTextFile(dataDir, CSV_NAME));
  } catch {
    return null;
  }
}
