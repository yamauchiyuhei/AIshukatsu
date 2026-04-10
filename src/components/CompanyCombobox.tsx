import {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface Props {
  value: string;
  onChange: (next: string) => void;
  suggestions: string[];
  placeholder?: string;
  autoFocus?: boolean;
  /** Called when the user picks a suggestion (mouse or Enter on highlight). */
  onSelect?: (name: string) => void;
  /** Called when the input loses focus. */
  onBlur?: () => void;
  /** Override the default rounded-modal input styling for inline / cell use. */
  inputClassName?: string;
  /** Override the dropdown list styling. */
  listClassName?: string;
}

const MAX_RESULTS = 20;

/**
 * Normalize a string for fuzzy-tolerant prefix/substring matching:
 *  - NFKC (full-width / half-width unification)
 *  - lowercase (English)
 *  - hiragana → katakana (so "あ" matches "アサヒ飲料")
 *  - whitespace removed
 */
function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u3041-\u3096]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) + 0x60),
    )
    .replace(/\s+/g, '');
}

/**
 * Returns -1 if no match, otherwise a sort rank (lower = better):
 *   0 = exact equality
 *   1 = prefix match
 *   2 = substring match
 */
function rank(query: string, name: string): number {
  if (!query) return 2;
  const q = normalize(query);
  const n = normalize(name);
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.includes(q)) return 2;
  return -1;
}

/**
 * Lightweight company-name combobox: free-text input + dropdown of filtered
 * suggestions. Keyboard nav (↑↓ Enter Esc) and click-outside-to-close.
 *
 * The input is fully controlled — typing immediately fires `onChange` so the
 * parent form always sees the user-edited value, even when no suggestion is
 * picked.
 */
export function CompanyCombobox({
  value,
  onChange,
  suggestions,
  placeholder,
  autoFocus,
  onSelect,
  onBlur,
  inputClassName,
  listClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    // Don't surface any suggestions until the user has actually typed
    // something — opening the dropdown on focus alone is noisy.
    if (!value.trim()) return [];
    if (suggestions.length === 0) return [];
    const ranked: { name: string; rank: number }[] = [];
    for (const name of suggestions) {
      const r = rank(value, name);
      if (r >= 0) ranked.push({ name, rank: r });
    }
    ranked.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.name.localeCompare(b.name, 'ja');
    });
    return ranked.slice(0, MAX_RESULTS).map((r) => r.name);
  }, [value, suggestions]);

  // Reset highlight whenever the visible list changes.
  useEffect(() => {
    setHighlight(0);
  }, [filtered.length, value]);

  // Click-outside-to-close.
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const choose = (name: string) => {
    onChange(name);
    onSelect?.(name);
    setOpen(false);
    // Defer blur slightly so callers that close the editor on blur don't fire
    // before the value commit propagates.
    setTimeout(() => onBlur?.(), 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      // Open dropdown with picks → consume Enter to confirm the highlight.
      // Otherwise, in cell-editor use (onBlur prop present) commit & close.
      // In modal use (no onBlur), allow native form submission.
      if (open && filtered.length > 0) {
        e.preventDefault();
        choose(filtered[highlight]);
      } else if (onBlur) {
        e.preventDefault();
        setOpen(false);
        onBlur();
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else {
        onBlur?.();
      }
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          // Only open the dropdown on focus if there's already typed text;
          // otherwise stay closed until the user starts typing.
          if (value.trim()) setOpen(true);
        }}
        onBlur={(e) => {
          // Don't fire blur when the user is clicking a suggestion inside our
          // own dropdown — relatedTarget will be inside containerRef.
          const next = e.relatedTarget as Node | null;
          if (next && containerRef.current?.contains(next)) return;
          setOpen(false);
          onBlur?.();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        className={
          inputClassName ??
          'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none'
        }
      />
      {open && filtered.length > 0 && (
        <ul
          className={
            listClassName ??
            'absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg'
          }
        >
          {filtered.map((name, i) => {
            const active = i === highlight;
            return (
              <li key={name}>
                <button
                  type="button"
                  // Use onMouseDown so the input doesn't blur before the click
                  // registers (otherwise the dropdown would close first).
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(name);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex-1 truncate">{name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
