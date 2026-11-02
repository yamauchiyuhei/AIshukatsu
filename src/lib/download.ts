import { trackFileOperation } from './saveQueue';
import { isTauri } from './tauriFsaShim';
export async function downloadBlob(blob: Blob, name: string) {
  if (isTauri()) {
    const [{ save }, { writeFile }] = await Promise.all([import('@tauri-apps/plugin-dialog'), import('@tauri-apps/plugin-fs')]);
    const path = await save({ defaultPath: name, title: '保存先を選択' });
    if (!path) return false;
    const bytes=new Uint8Array(await blob.arrayBuffer());
    await trackFileOperation(()=>writeFile(path,bytes));
    return true;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
