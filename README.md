# AIsyuukatsu

ローカルの Markdown ファイル群を **AI と人間の共通言語** として扱う就活管理アプリ。

1 企業 = 1 フォルダ、各種メモは `.md` ファイル。データはすべてあなたの PC に残るので、そのまま Claude や Cursor 等の AI にフォルダを渡せます。ベンダーロックインなし。

## 特徴

- **ローカルファースト**: DB なし。`File System Access API` でフォルダを直接読み書き
- **Frontmatter で選考状態を管理**: 一覧画面のメタデータは `選考状況.md` の YAML Frontmatter から読む
- **WYSIWYG 編集**: Milkdown による Notion 風の Markdown エディタ
- **自動保存**: 1 秒 debounce で書き込み
- **新規企業でテンプレ自動生成**: 選考状況 / 企業分析 / ES・面接対策 / 説明会・イベントメモ / インターン の 5 ファイル

## フォルダ構成の例

```
就活2026/
├── 株式会社サンプルA/
│   ├── 選考状況.md        ← Frontmatter にステータス等
│   ├── 企業分析.md
│   ├── ES・面接対策.md
│   ├── 説明会・イベントメモ.md
│   └── インターン.md
└── 株式会社サンプルB/
    └── ...
```

`選考状況.md` の冒頭:

```markdown
---
status: 一次面接
next_action_date: 2026-04-15
next_action_label: 一次面接
company_name: 株式会社サンプルA
created_at: 2026-04-01
updated_at: 2026-04-07
---

# 選考状況
...
```

## 対応ブラウザ

Chrome / Edge など **Chromium 系のみ**。Safari / Firefox は File System Access API 非対応のため動きません。

## 開発

```bash
npm install
npm run dev    # http://localhost:5173
npm run build
```

## 技術スタック

- Vite + React 18 + TypeScript
- Tailwind CSS
- Milkdown (commonmark + gfm + nord)
- gray-matter
- idb-keyval
- lucide-react

## ステータス

Phase 1 (MVP) 実装済み:

- [x] フォルダ選択と permission 永続化
- [x] 企業一覧 (テーブル、ソート)
- [x] 企業詳細画面 (ファイル一覧 + WYSIWYG 編集 + 自動保存)
- [x] 新規企業追加 (テンプレ自動生成)

未実装 (Phase 2 以降):

- [ ] カンバン表示 + D&D でのステータス変更
- [ ] ファイル追加・削除 UI
- [ ] フィルタ
- [ ] デザイン磨き込み / ダークモード
- [ ] 公開用ホスティング
