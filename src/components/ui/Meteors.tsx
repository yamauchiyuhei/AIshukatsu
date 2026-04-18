import { useMemo } from 'react';
import { cn } from '../../lib/cn';

/**
 * Randomly positioned falling meteors. Inspired by the Magic UI / Aceternity
 * "meteors" decoration. Place in a `relative overflow-hidden` container.
 */
export function Meteors({
  number = 20,
  className,
}: {
  number?: number;
  className?: string;
}) {
  const styles = useMemo(
    () =>
      Array.from({ length: number }).map((_, i) => ({
        top: -20,
        left: `${Math.floor(Math.random() * 100)}%`,
        animationDelay: `${(Math.random() * 0.8).toFixed(2)}s`,
        animationDuration: `${(Math.random() * 4 + 3).toFixed(2)}s`,
        key: i,
      })),
    [number],
  );

  return (
    <>
      {styles.map((s) => (
        <span
          key={s.key}
          className={cn(
            "pointer-events-none absolute h-0.5 w-0.5 rotate-[215deg] animate-meteor rounded-full bg-white shadow-[0_0_0_1px_#ffffff10]",
            "before:absolute before:top-1/2 before:h-[1px] before:w-[50px] before:-translate-y-1/2 before:bg-gradient-to-r before:from-white before:to-transparent before:content-['']",
            className,
          )}
          style={{
            top: s.top,
            left: s.left,
            animationDelay: s.animationDelay,
            animationDuration: s.animationDuration,
          }}
        />
      ))}
    </>
  );
}
