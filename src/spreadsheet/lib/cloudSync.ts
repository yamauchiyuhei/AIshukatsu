import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Workbook, Sheet, Row, CellValue, Column } from '../types/sheet';
import {
  decryptString,
  encryptString,
  generateSalt,
  isEncrypted,
} from './crypto';

/**
 * Firestore layout (single doc per user):
 *
 *   users/{uid}/workbook/main
 *     {
 *       version: 2,
 *       workbook: <Workbook JSON, with password cells encrypted as `enc:v1:...`>,
 *       salt: <base64 salt for PBKDF2>,
 *       updatedAt: <serverTimestamp>,
 *       updatedFromClientAt: <ISO string>,
 *     }
 */

interface CloudDoc {
  version: number;
  workbook: Workbook;
  salt: string;
  updatedAt: Timestamp | null;
  updatedFromClientAt: string;
}

function docRefFor(uid: string) {
  if (!db) throw new Error('Firestore is not initialized');
  return doc(db, 'users', uid, 'workbook', 'main');
}

/**
 * Walks all rows; for every column of type=password, runs `transform`
 * over the cell value (string only).
 */
async function mapPasswordCells(
  wb: Workbook,
  transform: (s: string) => Promise<string>,
): Promise<Workbook> {
  const sheets: Sheet[] = [];
  for (const sheet of wb.sheets) {
    const passwordColIds = new Set(
      sheet.columns.filter((c: Column) => c.type === 'password').map((c) => c.id),
    );
    const rows: Row[] = [];
    for (const row of sheet.rows) {
      if (!passwordColIds.size) {
        rows.push(row);
        continue;
      }
      const cells: Record<string, CellValue> = { ...row.cells };
      for (const colId of passwordColIds) {
        const v = cells[colId];
        if (typeof v === 'string' && v) {
          cells[colId] = await transform(v);
        }
      }
      rows.push({ ...row, cells });
    }
    sheets.push({ ...sheet, rows });
  }
  return { ...wb, sheets };
}

export async function encryptWorkbookForCloud(
  wb: Workbook,
  passphrase: string,
  salt: string,
): Promise<Workbook> {
  if (!passphrase) return wb;
  return mapPasswordCells(wb, async (plain) => {
    if (isEncrypted(plain)) return plain;
    return encryptString(plain, passphrase, salt);
  });
}

export async function decryptWorkbookFromCloud(
  wb: Workbook,
  passphrase: string,
  salt: string,
): Promise<Workbook> {
  if (!passphrase) return wb;
  return mapPasswordCells(wb, async (cipher) => {
    if (!isEncrypted(cipher)) return cipher;
    return decryptString(cipher, passphrase, salt);
  });
}

/**
 * Push local workbook to Firestore. Encrypts password cells if a passphrase
 * is supplied. Returns the salt actually used (newly generated if absent).
 */
export async function pushWorkbook(
  uid: string,
  wb: Workbook,
  opts: { passphrase: string | null; salt: string | null },
): Promise<{ salt: string }> {
  const salt = opts.salt ?? generateSalt();
  const encrypted = opts.passphrase
    ? await encryptWorkbookForCloud(wb, opts.passphrase, salt)
    : wb;
  const payload: Omit<CloudDoc, 'updatedAt'> & {
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    version: 2,
    workbook: encrypted,
    salt,
    updatedAt: serverTimestamp(),
    updatedFromClientAt: new Date().toISOString(),
  };
  await setDoc(docRefFor(uid), payload);
  return { salt };
}

export interface PullResult {
  workbook: Workbook;
  salt: string;
  updatedAt: Date | null;
  hadEncrypted: boolean;
}

/**
 * Pull workbook from Firestore. Decrypts password cells if a passphrase is
 * supplied. Returns null when no doc exists yet.
 */
export async function pullWorkbook(
  uid: string,
  passphrase: string | null,
): Promise<PullResult | null> {
  const snap = await getDoc(docRefFor(uid));
  if (!snap.exists()) return null;
  const data = snap.data() as CloudDoc;
  const wb = data.workbook;
  const salt = data.salt ?? generateSalt();

  // Detect whether any password cell looks encrypted (so caller can prompt for passphrase)
  let hadEncrypted = false;
  for (const sheet of wb.sheets ?? []) {
    const passCols = (sheet.columns ?? []).filter((c) => c.type === 'password');
    for (const r of sheet.rows ?? []) {
      for (const c of passCols) {
        if (isEncrypted(r.cells?.[c.id])) {
          hadEncrypted = true;
          break;
        }
      }
      if (hadEncrypted) break;
    }
    if (hadEncrypted) break;
  }

  const decrypted =
    passphrase && hadEncrypted
      ? await decryptWorkbookFromCloud(wb, passphrase, salt)
      : wb;

  const updatedAt =
    data.updatedAt && typeof data.updatedAt.toDate === 'function'
      ? data.updatedAt.toDate()
      : data.updatedFromClientAt
        ? new Date(data.updatedFromClientAt)
        : null;

  return { workbook: decrypted, salt, updatedAt, hadEncrypted };
}
