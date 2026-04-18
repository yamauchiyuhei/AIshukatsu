import { useRef, type ReactNode } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { cn } from '../../lib/cn';

interface MagicCardProps {
  children: ReactNode;
  className?: string;
  /** Size of the follow-the-mouse glow, in pixels. */
  size?: number;
  /** HSL values used for the glow gradient. */
  gradientColor?: string;
}

/**
 * Card that paints a soft radial gradient following the cursor. Inspired by
 * the Magic UI `magic-card` primitive. The gradient fades out when the
 * pointer leaves the card, so static states look exactly like a normal card.
 */
export function MagicCard({
  children,
  className,
  size = 320,
  gradientColor = 'rgba(129,140,248,0.18)',
}: MagicCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mouseX = useMotionValue(-size);
  const mouseY = useMotionValue(-size);

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        mouseX.set(e.clientX - rect.left);
        mouseY.set(e.clientY - rect.top);
      }}
      onMouseLeave={() => {
        mouseX.set(-size);
        mouseY.set(-size);
      }}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg',
        className,
      )}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`radial-gradient(${size}px circle at ${mouseX}px ${mouseY}px, ${gradientColor}, transparent 70%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
