import { COMPANY_TEMPLATE_DIR, TEMPLATE_DIR } from '../types';
import { listMarkdownFiles, readTextFile } from './fs';

async function findSubdirectory(
  root: FileSystemDirectoryHandle,
  targetName: string,
): Promise<FileSystemDirectoryHandle | null> {
  const target = targetName.normalize('NFC');
  for await (const entry of root.values()) {
    if (
      entry.kind === 'directory' &&
      entry.name.normalize('NFC') === target
    ) {
      return entry as FileSystemDirectoryHandle;
    }
  }
  return null;
}

export interface CompanyTemplateFile {
  name: string;       // ファイル名 (例: "選考フロー・ステータス.md")
  content: string;    // 生テキスト (プレースホルダ未置換)
}

const FALLBACK_TEMPLATES: CompanyTemplateFile[] = [
  {
    name: '選考フロー・ステータス.md',
    content: `# 選考フロー・ステータス：【企業名】

## 現在のステータス
> **未応募**

\`未応募\` → \`エントリー済\` → \`ES提出済\` → \`Webテスト\` → \`1次面接\` → \`2次面接\` → \`最終面接\` → \`内定\` / \`お祈り\`

## 締切日一覧
| 項目 | 締切日 | 状態 |
|------|--------|------|
| エントリー |  | 未 |
| ES提出 |  | 未 |
| Webテスト |  | 未 |
| 1次面接 |  | 未 |
| 2次面接 |  | 未 |
| 最終面接 |  | 未 |

## メモ
-
`,
  },
  {
    name: '企業分析.md',
    content: `# 企業分析：【企業名】

## 基本情報
- 正式名称：
- 業種：
- 設立：
- 本社所在地：
- 従業員数：
- 売上高：

## 事業内容
-

## 強み
-

## 弱み・課題
-

## メモ
-
`,
  },
  {
    name: 'ES・面接対策.md',
    content: `# ES・面接対策：【企業名】

## 志望動機


## ガクチカ


## 自己PR


## メモ
-
`,
  },
  {
    name: 'インターン.md',
    content: `# インターン：【企業名】

## 応募状況
- 応募日：
- 結果：

## 内容メモ


## メモ
-
`,
  },
  {
    name: '説明会・イベントメモ.md',
    content: `# 説明会・イベントメモ：【企業名】

## 参加イベント一覧
| 日付 | イベント名 | 形式 | 参加済 |
|------|-----------|------|--------|
|      |           |      | [ ]    |

## メモ
-
`,
  },
];

/**
 * Load company-creation templates from `_テンプレート/企業名_テンプレート/`.
 * Falls back to a hard-coded set if the directory is missing.
 */
export async function loadCompanyTemplates(
  root: FileSystemDirectoryHandle,
): Promise<CompanyTemplateFile[]> {
  try {
    const tplDir = await findSubdirectory(root, TEMPLATE_DIR);
    if (!tplDir) {
      console.warn('_テンプレート directory not found, using fallbacks');
      return FALLBACK_TEMPLATES;
    }
    const companyTplDir = await findSubdirectory(tplDir, COMPANY_TEMPLATE_DIR);
    if (!companyTplDir) {
      console.warn('企業名_テンプレート directory not found, using fallbacks');
      return FALLBACK_TEMPLATES;
    }
    const fileNames = await listMarkdownFiles(companyTplDir);
    if (fileNames.length === 0) {
      console.warn('企業名_テンプレート is empty, using fallbacks');
      return FALLBACK_TEMPLATES;
    }
    const files = await Promise.all(
      fileNames.map(async (name) => ({
        name,
        content: await readTextFile(companyTplDir, name),
      })),
    );
    return files;
  } catch (e) {
    console.warn('Failed to load templates from user folder, using fallbacks:', e);
    return FALLBACK_TEMPLATES;
  }
}

/**
 * Substitute the 【企業名】 placeholder with the actual company name.
 */
export function materializeTemplate(
  template: CompanyTemplateFile,
  companyName: string,
): string {
  return template.content.replaceAll('【企業名】', companyName);
}
