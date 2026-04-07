import { CompanyFrontMatter, STATUS_FILE } from '../types';
import { serializeStatusFile } from './frontmatter';

export function buildStatusFile(companyName: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const fm: CompanyFrontMatter = {
    status: '未エントリー',
    company_name: companyName,
    created_at: today,
    updated_at: today,
  };
  const body = `# 選考状況

## 現在のステータス
未エントリー

## これまでの経緯
- ${today} 企業を追加

## 次のアクション
-
`;
  return serializeStatusFile(fm, body);
}

const COMPANY_ANALYSIS = `# 企業分析

## 事業内容


## 企業規模・基本情報
- 設立:
- 従業員数:
- 売上:
- 本社:

## 業界ポジション


## 強み


## 弱み・リスク


## 競合


## 自分との接点・志望理由メモ

`;

const ES_INTERVIEW = `# ES・面接対策

## 提出したES
### 設問1


## 想定質問
-

## 面接振り返り
### 一次面接 (YYYY-MM-DD)
- 質問:
- 回答:
- 反省:

`;

const SEMINAR_NOTE = `# 説明会・イベントメモ

## 参加日


## 登壇者


## 印象に残った話


## 質問したこと / 質問したいこと

`;

const INTERN_NOTE = `# インターン

## 参加期間


## プログラム内容


## 学んだこと


## 出会った人

`;

export interface TemplateFile {
  name: string;
  content: string;
}

export function buildDefaultTemplates(companyName: string): TemplateFile[] {
  return [
    { name: STATUS_FILE, content: buildStatusFile(companyName) },
    { name: '企業分析.md', content: COMPANY_ANALYSIS },
    { name: 'ES・面接対策.md', content: ES_INTERVIEW },
    { name: '説明会・イベントメモ.md', content: SEMINAR_NOTE },
    { name: 'インターン.md', content: INTERN_NOTE },
  ];
}
