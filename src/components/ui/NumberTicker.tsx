import { useEffect, useRef } from 'react';
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import { cn } from '../../lib/cn';

interface NumberTickerProps {
  value: number;
  direction?: 'up' | 'down';
  delay?: number;
  className?: string;
  /** Spring stiffness. Higher = snappier. */
  stiffness?: number;
  /** Spring damping. Higher = less bouncy. */
  damping?: number;
}

/**
 * Counts from 0 → `value` (or `value` → 0) when scrolled into view. Uses a
 * framer-motion spring so the easing feels organic rather than linear.
 */
export function NumberTicker({
  value,
  direction = 'up',
  delay = 0,
  className,
  stiffness = 60,
  damping = 18,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '0px' });
  const motionValue = useMotionValue(direction === 'down' ? value : 0);
  const springValue = useSpring(motionValue, { stiffness, damping });

  useEffect(() => {
    if (!isInView) return;
    const t = window.setTimeout(() => {
      motionValue.set(direction === 'down' ? 0 : value);
    }, delay * 1000);
    return () => window.clearTimeout(t);
  }, [motionValue, isInView, delay, value, direction]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      if (!ref.current) return;
      ref.current.textContent = Intl.NumberFormat('ja-JP').format(
        Math.round(latest),
      );
    });
    return unsubscribe;
  }, [springValue]);

  return (
    <motion.span
      ref={ref}
      className={cn('inline-block tabular-nums', className)}
    >
      0
    </motion.span>
  );
}
