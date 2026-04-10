import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Star, X } from 'lucide-react';
import { CellValue, Column } from '../../types/sheet';
import { CompanyCombobox } from '../../../components/CompanyCombobox';
import { useCompanyMaster } from '../../../hooks/useCompanyMaster';
import { addCompanyToMaster } from '../../../lib/companyMasterSync';
import { lookupIndustry } from '../../../lib/companyIndustryMap';
import { getActiveSheet, useSheet } from '../../lib/store';

interface Props {
  column: Column;
  value: CellValue;
  onChange: (v: CellValue) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  inline?: boolean;
}

export function CellEditor({ column, value, onChange, onBlur, autoFocus, inline }: Props) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) inputRef.current.select();
    }
  }, [autoFocus]);

  const baseInput =
    'w-full bg-white border border-indigo-300 rounded px-1.5 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-200';

  // Special-case: any column whose role is "company" gets the autocomplete
  // combobox backed by the global Firestore master list. This sits before
  // the type-based switch so it works regardless of column.type (typically
  // 'text', but we don't want to depend on that).
  if (column.role === 'company' || column.id === 'company') {
    return (
      <CompanyCellCombobox
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        autoFocus={autoFocus}
        inputClassName={baseInput}
      />
    );
  }

  switch (column.type) {
    case 'text':
    case 'url':
    case 'longtext':
      if (column.type === 'longtext') {
        return (
          <textarea
            ref={(el) => (inputRef.current = el)}
            className={`${baseInput} resize-none`}
            rows={3}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onBlur?.();
              if (e.key === 'Escape') onBlur?.();
            }}
          />
        );
      }
      return (
        <input
          ref={(el) => (inputRef.current = el)}
          className={baseInput}
          type={column.type === 'url' ? 'url' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') onBlur?.();
          }}
          placeholder={column.type === 'url' ? 'https://...' : ''}
        />
      );

    case 'password':
      return <PasswordEditor value={value} onChange={onChange} onBlur={onBlur} />;

    case 'date':
      return (
        <div className="flex items-center gap-1">
          <input
            ref={(el) => (inputRef.current = el)}
            type="date"
            className={baseInput}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') onBlur?.();
            }}
          />
          {value && (
            <button
              type="button"
              className="text-slate-400 hover:text-rose-500"
              onClick={() => onChange('')}
              title="クリア"
            >
              <X size={12} />
            </button>
          )}
        </div>
      );

    case 'datetime':
      return (
        <div className="flex items-center gap-1">
          <input
            ref={(el) => (inputRef.current = el)}
            type="datetime-local"
            className={baseInput}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') onBlur?.();
            }}
          />
          {value && (
            <button
              type="button"
              className="text-slate-400 hover:text-rose-500"
              onClick={() => onChange('')}
              title="クリア"
            >
              <X size={12} />
            </button>
          )}
        </div>
      );

    case 'select':
      return (
        <select
          className={baseInput}
          value={String(value ?? '')}
          onChange={(e) => {
            onChange(e.target.value);
            // immediate close on select
            setTimeout(() => onBlur?.(), 0);
          }}
          onBlur={onBlur}
          autoFocus={autoFocus}
        >
          <option value=""></option>
          {(column.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );

    case 'rating':
      return <RatingEditor value={Number(value) || 0} onChange={onChange} onBlur={onBlur} inline={inline} />;

    case 'checkbox':
      return (
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          onBlur={onBlur}
        />
      );
  }
}

/**
 * Inline cell-editor wrapper around <CompanyCombobox>. Pulls suggestions from
 * the global company master and, on blur with a non-empty unknown name,
 * fire-and-forget appends it to the master so future edits suggest it.
 */
function CompanyCellCombobox({
  value,
  onChange,
  onBlur,
  autoFocus,
  inputClassName,
}: {
  value: CellValue;
  onChange: (v: CellValue) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  inputClassName?: string;
}) {
  const { names } = useCompanyMaster();
  const text = String(value ?? '');

  /**
   * If the company name maps to a known industry AND the current row's
   * `industry` cell is empty, auto-fill it. Manual selections are never
   * overwritten. Uses the store directly because the active row is
   * whichever one the user selected to enter edit mode (invariant:
   * editing cell == selection).
   */
  const maybeAutoFillIndustry = (companyName: string) => {
    const hit = lookupIndustry(companyName);
    if (!hit) return;
    const state = useSheet.getState();
    const selection = state.selection;
    if (!selection) return;
    const sheet = getActiveSheet(state);
    const row = sheet.rows.find((r) => r.id === selection.rowId);
    if (!row) return;
    const hasIndustryColumn = sheet.columns.some((c) => c.id === 'industry');
    if (!hasIndustryColumn) return;
    const current = row.cells['industry'];
    if (current != null && String(current).trim() !== '') return; // preserve user choice
    state.updateCell(row.id, 'industry', hit);
  };

  const handleSelect = (picked: string) => {
    maybeAutoFillIndustry(picked);
  };

  const handleBlur = () => {
    const trimmed = text.trim();
    if (trimmed) {
      // Auto-fill industry on blur too, so that free-typing (not just
      // picking from the dropdown) also benefits when the typed name
      // matches a known entry.
      maybeAutoFillIndustry(trimmed);
      if (!names.includes(trimmed)) {
        // New name → append to global master in the background. Errors are
        // logged but never blocked the user (the cell value is already saved
        // locally / to the workbook).
        void addCompanyToMaster(trimmed).catch((e) => {
          console.warn('[addCompanyToMaster] (cell) failed', e);
        });
      }
    }
    onBlur?.();
  };

  return (
    <CompanyCombobox
      value={text}
      onChange={(v) => onChange(v)}
      suggestions={names}
      autoFocus={autoFocus}
      inputClassName={inputClassName}
      onBlur={handleBlur}
      onSelect={handleSelect}
    />
  );
}

function PasswordEditor({
  value,
  onChange,
  onBlur,
}: {
  value: CellValue;
  onChange: (v: CellValue) => void;
  onBlur?: () => void;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <input
        type={reveal ? 'text' : 'password'}
        className="w-full bg-white border border-indigo-300 rounded px-1.5 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-200"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') onBlur?.();
        }}
      />
      <button
        type="button"
        onClick={() => setReveal((v) => !v)}
        className="text-slate-400 hover:text-slate-700"
        title={reveal ? '隠す' : '表示'}
      >
        {reveal ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
    </div>
  );
}

function RatingEditor({
  value,
  onChange,
  onBlur,
  inline,
}: {
  value: number;
  onChange: (v: CellValue) => void;
  onBlur?: () => void;
  inline?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => {
        if (!inline) onBlur?.();
      }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => {
            onChange(value === n ? 0 : n);
          }}
          className="hover:scale-110"
          title={`★${n}`}
        >
          <Star
            size={14}
            className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
          />
        </button>
      ))}
    </div>
  );
}
