import {
  FileText,
  FileImage,
  FileSpreadsheet,
  FileType2,
  FileCode2,
  FileQuestion,
  File as FileIcon,
  type LucideIcon,
} from 'lucide-react';
import { getFileKind, extOf } from '../lib/fileKind';

/**
 * Shared filename → lucide icon mapping used by both the FileTree (sidebar)
 * and the TabBar (open files). Keeping this in one place means both places
 * stay visually in sync as we add new file kinds.
 */
export function fileIconFor(name: string): LucideIcon {
  const kind = getFileKind(name);
  switch (kind) {
    case 'markdown':
      return FileText;
    case 'image':
      return FileImage;
    case 'pdf':
      // lucide has no dedicated PDF icon; FileType2 reads as "document".
      return FileType2;
    case 'docx':
      return FileType2;
    case 'sheet':
      return FileSpreadsheet;
    case 'text': {
      const ext = extOf(name);
      if (
        [
          'js',
          'ts',
          'tsx',
          'jsx',
          'py',
          'rb',
          'go',
          'rs',
          'java',
          'c',
          'cpp',
          'cs',
          'php',
          'sh',
          'sql',
          'html',
          'css',
        ].includes(ext)
      ) {
        return FileCode2;
      }
      return FileIcon;
    }
    case 'unsupported':
    default:
      return FileQuestion;
  }
}
