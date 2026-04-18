import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Animated gradient text. The `bg-clip-text` + `text-transparent` combo lets
 * the background animate while only the glyph area is painted.
 */
export function AuroraText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-rose-400 bg-[length:200%_auto] bg-clip-text text-transparent animate-aurora',
        className,
      )}
    >
      {children}
    </span>
  );
}
