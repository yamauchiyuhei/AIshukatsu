import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * macOS-style window chrome wrapping an image or arbitrary content. Gives
 * marketing screenshots a polished "this is a real app" feeling without
 * capturing the user's actual Chrome.
 */
export function BrowserFrame({
  url,
  children,
  className,
  glow = true,
}: {
  url?: string;
  children: ReactNode;
  className?: string;
  /** When true, paints a soft coloured glow behind the frame. */
  glow?: boolean;
}) {
  return (
    <div className={cn('relative', className)}>
      {glow && (
        <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-indigo-500/30 via-fuchsia-500/20 to-rose-500/20 blur-3xl" />
      )}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/90 shadow-2xl ring-1 ring-white/5 backdrop-blur-sm">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900/80 px-3 py-2">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-400/80" />
            <span className="h-3 w-3 rounded-full bg-amber-300/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          </div>
          {url && (
            <div className="mx-auto max-w-md flex-1 truncate rounded-md bg-white/5 px-3 py-0.5 text-center text-[11px] text-slate-400">
              {url}
            </div>
          )}
        </div>
        {/* Content */}
        <div className="relative bg-white">{children}</div>
      </div>
    </div>
  );
}
