import { useState } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import { Modal } from './components/ui/Modal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { RenameDialog } from './components/RenameDialog';

/**
 * Temporary visual showcase of the UI/UX upgrade primitives.
 * Mounted when the URL hash is `#ui`. Does not affect production routes.
 */
export function UiShowcase() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [plainModalOpen, setPlainModalOpen] = useState(false);
  const [items, setItems] = useState<string[]>([
    '株式会社A - 一次面接メモ.md',
    '株式会社B - ES下書き.md',
    '業界研究.md',
  ]);
  const [listRef] = useAutoAnimate<HTMLUListElement>({ duration: 180 });

  const addItem = () =>
    setItems((prev) => [`新規ファイル_${prev.length + 1}.md`, ...prev]);
  const removeItem = (i: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="min-h-screen bg-slate-50 p-10">
      <div className="mx-auto max-w-4xl space-y-10">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-2"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
            <Sparkles size={12} className="text-indigo-500" />
            UI/UX アップグレード プレビュー
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            新 UI 部品ショーケース
          </h1>
          <p className="text-sm text-slate-600">
            shadcn 互換トークン / Framer Motion / Auto-Animate を統合。
          </p>
        </motion.header>

        {/* Buttons */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Button — 6 バリアント × 4 サイズ
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button>Default</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="追加">
              <Plus size={16} />
            </Button>
          </div>
        </section>

        {/* Input */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Input — フォーカスリング対応
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="例: 株式会社サンプル" />
            <Input placeholder="無効状態" disabled defaultValue="disabled" />
          </div>
        </section>

        {/* Modals */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Modal / Dialog — Framer Motion でイン/アウト
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPlainModalOpen(true)}>
              汎用 Modal を開く
            </Button>
            <Button onClick={() => setRenameOpen(true)}>RenameDialog</Button>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              ConfirmDialog (destructive)
            </Button>
          </div>
        </section>

        {/* Auto-animate list */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Auto-Animate — FileTree に適用中のリスト挙動
            </h2>
            <Button size="sm" onClick={addItem}>
              <Plus size={14} />
              追加
            </Button>
          </div>
          <ul ref={listRef} className="space-y-1">
            {items.map((name, i) => (
              <li
                key={name}
                className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm text-slate-700"
              >
                <span className="truncate">{name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(i)}
                  aria-label="削除"
                  className="h-7 w-7 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <footer className="pb-6 text-center text-xs text-slate-400">
          URL から <code>#ui</code> を外すと通常アプリに戻ります
        </footer>
      </div>

      {/* Mount dialogs */}
      <Modal
        open={plainModalOpen}
        onClose={() => setPlainModalOpen(false)}
        ariaLabel="汎用モーダル"
      >
        <h3 className="text-base font-semibold text-slate-900">
          汎用 Modal コンポーネント
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          バックドロップは軽くぼかし、パネルはイージング付きでスケールインします。
          Escape / 背景クリックで閉じます。
        </p>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => setPlainModalOpen(false)}>閉じる</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="このファイルを削除しますか？"
        message={'削除すると元に戻せません。\n本当に実行しますか？'}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
      />

      <RenameDialog
        open={renameOpen}
        initialName="企業研究メモ.md"
        onCancel={() => setRenameOpen(false)}
        onSubmit={async () => {
          await new Promise((r) => setTimeout(r, 400));
          setRenameOpen(false);
        }}
      />
    </div>
  );
}
