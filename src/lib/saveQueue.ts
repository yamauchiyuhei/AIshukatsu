export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/** One writer per document. Failed and superseding edits stay pending. */
export class SaveQueue {
  state: SaveState = 'idle';
  prepare?:()=>void;
  resourceKey?:string;
  documentLabel?:string;
  owner?:string;
  detached=false;
  get pendingValue(){return this.pending?.value??null;}
  private pending: { value: string; revision: number } | null = null;
  private revision = 0;
  private running: Promise<void> | null = null;
  constructor(private save: (value: string) => Promise<void>, private notify: () => void = () => {}) {}
  get dirty() { return this.pending !== null || this.running !== null; }
  set(value: string) {
    this.pending = { value, revision: ++this.revision };
    this.state = 'dirty'; this.notify();
  }
  async discard() {
    if (this.running) { try { await this.running; } catch { /* wait until the writer stops */ } }
    this.pending = null; this.state = 'idle'; this.notify();
  }
  reset() { if (!this.dirty) { this.state = 'idle'; this.notify(); } }
  flush(): Promise<void> {
    this.prepare?.();
    if (this.running) return this.running;
    if (!this.pending) return Promise.resolve();
    this.running = Promise.resolve().then(async () => {
      while (this.pending) {
        const next = this.pending;
        this.state = 'saving'; this.notify();
        try { await this.save(next.value); }
        catch (error) { this.state = 'error'; this.notify(); throw error; }
        if (this.pending?.revision === next.revision) this.pending = null;
      }
      this.state = 'saved'; this.notify();
    }).finally(() => { this.running = null; this.notify(); });
    return this.running;
  }
}
const operations=new Set<Promise<unknown>>();
export async function trackFileOperation<T>(operation:()=>Promise<T>):Promise<T>{
  const promise=Promise.resolve().then(operation);operations.add(promise);
  try{return await promise;}finally{operations.delete(promise);}
}
const writers = new Set<SaveQueue>();
const listeners = new Set<() => void>();
let revision = 0;
export function announceSaves() { revision++; listeners.forEach(listener => listener()); }
export function registerWriter(writer: SaveQueue) {
  writer.detached=false;writers.add(writer); announceSaves();
  return () => {
    writer.detached=true;writer.prepare?.();
    if (!writer.dirty) { writers.delete(writer); announceSaves(); return; }
    void writer.flush().then(() => { writers.delete(writer); announceSaves(); }).catch(announceSaves);
  };
}
export function subscribeSaves(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function savesRevision() { return revision; }
export function pendingSaves() { return [...writers].filter(writer => writer.dirty); }
export function prepareAllSaves(){for(const writer of writers)writer.prepare?.();}
export async function flushAllSaves() {
  if(typeof document!=='undefined' && document.activeElement instanceof HTMLElement && document.activeElement.matches('input,textarea,select,[contenteditable=true]'))document.activeElement.blur();
  prepareAllSaves();
  const results:PromiseSettledResult<unknown>[] = await Promise.allSettled([...writers].map(writer => writer.flush()));
  while(operations.size){results.push(...await Promise.allSettled([...operations]));}
  if (results.some(result => result.status === 'rejected')) throw new Error('保存できない変更があります。保存先へのアクセスを確認して再試行してください。');
}
