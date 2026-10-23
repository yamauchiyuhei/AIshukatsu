import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function SearchBox({ value, onChange }: Props) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="問題文で検索"
        autoComplete="off"
        className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-10 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="クリア"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
