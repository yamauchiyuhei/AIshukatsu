import { useRef, useState } from 'react';
import {
  BookmarkPlus,
  CalendarDays,
  Columns3,
  Download,
  Filter,
  KanbanSquare,
  Search,
  Table,
  Upload,
  X,
} from 'lucide-react';
import { useSheet, getActiveSheet } from '../lib/store';
import { ViewMode } from '../types/sheet';
import { exportToCsv, exportToXlsx, importFromFile } from '../lib/importExport';
import { ColumnAddModal } from './ColumnAddModal';
import { confirmDialog, toast } from './Toast';
import { AuthButton } from './AuthButton';
import { Popover } from './Popover';

interface Props {
  onOpenPalette: () => void;
}

export function Toolbar({ onOpenPalette }: Props) {
  const view = useSheet((s) => s.view);
  const setView = useSheet((s) => s.setView);
  const search = useSheet((s) => s.searchQuery);
  const setSearch = useSheet((s) => s.setSearch);
  const fIndustry = useSheet((s) => s.filterIndustry);
  const setFIndustry = useSheet((s) => s.setFilterIndustry);
  const fStatus = useSheet((s) => s.filterStatus);
  const setFStatus = useSheet((s) => s.setFilterStatus);
  const sheet = useSheet((s) => getActiveSheet(s));
  const replaceActiveSheet = useSheet((s) => s.replaceActiveSheet);

  const savedViews = useSheet((s) => s.savedViews);
  const activeViewId = useSheet((s) => s.activeViewId);
  const applySavedView = useSheet((s) => s.applySavedView);
  const saveCurrentAsView = useSheet((s) => s.saveCurrentAsView);
  const deleteSavedView = useSheet((s) => s.deleteSavedView);

  const [showAddCol, setShowAddCol] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const viewsBtnRef = useRef<HTMLButtonElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);

  const industryOptions = (sheet.columns.find((c) => c.id === 'industry')?.options ??
    []) as string[];
  const statusOptions = (sheet.columns.find((c) => c.id === 'status')?.options ?? []) as string[];

  const onImport = async (file: File) => {
    try {
      const data = await importFromFile(file, sheet.columns);
      const ok = await confirmDialog(
        `${data.rows.length} 行をインポートします。現在の ${sheet.rows.length} 行は置き換えられます。`,
        { title: 'インポート', okLabel: 'インポート', destructive: true },
      );
      if (ok) {
        replaceActiveSheet(data);
        toast.success(`${data.rows.length} 行をインポートしました`);
      }
    } catch (e) {
      toast.error(`インポートに失敗: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleSaveView = async () => {
    const name = window.prompt('ビュー名を入力');
    if (name && name.trim()) {
      saveCurrentAsView(name.trim());
      toast.success(`ビュー「${name.trim()}」を保存しました`);
    }
  };

  return (
    <>
      <div className="flex flex-col border-b border-slate-200/70 bg-white/70 backdrop-blur-md">
        {/* ─── Row 1: identity + view toggle + search + ⌘K + auth ─── */}
        <div className="flex items-center gap-3 px-5 py-2">
          {/* Middle: scrollable area (now starts at the left edge) */}
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
            <ViewToggle view={view} onChange={setView} />

            <div className="mx-1 flex shrink-0 items-center gap-2 rounded-full bg-slate-100/80 px-3 py-1.5 ring-1 ring-inset ring-transparent transition focus-within:bg-white focus-within:ring-indigo-200">
              <Search size={13} className="shrink-0 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="検索..."
                className="w-44 bg-transparent text-xs outline-none placeholder:text-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="shrink-0 text-slate-400 hover:text-slate-700"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenPalette}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[11px] text-slate-500 shadow-sm hover:text-slate-800"
              title="コマンドパレット"
            >
              <span>⌘K</span>
            </button>
          </div>

          {/* Right: auth (fixed, never clipped) */}
          <div className="shrink-0">
            <AuthButton />
          </div>
        </div>

        {/* ─── Row 2: filters + saved views + spacer + actions ─── */}
        <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-2">
          {/* Middle: scrollable filters */}
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
            <select
              value={fIndustry ?? ''}
              onChange={(e) => setFIndustry(e.target.value || null)}
              className="shrink-0 whitespace-nowrap rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
              title="業界で絞り込み"
            >
              <option value="">業界 (全て)</option>
              {industryOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>

            <select
              value={fStatus ?? ''}
              onChange={(e) => setFStatus(e.target.value || null)}
              className="shrink-0 whitespace-nowrap rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
              title="ステータスで絞り込み"
            >
              <option value="">ステータス (全て)</option>
              {statusOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>

            {/* Saved Views (Popover — portaled to body, unaffected by overflow) */}
            <button
              ref={viewsBtnRef}
              type="button"
              onClick={() => setViewsOpen((v) => !v)}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
              title="保存済みビュー"
            >
              <Filter size={12} />
              ビュー
            </button>
            <Popover
              open={viewsOpen}
              onClose={() => setViewsOpen(false)}
              triggerRef={viewsBtnRef}
              align="left"
            >
              <div className="w-56 overflow-hidden rounded-xl border border-slate-200/70 bg-white py-1 text-xs shadow-xl animate-pop-in">
                {savedViews.map((v) => (
                  <div
                    key={v.id}
                    className={`group flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 ${
                      activeViewId === v.id ? 'bg-indigo-50/80 text-indigo-700' : ''
                    }`}
                  >
                    <button
                      className="flex-1 whitespace-nowrap text-left"
                      onClick={() => {
                        applySavedView(v.id);
                        setViewsOpen(false);
                      }}
                    >
                      {v.name}
                    </button>
                    {!v.builtin && (
                      <button
                        onClick={() => {
                          deleteSavedView(v.id);
                          toast.info('ビューを削除しました');
                        }}
                        className="text-slate-300 opacity-0 hover:text-rose-500 group-hover:opacity-100"
                        title="削除"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
                <div className="my-1 border-t border-slate-200/70" />
                <button
                  onClick={() => {
                    setViewsOpen(false);
                    handleSaveView();
                  }}
                  className="flex w-full items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-left text-indigo-600 hover:bg-indigo-50"
                >
                  <BookmarkPlus size={12} /> 現在の状態を保存…
                </button>
              </div>
            </Popover>
          </div>

          {/* Right: actions (fixed, never clipped) */}
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAddCol(true)}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
              title="列を追加"
            >
              <Columns3 size={12} /> 列追加
            </button>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
              title="Excel/CSV をインポート"
            >
              <Upload size={12} /> インポート
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = '';
              }}
            />

            <button
              ref={exportBtnRef}
              type="button"
              onClick={() => setExportOpen((v) => !v)}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
              title="エクスポート"
            >
              <Download size={12} /> エクスポート
            </button>
            <Popover
              open={exportOpen}
              onClose={() => setExportOpen(false)}
              triggerRef={exportBtnRef}
              align="right"
            >
              <div className="w-40 overflow-hidden rounded-xl border border-slate-200/70 bg-white py-1 text-xs shadow-xl animate-pop-in">
                <button
                  className="block w-full whitespace-nowrap px-3 py-1.5 text-left hover:bg-slate-50"
                  onClick={() => {
                    exportToXlsx({ columns: sheet.columns, rows: sheet.rows });
                    setExportOpen(false);
                  }}
                >
                  .xlsx (Excel)
                </button>
                <button
                  className="block w-full whitespace-nowrap px-3 py-1.5 text-left hover:bg-slate-50"
                  onClick={() => {
                    exportToCsv({ columns: sheet.columns, rows: sheet.rows });
                    setExportOpen(false);
                  }}
                >
                  .csv
                </button>
              </div>
            </Popover>
          </div>
        </div>
      </div>

      {showAddCol && <ColumnAddModal onClose={() => setShowAddCol(false)} />}
    </>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const items: { v: ViewMode; label: string; Icon: typeof Table }[] = [
    { v: 'sheet', label: '表', Icon: Table },
    { v: 'kanban', label: 'Kanban', Icon: KanbanSquare },
    { v: 'calendar', label: 'カレンダー', Icon: CalendarDays },
  ];
  return (
    <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-slate-100/80 p-0.5 shadow-inner">
      {items.map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-medium transition ${
            view === v
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Icon size={12} />
          {label}
        </button>
      ))}
    </div>
  );
}
