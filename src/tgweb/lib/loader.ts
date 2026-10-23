import type { EncryptedBlob, TestType, TgWebItem } from '../types';
import { decryptJson } from '../../lib/crypto';

const cache = new Map<string, TgWebItem[]>();

const cacheKey = (testType: TestType, category: string) =>
  `${testType}:${category}`;

export async function loadCategory(
  testType: TestType,
  category: string,
  password: string,
): Promise<TgWebItem[]> {
  const k = cacheKey(testType, category);
  const cached = cache.get(k);
  if (cached) return cached;
  const res = await fetch(`data/${testType}/${category}.enc.json`);
  if (!res.ok) throw new Error(`データ取得に失敗しました (${res.status})`);
  const blob = (await res.json()) as EncryptedBlob;
  const items = await decryptJson<TgWebItem[]>(blob, password);
  cache.set(k, items);
  return items;
}

export function clearCache(): void {
  cache.clear();
}
