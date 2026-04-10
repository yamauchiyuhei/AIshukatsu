import { useEffect, useMemo, useRef, useState, KeyboardEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Copy,
  MoreVertical,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from 'lucide-react';
import { useSheet, getActiveSheet } from '../../lib/store';
import { applyFilters } from '../../lib/filtering';
import { rowStyleFor } from '../../lib/conditionalFormat';
import { DataCell } from './DataCell';
import { Column, Row } from '../../types/sheet';
import { confirmDialog, toast } from '../Toast';
import { getWidth, saveWidth } from '../../lib/columnWidths';
import {
  buildPasteUpdates,
  fillDownUpdate,
  parseTsv,
  rangeToTsv,
  singleCellToTsv,
} from '../../lib/clipboard';

export function SheetGrid() {
  const sheet = useSheet((s) => getActiveSheet(s));
  const search = useSheet((s) => s.searchQuery);
  const fIndustry = useSheet((s) => s.filterIndustry);
  const fStatus = useSheet((s) => s.filterStatus);
  const sortColumnId = useSheet((s) => s.sortColumnId);
  const sortDir = useSheet((s) => s.sortDir);

  const updateCell = useSheet((s) => s.updateCell);
  const applyCellUpdates = useSheet((s) => s.applyCellUpdates);
  const deleteRow = useSheet((s) => s.deleteRow);
  const deleteRows = useSheet((s) => s.deleteRows);
  const duplicateRow = useSheet((s) => s.duplicateRow);
  const addRow = useSheet((s) => s.addRow);
  const toggleSort = useSheet((s) => s.toggleSort);
  const deleteColumn = useSheet((s) => s.deleteColumn);
  const renameColumn = useSheet((s) => s.renameColumn);
  const setColumnWidth = useSheet((s) => s.setColumnWidth);
  const togglePinRow = useSheet((s) => s.togglePinRow);

  const selection = useSheet((s) => s.selection);
  const setSelection = useSheet((s) => s.setSelection);
  const moveSelection = useSheet((s) => s.moveSelection);
  const clearSelection = useSheet((s) => s.clearSelection);
  const selectedRowIds = useSheet((s) => s.selectedRowIds);
  const toggleRowSelected = useSheet((s) => s.toggleRowSelected);
  const setSelectedRowIds = useSheet((s) => s.setSelectedRowIds);

  const filtered = useMemo(
    () =>
      applyFilters(sheet.rows, sheet.columns, {
        query: search,
        industry: fIndustry,
        status: fStatus,
        sortColumnId,
        sortDir,
      }),
    [sheet.rows, sheet.columns, search, fIndustry, fStatus, sortColumnId, sortDir],
  );

  // Pinned rows surface to the top
  const orderedRows = useMemo(() => {
    const pinned = filtered.filter((r) => r.pinned);
    const rest = filtered.filter((r) => !r.pinned);
    return [...pinned, ...rest];
  }, [filtered]);

  const [openColMenu, setOpenColMenu] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [editingNow, setEditingNow] = useState(false);

  // Per-column live width state (sourced from sheet.columns + localStorage fallback)
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      sheet.columns.map((c) => [c.id, getWidth(c.id, c.width ?? 130)]),
    ),
  );
  useEffect(() => {
    setWidths((prev) => {
      const next = { ...prev };
      for (const c of sheet.columns) {
        if (next[c.id] == null) next[c.id] = getWidth(c.id, c.width ?? 130);
      }
      return next;
    });
  }, [sheet.columns]);

  /* ----------- Column resize ----------- */
  const resizeRef = useRef<{ colId: string; startX: number; startW: number } | null>(
    null,
  );
  const onResizeDown = (e: React.PointerEvent, col: Column) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    resizeRef.current = {
      colId: col.id,
      startX: e.clientX,
      startW: widths[col.id] ?? col.width ?? 130,
    };
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    if (!r) return;
    const dx = e.clientX - r.startX;
    const w = Math.max(40, Math.min(600, r.startW + dx));
    setWidths((prev) => ({ ...prev, [r.colId]: w }));
  };
  const onResizeUp = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    if (!r) return;
    const w = widths[r.colId];
    if (w != null) {
      saveWidth(r.colId, w);
      setColumnWidth(r.colId, w);
    }
    resizeRef.current = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {}
  };

  /* ----------- Copy / paste / fill ----------- */
  useEffect(() => {
    const onCopy = async (e: ClipboardEvent) => {
      if (editingNow) return;
      const sel = useSheet.getState().selection;
      const range = useSheet.getState().selectionRange;
      const s = useSheet.getState();
      const active = getActiveSheet(s);
      let text = '';
      if (range) {
        text = rangeToTsv(active, range);
      } else if (sel) {
        text = singleCellToTsv(active, sel);
      } else {
        return;
      }
      e.preventDefault();
      e.clipboardData?.setData('text/plain', text);
    };
    const onPaste = async (e: ClipboardEvent) => {
      if (editingNow) return;
      const sel = useSheet.getState().selection;
      if (!sel) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!text) return;
      e.preventDefault();
      const values = parseTsv(text);
      const s = useSheet.getState();
      const active = getActiveSheet(s);
      const updates = buildPasteUpdates(active, sel, values).updates;
      if (updates.length) {
        applyCellUpdates(updates);
        toast.success(`${updates.length} セルを貼り付け`);
      }
    };
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, [applyCellUpdates, editingNow]);

  /* ----------- Keyboard navigation ----------- */
  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editingNow) return;
    const meta = e.metaKey || e.ctrlKey;

    if (meta && e.key.toLowerCase() === 'd') {
      // Fill down
      e.preventDefault();
      const sel = useSheet.getState().selection;
      if (!sel) return;
      const active = getActiveSheet(useSheet.getState());
      const u = fillDownUpdate(active, sel);
      if (u) {
        updateCell(u.rowId, u.colId, u.value);
        toast.info('上のセルで埋めました');
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveSelection(0, -1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelection(0, 1);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveSelection(-1, 0);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveSelection(1, 0);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      // Tab at end-of-grid → add new row
      const sel = useSheet.getState().selection;
      if (sel) {
        const active = getActiveSheet(useSheet.getState());
        const lastRow = active.rows[active.rows.length - 1];
        const lastCol = active.columns[active.columns.length - 1];
        if (sel.rowId === lastRow?.id && sel.colId === lastCol?.id && !e.shiftKey) {
          const id = addRow();
          setSelection({ rowId: id, colId: active.columns[0].id });
          return;
        }
      }
      moveSelection(e.shiftKey ? -1 : 1, 0);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      moveSelection(0, e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      clearSelection();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Clear selected cell
      const sel = useSheet.getState().selection;
      if (sel) {
        e.preventDefault();
        updateCell(sel.rowId, sel.colId, '');
      }
      return;
    }
  };

  /* ----------- Render ----------- */
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onGridKeyDown}
        className="flex-1 overflow-auto rounded-tl-2xl bg-white outline-none"
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
      >
        <table className="min-w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 w-10 border-b border-r border-slate-200/60 bg-white/80 px-1 py-2 text-center text-[10px] font-medium text-slate-500 backdrop-blur">
                #
              </th>
              {sheet.columns.map((col) => {
                const sortIcon =
                  sortColumnId === col.id ? (
                    sortDir === 'asc' ? (
                      <ArrowUp size={10} />
                    ) : (
                      <ArrowDown size={10} />
                    )
                  ) : (
                    <ChevronsUpDown size={10} className="text-slate-300" />
                  );
                const w = widths[col.id] ?? col.width ?? 130;
                return (
                  <th
                    key={col.id}
                    style={{ minWidth: w, width: w }}
                    className="relative border-b border-r border-slate-200/60 bg-white/80 px-2 py-2 text-left text-[11px] font-semibold text-slate-700 backdrop-blur"
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleSort(col.id)}
                        className="flex flex-1 items-center gap-1 hover:text-indigo-600"
                        title="クリックで並べ替え"
                      >
                        <span className="truncate">{col.name}</span>
                        {sortIcon}
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenColMenu(openColMenu === col.id ? null : col.id)}
                          className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <MoreVertical size={12} />
                        </button>
                        {openColMenu === col.id && (
                          <div
                            className="absolute right-0 top-6 z-40 w-40 overflow-hidden rounded-xl border border-slate-200/70 bg-white py-1 text-xs shadow-xl animate-pop-in"
                            onMouseLeave={() => setOpenColMenu(null)}
                          >
                            <button
                              type="button"
                              className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                              onClick={() => {
                                const name = window.prompt('列名を変更', col.name);
                                if (name && name.trim()) renameColumn(col.id, name.trim());
                                setOpenColMenu(null);
                              }}
                            >
                              名前を変更
                            </button>
                            <button
                              type="button"
                              className="block w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50"
                              onClick={async () => {
                                setOpenColMenu(null);
                                const ok = await confirmDialog(
                                  `列「${col.name}」を削除します。データも消えます。`,
                                  { title: '列を削除', destructive: true, okLabel: '削除' },
                                );
                                if (ok) deleteColumn(col.id);
                              }}
                            >
                              列を削除
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Resize handle */}
                    <span
                      onPointerDown={(e) => onResizeDown(e, col)}
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none hover:bg-indigo-300/60"
                    />
                  </th>
                );
              })}
              <th className="w-10 border-b border-slate-200/60 bg-white/80 backdrop-blur" />
            </tr>
          </thead>
          <tbody>
            {orderedRows.map((row, idx) => {
              const status = String(row.cells['status'] ?? '');
              const rs = rowStyleFor(row);
              const isMultiSelected = selectedRowIds.includes(row.id);
              return (
                <tr
                  key={row.id}
                  className={`group ${rs.rowBg} ${rs.strike ? 'line-through' : ''} ${
                    isMultiSelected ? 'bg-indigo-50/50' : ''
                  }`}
                >
                  <td
                    onClick={(e) => {
                      const mode = e.shiftKey ? 'range' : e.metaKey || e.ctrlKey ? 'add' : 'single';
                      toggleRowSelected(row.id, mode);
                    }}
                    className="sticky left-0 z-10 cursor-pointer border-b border-r border-slate-200/60 bg-white px-1 py-0 text-center text-[10px] text-slate-400 transition group-hover:bg-indigo-50/40"
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      {row.pinned && <Pin size={9} className="text-amber-500" />}
                      <span>{idx + 1}</span>
                    </div>
                  </td>
                  {sheet.columns.map((col) => {
                    const w = widths[col.id] ?? col.width ?? 130;
                    const isSelected =
                      selection?.rowId === row.id && selection?.colId === col.id;
                    return (
                      <td
                        key={col.id}
                        style={{ minWidth: w, width: w }}
                        className={`relative border-b border-r border-slate-200/60 bg-white p-0 align-top transition group-hover:bg-indigo-50/30 ${
                          isSelected ? 'ring-2 ring-inset ring-indigo-500/70' : ''
                        }`}
                        onMouseDown={() =>
                          setSelection({ rowId: row.id, colId: col.id })
                        }
                      >
                        <DataCell
                          column={col}
                          value={row.cells[col.id] ?? ''}
                          status={status}
                          selected={!!isSelected}
                          onChange={(v) => updateCell(row.id, col.id, v)}
                          onEditingChange={setEditingNow}
                        />
                      </td>
                    );
                  })}
                  <td className="border-b border-slate-200/60 bg-white px-1 align-middle group-hover:bg-indigo-50/30">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => togglePinRow(row.id)}
                        className="rounded-full p-1 text-slate-400 hover:bg-amber-100 hover:text-amber-600"
                        title={row.pinned ? 'ピン留めを外す' : 'ピン留め'}
                      >
                        {row.pinned ? <PinOff size={11} /> : <Pin size={11} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateRow(row.id)}
                        className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="複製"
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await confirmDialog('この行を削除します。', {
                            title: '行を削除',
                            destructive: true,
                            okLabel: '削除',
                          });
                          if (ok) deleteRow(row.id);
                        }}
                        className="rounded-full p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                        title="削除"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {orderedRows.length === 0 && (
              <tr>
                <td
                  colSpan={sheet.columns.length + 2}
                  className="border-b border-slate-200/60 bg-white px-4 py-16 text-center text-sm text-slate-400"
                >
                  該当する行がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: add row + multi-select bar */}
      <div className="flex items-center justify-between border-t border-slate-200/60 bg-white/60 px-4 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => {
            const id = addRow();
            const active = getActiveSheet(useSheet.getState());
            setSelection({ rowId: id, colId: active.columns[0].id });
          }}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
        >
          <Plus size={12} /> 行を追加
        </button>

        {selectedRowIds.length > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-indigo-200/70 bg-indigo-50/80 px-3 py-1 text-[11px] text-indigo-700 shadow-sm">
            <span className="font-semibold">{selectedRowIds.length} 行選択中</span>
            <button
              onClick={async () => {
                const ok = await confirmDialog(
                  `${selectedRowIds.length} 行を削除します。`,
                  { title: '行を一括削除', destructive: true, okLabel: '削除' },
                );
                if (ok) {
                  deleteRows(selectedRowIds);
                  toast.success(`${selectedRowIds.length} 行を削除しました`);
                }
              }}
              className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-semibold text-white hover:bg-rose-700"
            >
              削除
            </button>
            <button
              onClick={() => setSelectedRowIds([])}
              className="rounded-full px-2 py-0.5 text-[10px] text-indigo-700 hover:bg-white"
            >
              解除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// silence "Row" unused-import warning if any
export type _RowExport = Row;
