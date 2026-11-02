import { useCallback, useEffect, useRef, useState } from 'react';
import { SaveQueue, announceSaves, registerWriter } from '../lib/saveQueue';
export type { SaveState } from '../lib/saveQueue';

export function useAutoSave({ delayMs = 1000, onSave, onBeforeSave, documentKey, documentLabel, owner }: { onBeforeSave?:()=>void; owner?:string; documentLabel?:string; documentKey?:string; delayMs?: number; onSave: (value: string) => Promise<void> }) {
  const [, render] = useState(0);
  const mounted = useRef(true);
  const beforeRef=useRef(onBeforeSave);beforeRef.current=onBeforeSave;
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<SaveQueue>();
  if (!queue.current) queue.current = new SaveQueue(value => saveRef.current(value), () => {
    if (mounted.current) render(n => n + 1);
    announceSaves();
  });
  const writer = queue.current;
  writer.prepare=()=>beforeRef.current?.();
  writer.resourceKey=documentKey;writer.documentLabel=documentLabel;writer.owner=owner;
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    return writer.flush();
  }, [writer]);
  const schedule = useCallback((value: string) => {
    writer.set(value);
    if (timer.current) clearTimeout(timer.current);
    if(!mounted.current)return;
    timer.current = setTimeout(() => { void flush().catch(() => {}); }, delayMs);
  }, [delayMs, flush, writer]);
  useEffect(() => {
    mounted.current = true;
    const unregister = registerWriter(writer);
    const hide = () => { if (document.visibilityState === 'hidden') void flush().catch(() => {}); };
    document.addEventListener('visibilitychange', hide);
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', hide);
      unregister();
    };
  }, [flush, writer]);
  const reset = useCallback(() => writer.reset(), [writer]);
  const discard = useCallback(async () => { if (timer.current) clearTimeout(timer.current); timer.current = null; await writer.discard(); }, [writer]);
  return { state: writer.state, schedule, flush, reset, discard };
}
