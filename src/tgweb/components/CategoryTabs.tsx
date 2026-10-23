import type { CategoryDef } from '../types';

interface Props {
  categories: ReadonlyArray<CategoryDef>;
  value: string;
  onChange: (key: string) => void;
}

export function CategoryTabs({ categories, value, onChange }: Props) {
  return (
    <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-0.5">
      {categories.map((cat) => {
        const active = value === cat.key;
        return (
          <button
            key={cat.key}
            type="button"
            onClick={() => onChange(cat.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              active
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
