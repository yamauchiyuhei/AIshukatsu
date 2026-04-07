import { X } from 'lucide-react';
import { OpenTab } from '../hooks/useOpenTabs';

interface Props {
  tabs: OpenTab[];
  activeKey: string | null;
  onActivate: (key: string) => void;
  onClose: (key: string) => void;
}

export function TabBar({ tabs, activeKey, onActivate, onClose }: Props) {
  if (tabs.length === 0) return null;
  return (
    <div className="flex h-10 items-end gap-0.5 border-b border-slate-200 bg-slate-100/50 px-2 pt-1.5">
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <div
            key={tab.key}
            onClick={() => onActivate(tab.key)}
            title={[...tab.breadcrumb, tab.label].join(' / ')}
            className={`group flex h-full max-w-[220px] cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 px-3 text-sm transition ${
              active
                ? 'border-slate-200 bg-white text-slate-900'
                : 'border-transparent text-slate-500 hover:bg-white/60 hover:text-slate-700'
            }`}
          >
            <span className="shrink-0 text-base leading-none">📄</span>
            <span className="truncate">{tab.label}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.key);
              }}
              className="ml-1 rounded p-0.5 text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100"
              title="閉じる"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
