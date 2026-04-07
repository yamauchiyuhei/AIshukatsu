import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface Options {
  delayMs?: number;
  onSave: (value: string) => Promise<void>;
}

export function useAutoSave({ delayMs = 1000, onSave }: Options) {
  const [state, setState] = useState<SaveState>('idle');
  const timerRef = useRef<number | null>(null);
  const pendingValueRef = useRef<string | null>(null);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingValueRef.current === null) return;
    const value = pendingValueRef.current;
    pendingValueRef.current = null;
    setState('saving');
    try {
      await onSaveRef.current(value);
      setState('saved');
    } catch (e) {
      console.error('save error:', e);
      setState('error');
    }
  }, []);

  const schedule = useCallback(
    (value: string) => {
      pendingValueRef.current = value;
      setState('dirty');
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        flush();
      }, delayMs);
    },
    [delayMs, flush],
  );

  // Cleanup on unmount: flush pending writes
  useEffect(() => {
    return () => {
      if (pendingValueRef.current !== null) {
        // best-effort sync flush attempt
        flush();
      }
    };
  }, [flush]);

  const reset = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingValueRef.current = null;
    setState('idle');
  }, []);

  return { state, schedule, flush, reset };
}
