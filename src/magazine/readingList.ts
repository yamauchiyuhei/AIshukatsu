import { useEffect, useState } from 'react';
import type { ArticleSummary } from './types';

export type ReadingRecord = Pick<ArticleSummary, 'author' | 'slug' | 'title' | 'category' | 'description' | 'datePublished' | 'dateModified' | 'readingMinutes' | 'tags'> & { section?: string; companyIndustry?: string };
type Library = { saved: ReadingRecord[]; history: ReadingRecord[]; compare: ReadingRecord[] };
const KEY = 'aishukatsu-reading-list-v1';
const EVENT = 'aishukatsu-reading-list-change';
const empty = (): Library => ({ saved: [], history: [], compare: [] });
export function readLibrary(): Library {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '{}');
    const valid = (item: ReadingRecord) => item && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) && typeof item.title === 'string' && typeof item.description === 'string' && typeof item.datePublished === 'string' && typeof item.category === 'string' && ['self-analysis','company-research','es','interview','schedule','ai'].includes(item.category) && Array.isArray(item.tags);
    return { saved: Array.isArray(value.saved) ? value.saved.filter(valid).slice(0,60) : [], history: Array.isArray(value.history) ? value.history.filter(valid).slice(0,30) : [], compare: Array.isArray(value.compare) ? value.compare.filter(valid).slice(0,3) : [] };
  } catch { return empty(); }
}
function record(article: ArticleSummary, section?: string): ReadingRecord {
  const { author, slug, title, category, description, datePublished, dateModified, readingMinutes, tags, companyIndustry } = article;
  return { author, slug, title, category, description, datePublished, dateModified, readingMinutes, tags, companyIndustry, ...(section && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(section) ? { section } : {}) };
}
export function editLibrary(action: (library: Library) => Library) {
  try { localStorage.setItem(KEY, JSON.stringify(action(readLibrary()))); window.dispatchEvent(new Event(EVENT)); return true; } catch { return false; }
}
export function visitArticle(article: ArticleSummary, section?: string) {
  return editLibrary(library => ({ ...library, history: [record(article, section), ...library.history.filter(item => item.slug !== article.slug)].slice(0,30) }));
}
export function toggleReadingRecord(kind: 'saved' | 'compare', article: ArticleSummary) {
  return editLibrary(library => ({ ...library, [kind]: library[kind].some(item => item.slug === article.slug) ? library[kind].filter(item => item.slug !== article.slug) : [record(article), ...library[kind]].slice(0,kind === 'saved' ? 60 : 3) }));
}
export function useReadingList() {
  const [library, setLibrary] = useState<Library>(empty);
  useEffect(() => { const update = () => setLibrary(readLibrary()); update(); window.addEventListener(EVENT,update); window.addEventListener('storage',update); return () => { window.removeEventListener(EVENT,update); window.removeEventListener('storage',update); }; }, []);
  return library;
}
