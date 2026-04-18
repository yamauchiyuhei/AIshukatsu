import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind class-name helper.
 *
 * Combines `clsx` (conditional class joining) with `tailwind-merge`
 * (deduplication of conflicting Tailwind classes). This is the shadcn/ui
 * convention — import as `cn` and use anywhere you compose classes:
 *
 *   cn('px-2 py-1', disabled && 'opacity-50', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
