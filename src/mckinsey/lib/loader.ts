import { decryptJson, type EncryptedBlob } from '../../lib/crypto';
import type { Question } from '../types';

let cached: Question[] | null = null;

export async function loadInterview(password: string): Promise<Question[]> {
  if (cached) return cached;
  const res = await fetch('data/interview/mckinsey.enc.json');
  if (!res.ok) throw new Error(`データ取得に失敗しました (${res.status})`);
  const blob = (await res.json()) as EncryptedBlob;
  const items = await decryptJson<Question[]>(blob, password);
  cached = items;
  return items;
}

export function clearInterviewCache(): void {
  cached = null;
}
