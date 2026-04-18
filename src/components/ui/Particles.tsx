import { useEffect, useRef } from 'react';
import { cn } from '../../lib/cn';

interface ParticlesProps {
  className?: string;
  quantity?: number;
  /** Distance in pixels to nudge particles away from the cursor. */
  ease?: number;
  color?: string;
  /** 0 → 1. How fast particles drift. */
  vx?: number;
  vy?: number;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  alpha: number;
  targetAlpha: number;
  dx: number;
  dy: number;
  magnetism: number;
}

/**
 * Lightweight Canvas particles, DPR-aware. Inspired by the Magic UI
 * `particles` component. Respects the container size and cleans up on unmount.
 */
export function Particles({
  className,
  quantity = 60,
  ease = 50,
  color = '#ffffff',
  vx = 0,
  vy = 0,
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const parent = canvas.parentElement!;
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = parent;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const rgb = hexToRgb(color);

    const particles: Particle[] = Array.from({ length: quantity }).map(() =>
      makeParticle(parent.clientWidth, parent.clientHeight),
    );

    let raf = 0;
    const tick = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.dx + vx;
        p.y += p.dy + vy;
        // Cursor magnetism: slight push away
        const dx = p.x - mouse.current.x;
        const dy = p.y - mouse.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < ease) {
          const push = (ease - dist) / ease;
          p.x += (dx / dist) * push * 0.5 * p.magnetism;
          p.y += (dy / dist) * push * 0.5 * p.magnetism;
        }
        // Respawn when out of bounds
        if (p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) {
          Object.assign(p, makeParticle(w, h));
        }
        // Fade in
        if (p.alpha < p.targetAlpha) p.alpha += 0.01;
        ctx.fillStyle = `rgba(${rgb},${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onMove = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      mouse.current.x = e.clientX - rect.left;
      mouse.current.y = e.clientY - rect.top;
    };
    parent.addEventListener('mousemove', onMove);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      parent.removeEventListener('mousemove', onMove);
    };
  }, [quantity, ease, color, vx, vy]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('pointer-events-none absolute inset-0', className)}
      aria-hidden
    />
  );
}

function makeParticle(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    size: Math.random() * 1.8 + 0.4,
    alpha: 0,
    targetAlpha: Math.random() * 0.5 + 0.2,
    dx: (Math.random() - 0.5) * 0.25,
    dy: (Math.random() - 0.5) * 0.25,
    magnetism: Math.random() * 2 + 0.5,
  };
}

function hexToRgb(hex: string): string {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length < 3) return '255,255,255';
  return m
    .slice(0, 3)
    .map((h) => parseInt(h, 16))
    .join(',');
}
