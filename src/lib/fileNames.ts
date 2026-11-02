export function validateFileName(raw: string): string | null {
  const name = raw.trim();
  if (!name || name === '.' || name === '..') return '名前を入力してください。';
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(name) || /[. ]$/.test(raw)) return 'この名前はWindows・Macで使用できません。末尾の点や空白も除いてください。';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) return 'Windowsで予約されている名前です。別の名前を入力してください。';
  if (new TextEncoder().encode(name).length > 240) return '名前が長すぎます。短くしてください。';
  return null;
}
