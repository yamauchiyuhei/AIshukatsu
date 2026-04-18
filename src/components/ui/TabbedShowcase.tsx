import { useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { cn } from '../../lib/cn';
import { BrowserFrame } from './BrowserFrame';

export interface ShowcaseTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  src: string;
  alt: string;
  /** Optional short caption rendered below the frame. */
  caption?: string;
}

/**
 * Tabbed product screenshot gallery with a shared-layout pill indicator and
 * cross-fade between frames. Designed for the LP "実画面" section.
 */
export function TabbedShowcase({
  tabs,
  url = 'aisyuukatsu-30fdd.web.app',
  className,
}: {
  tabs: ShowcaseTab[];
  url?: string;
  className?: string;
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;

  return (
    <div className={cn('flex flex-col items-center gap-6', className)}>
      <LayoutGroup id="showcase-tabs">
        <div className="inline-flex flex-wrap items-center justify-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                'relative inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-colors',
                active === t.id
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white',
              )}
            >
              {active === t.id && (
                <motion.span
                  layoutId="showcase-pill"
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 shadow-[0_4px_24px_-6px_rgba(236,72,153,0.6)]"
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                {t.icon}
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </LayoutGroup>

      <BrowserFrame url={url} className="w-full max-w-5xl">
        <AnimatePresence mode="wait">
          <motion.img
            key={current.id}
            src={current.src}
            alt={current.alt}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="block h-auto w-full"
            loading="lazy"
          />
        </AnimatePresence>
      </BrowserFrame>

      {current.caption && (
        <p className="max-w-2xl text-center text-sm text-slate-400">
          {current.caption}
        </p>
      )}
    </div>
  );
}
