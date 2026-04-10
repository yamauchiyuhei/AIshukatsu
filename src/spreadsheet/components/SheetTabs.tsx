import { useRef, useState } from 'react';
import { Plus, MoreHorizontal } from 'lucide-react';
import { useSheet } from '../lib/store';
import { confirmDialog, toast } from './Toast';
import { Popover } from './Popover';

export function SheetTabs() {
  const sheets = useSheet((s) => s.workbook.sheets);
  const activeSheetId = useSheet((s) => s.workbook.activeSheetId);
  const switchSheet = useSheet((s) => s.switchSheet);
  const addSheet = useSheet((s) => s.addSheet);
  const renameSheet = useSheet((s) => s.renameSheet);
  const deleteSheet = useSheet((s) => s.deleteSheet);
  const duplicateSheet = useSheet((s) => s.duplicateSheet);

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200/70 bg-white/40 px-5 py-1.5 backdrop-blur">
      {sheets.map((s) => (
        <SheetTab
          key={s.id}
          id={s.id}
          name={s.name}
          active={s.id === activeSheetId}
          canDelete={sheets.length > 1}
          onSwitch={() => switchSheet(s.id)}
          onRename={(name) => renameSheet(s.id, name)}
          onDuplicate={() => duplicateSheet(s.id)}
          onDelete={() => deleteSheet(s.id)}
        />
      ))}
      <button
        onClick={() => addSheet()}
        className="ml-1 flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] text-slate-500 hover:bg-white/70 hover:text-indigo-600"
        title="シートを追加"
      >
        <Plus size={12} /> シート
      </button>
    </div>
  );
}

interface SheetTabProps {
  id: string;
  name: string;
  active: boolean;
  canDelete: boolean;
  onSwitch: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function SheetTab({
  name,
  active,
  canDelete,
  onSwitch,
  onRename,
  onDuplicate,
  onDelete,
}: SheetTabProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative shrink-0">
      <div
        className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-medium transition ${
          active
            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70'
            : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
        }`}
      >
        <button
          type="button"
          onClick={onSwitch}
          onDoubleClick={() => {
            const n = window.prompt('シート名を変更', name);
            if (n && n.trim()) onRename(n.trim());
          }}
          className="whitespace-nowrap"
        >
          {name}
        </button>
        <button
          ref={menuBtnRef}
          type="button"
          className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
        >
          <MoreHorizontal size={11} />
        </button>
      </div>
      <Popover
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        triggerRef={menuBtnRef}
        align="left"
      >
        <div className="w-40 overflow-hidden rounded-xl border border-slate-200/70 bg-white py-1 text-xs shadow-xl animate-pop-in">
          <button
            className="block w-full whitespace-nowrap px-3 py-1.5 text-left hover:bg-slate-50"
            onClick={() => {
              const n = window.prompt('シート名を変更', name);
              if (n && n.trim()) onRename(n.trim());
              setMenuOpen(false);
            }}
          >
            名前を変更
          </button>
          <button
            className="block w-full whitespace-nowrap px-3 py-1.5 text-left hover:bg-slate-50"
            onClick={() => {
              onDuplicate();
              setMenuOpen(false);
              toast.success('シートを複製しました');
            }}
          >
            複製
          </button>
          {canDelete && (
            <button
              className="block w-full whitespace-nowrap px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50"
              onClick={async () => {
                setMenuOpen(false);
                const ok = await confirmDialog(
                  `シート「${name}」を削除します。データも消えます。`,
                  { title: 'シートを削除', destructive: true, okLabel: '削除' },
                );
                if (ok) {
                  onDelete();
                  toast.info('シートを削除しました');
                }
              }}
            >
              削除
            </button>
          )}
        </div>
      </Popover>
    </div>
  );
}
