import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Star, X } from 'lucide-react';
import { CellValue, Column } from '../../types/sheet';
import { CompanyCombobox } from '../../../components/CompanyCombobox';
import { useCompanyMaster } from '../../../hooks/useCompanyMaster';
import { lookupIndustry } from '../../../lib/companyIndustryMap';
import { getActiveSheet, useSheet } from '../../lib/store';

interface Props {
  column: Column;
  value: CellValue;
  onChange: (v: CellValue) => void;
  onBlur?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  inline?: boolean;
}

export function CellEditor({ column, value, onChange, onBlur, onCancel, autoFocus, inline }: Props) {
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
        onCancel={onCancel}
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
            aria-label={column.name}
            rows={3}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onBlur?.();
              if (e.key === 'Escape') { e.stopPropagation(); (onCancel ?? onBlur)?.(); }
            }}
          />
        );
      }
      return (
        <input
          ref={(el) => (inputRef.current = el)}
          className={baseInput}
          aria-label={column.name}
          type={column.type === 'url' ? 'url' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === 'Escape') { e.stopPropagation(); (onCancel ?? onBlur)?.(); }
            else if (e.key === 'Enter') { e.stopPropagation(); onBlur?.(); }
          }}
          placeholder={column.type === 'url' ? 'https://...' : ''}
        />
      );

    case 'password':
      return <PasswordEditor value={value} onChange={onChange} onBlur={onBlur} onCancel={onCancel} />;

    case 'date':
      return (
        <div className="flex items-center gap-1">
          <input
            ref={(el) => (inputRef.current = el)}
            aria-label={column.name}
            type="date"
            className={baseInput}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === 'Escape') { e.stopPropagation(); (onCancel ?? onBlur)?.(); }
            else if (e.key === 'Enter') { e.stopPropagation(); onBlur?.(); }
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
            aria-label={column.name}
            type="datetime-local"
            className={baseInput}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === 'Escape') { e.stopPropagation(); (onCancel ?? onBlur)?.(); }
            else if (e.key === 'Enter') { e.stopPropagation(); onBlur?.(); }
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
          aria-label={column.name}
          className={baseInput}
          value={String(value ?? '')}
          onChange={(e) => {
            onChange(e.target.value);
            // immediate close on select
            setTimeout(() => onBlur?.(), 0);
          }}
          onBlur={onBlur}
          autoFocus={autoFocus}
          onKeyDown={e=>{if(!e.nativeEvent.isComposing&&e.key==='Escape'){e.stopPropagation();(onCancel??onBlur)?.();}}}
        >
          <option value=""></option>
          {value && !(column.options??[]).includes(String(value)) && <option value={String(value)}>{String(value)}</option>}
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
          aria-label={column.name}
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
  onCancel,
  autoFocus,
  inputClassName,
}: {
  value: CellValue;
  onChange: (v: CellValue) => void;
  onBlur?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  inputClassName?: string;
}) {
  const { names } = useCompanyMaster();
  const text = String(value ?? '');


  return (
    <CompanyCombobox
      value={text}
      onChange={(v) => onChange(v)}
      suggestions={names}
      autoFocus={autoFocus}
      inputClassName={inputClassName}
      onBlur={onBlur}
      onCancel={onCancel}
    />
  );
}

function PasswordEditor({
  value,
  onChange,
  onBlur,
  onCancel,
}: {
  value: CellValue;
  onChange: (v: CellValue) => void;
  onBlur?: () => void;
  onCancel?: () => void;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        aria-label="パスワード"
        autoComplete="off"
        type={reveal ? 'text' : 'password'}
        className="w-full bg-white border border-indigo-300 rounded px-1.5 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-200"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === 'Escape') { e.stopPropagation(); (onCancel ?? onBlur)?.(); }
            else if (e.key === 'Enter') { e.stopPropagation(); onBlur?.(); }
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
