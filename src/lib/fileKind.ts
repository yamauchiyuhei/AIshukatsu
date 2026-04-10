/**
 * Centralised filename → {@link FileKind} classifier used by the file tree
 * (for icons), the tab system (for choosing which viewer to mount), and the
 * workspace scanner (for deciding whether a given entry should appear in the
 * tree at all).
 *
 * Markdown remains the only *editable* kind; everything else is rendered in
 * a read-only viewer.
 */

export type FileKind =
  | 'markdown'   // .md  — editable (existing MarkdownEditor)
  | 'image'      // png/jpg/gif/webp/svg/bmp/ico  — <img>
  | 'pdf'        // .pdf — browser built-in via <iframe>
  | 'text'       // plain text & source files — syntax-highlighted-ish <pre>
  | 'sheet'      // .csv / .xlsx / .xls — rendered as HTML table via xlsx lib
  | 'docx'       // .docx — rendered via mammoth → HTML
  | 'unsupported'; // everything else — fallback with "open externally"

/** Extensions that should render as plain / source text. */
const TEXT_EXT = new Set([
  'txt',
  'log',
  'json',
  'jsonc',
  'yaml',
  'yml',
  'toml',
  'ini',
  'env',
  'xml',
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'less',
  'js',
  'mjs',
  'cjs',
  'jsx',
  'ts',
  'tsx',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'c',
  'h',
  'cpp',
  'cc',
  'hpp',
  'cs',
  'php',
  'sh',
  'zsh',
  'bash',
  'sql',
  'md5',
  'lock',
  'gitignore',
]);

const IMAGE_EXT = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'avif',
]);

const SHEET_EXT = new Set([
  'csv',
  'tsv',
  'xlsx',
  'xls',
  'xlsm',
]);

/** Lowercase extension without the leading dot, or '' if none. */
export function extOf(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

/** Classify a file by name. Falls back to 'unsupported' for unknown types. */
export function getFileKind(name: string): FileKind {
  const ext = extOf(name);
  if (ext === 'md' || ext === 'markdown' || ext === 'mdx') return 'markdown';
  if (IMAGE_EXT.has(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (SHEET_EXT.has(ext)) return 'sheet';
  if (TEXT_EXT.has(ext)) return 'text';
  return 'unsupported';
}

/** Best-effort MIME type for an image file (used for <img> / Blob types). */
export function imageMimeType(name: string): string {
  const ext = extOf(name);
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'bmp':
      return 'image/bmp';
    case 'ico':
      return 'image/x-icon';
    case 'avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}
