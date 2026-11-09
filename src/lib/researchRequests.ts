import { validArticleSlug } from './researchLinks.mjs';

export interface ResearchRequest { id: string; slug: string; receivedAt: number }
const KEY = 'aishukatsu-pending-research-v1';
const MAX_AGE = 24 * 60 * 60 * 1000;
type StorageLike = Pick<Storage,'getItem'|'setItem'>;
/** A bounded, public-article-only queue survives login, setup and restart. */
export class ResearchRequestQueue {
  private requests: ResearchRequest[] = [];
  private listeners = new Set<() => void>();
  private loaded = false;
  constructor(private storage: () => StorageLike | null = () => localStorage, private now = Date.now) {}
  private read() {
    if (!this.loaded) {
      this.loaded = true;
      try { const value = JSON.parse(this.storage()?.getItem(KEY) || '[]'); if (Array.isArray(value)) this.requests = value.filter(item => item && typeof item.id === 'string' && validArticleSlug(item.slug) && Number.isFinite(item.receivedAt)).slice(0,10); } catch { /* memory-only reception still works */ }
    }
    const now = this.now();
    this.requests = this.requests.filter(item => now >= item.receivedAt && now - item.receivedAt < MAX_AGE);
    return this.requests;
  }
  private changed() {
    try { this.storage()?.setItem(KEY,JSON.stringify(this.requests)); } catch { /* storage refusal must not lose the active request */ }
    this.listeners.forEach(listener => listener());
  }
  current() { return this.read()[0] || null; }
  pending() { return [...this.read()]; }
  enqueue(slug: string) {
    if (!validArticleSlug(slug)) return false;
    const requests = this.read();
    if (requests.some(item => item.slug === slug)) return true;
    if (requests.length >= 10) return false;
    this.requests = [...requests,{id:globalThis.crypto?.randomUUID?.() || `${this.now()}-${Math.random().toString(36).slice(2)}`,slug,receivedAt:this.now()}];
    this.changed(); return true;
  }
  complete(id: string) { this.requests = this.read().filter(item => item.id !== id); this.changed(); }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
}
export const researchRequests = new ResearchRequestQueue();
