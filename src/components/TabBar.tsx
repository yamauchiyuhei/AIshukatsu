import { motion, LayoutGroup } from 'framer-motion';
import { X } from 'lucide-react';
import { OpenTab } from '../hooks/useOpenTabs';
import { fileIconFor } from './fileIcons';

interface Props {
  tabs: OpenTab[];
  activeKey: string | null;
  onActivate: (key: string) => void;
  onClose: (key: string) => void;
}

/**
 * Chrome-style tab strip. Uses a framer-motion shared layout for a glowing
 * indicator that slides between active tabs.
 */
export function TabBar({ tabs, activeKey, onActivate, onClose }: Props) {
  if (tabs.length === 0) return null;
  return (
    <div className="flex h-10 items-end gap-0.5 overflow-x-auto overflow-y-hidden border-b border-slate-200 bg-slate-100/50 px-2 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <LayoutGroup id="tabbar">
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          const Icon = fileIconFor(tab.label);
          return (
            <div
              key={tab.key}
              onClick={() => onActivate(tab.key)}
              title={[...tab.breadcrumb, tab.label].join(' / ')}
              className={`group relative flex h-full w-[180px] shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 px-3 text-sm transition ${
                active
                  ? 'border-slate-200 bg-white text-slate-900'
                  : 'border-transparent text-slate-500 hover:bg-white/60 hover:text-slate-700'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="tab-underline"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500"
                />
              )}
              <Icon
                size={13}
                className={`shrink-0 ${active ? 'text-indigo-500' : 'text-slate-400'}`}
              />
              <span className="min-w-0 flex-1 truncate">{tab.label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.key);
                }}
                className="ml-2 shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100"
                title="閉じる"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </LayoutGroup>
    </div>
  );
}
