import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface ShimmerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Length (px) of the rotating shimmer bar. */
  shimmerSize?: string;
  /** Duration of one rotation. */
  shimmerDuration?: string;
  shimmerColor?: string;
  borderRadius?: string;
  background?: string;
}

/**
 * Gradient-shimmer call-to-action button. The shimmer is a conic gradient
 * rotating inside a mask, with a drop shadow for extra pop. Based on the
 * Magic UI `shimmer-button` primitive.
 */
export const ShimmerButton = forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      children,
      className,
      shimmerColor = '#ffffff',
      shimmerSize = '0.08em',
      shimmerDuration = '3s',
      borderRadius = '9999px',
      background = 'linear-gradient(135deg,#4f46e5 0%, #7c3aed 50%, #ec4899 100%)',
      type = 'button',
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      style={
        {
          '--spread': '90deg',
          '--shimmer-color': shimmerColor,
          '--radius': borderRadius,
          '--speed': shimmerDuration,
          '--cut': shimmerSize,
          '--bg': background,
        } as React.CSSProperties
      }
      className={cn(
        'group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-white/10 px-6 py-3 text-white',
        '[background:var(--bg)] [border-radius:var(--radius)]',
        'shadow-[0_10px_40px_-12px_rgba(124,58,237,0.55)] transition-transform hover:scale-[1.02] active:scale-[0.99]',
        className,
      )}
      {...props}
    >
      {/* Rotating shimmer */}
      <div
        className={cn(
          'absolute inset-0 overflow-visible [container-type:size]',
          '[border-radius:var(--radius)]',
        )}
      >
        <div className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
          <div className="absolute -inset-full w-auto rotate-0 animate-shimmer-spin [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
        </div>
      </div>
      <span className="relative z-10 flex items-center gap-2 text-sm font-semibold tracking-wide">
        {children}
      </span>
      {/* Inner highlight */}
      <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0_-8px_10px_#ffffff1a] transition-all duration-300 group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]" />
    </button>
  ),
);
ShimmerButton.displayName = 'ShimmerButton';
