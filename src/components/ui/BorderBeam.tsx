import { cn } from '../../lib/cn';

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
}

/**
 * A single light beam that chases around the element's border.
 * Drop this inside a `relative` element that owns a visible border-radius;
 * it paints on top via an absolutely-positioned pseudo-element.
 */
export function BorderBeam({
  className,
  size = 200,
  duration = 6,
  delay = 0,
  colorFrom = '#9ea4fc',
  colorTo = '#f9a8d4',
}: BorderBeamProps) {
  return (
    <div
      style={
        {
          '--size': size,
          '--duration': `${duration}s`,
          '--delay': `-${delay}s`,
          '--color-from': colorFrom,
          '--color-to': colorTo,
        } as React.CSSProperties
      }
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit] [border:1px_solid_transparent]',
        // outer ring
        '![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]',
        // beam
        'after:absolute after:aspect-square after:w-[calc(var(--size)*1px)] after:animate-[border-beam_var(--duration)_infinite_linear] after:[animation-delay:var(--delay)] after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] after:[offset-anchor:90%_50%] after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]',
        className,
      )}
    />
  );
}
