import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { articleMemo, filterDiscovery } from '../src/magazine/discovery.mjs';
import { filterArticles } from '../src/magazine/schema.mjs';
import { readLibrary, toggleReadingRecord, visitArticle } from '../src/magazine/readingList';
import type { ArticleSummary } from '../src/magazine/types';

const articles = JSON.parse(readFileSync(new URL('../src/magazine/catalog.generated.json', import.meta.url), 'utf8')) as ArticleSummary[];
const toyota = articles.find(article => article.slug === 'company-analysis-7203')!;

test('company search distinguishes the group from its financial subsidiary and normalizes stock codes', () => {
  for (const [query,slug] of [['sony','company-analysis-6758'],['Sony Group','company-analysis-6758'],['ソニー','company-analysis-6758'],['sony financial group','company-analysis-8729'],['７２０３','company-analysis-7203'],['nintendo','company-analysis-7974']]) assert.equal(filterArticles(articles,{query})[0].slug,slug);
});
test('industry selection never hides companies without an existing classification', () => {
  const companies = articles.filter(article => article.slug.startsWith('company-analysis-'));
  const classified = filterDiscovery(companies,{industry:'メーカー'});
  const unclassified = filterDiscovery(companies,{industry:'未分類'});
  assert.ok(classified.length > 0); assert.ok(unclassified.length > 0);
  assert.ok(classified.every(article => article.companyIndustry === 'メーカー'));
  const groups = new Set(companies.map(article => article.companyIndustry || '未分類'));
  assert.equal([...groups].reduce((count,industry) => count + filterDiscovery(companies,{industry}).length,0),companies.length);
});
test('research memo retains its source and leaves research observations for the user to write', () => {
  const memo = articleMemo(toyota);
  assert.ok(memo.startsWith('# トヨタ自動車の企業研究メモ'));
  assert.ok(memo.includes('https://aishukatsu.net/magazine/company-analysis-7203/'));
  assert.ok(memo.includes('自分の経験との接点'));
  assert.ok(!memo.includes(toyota.description));
});
test('saved articles and reading progress persist without storing private app state', () => {
  const memory = new Map<string,string>();
  const storage = { getItem: (key:string) => memory.get(key) || null, setItem: (key:string,value:string) => {memory.set(key,value);} };
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
  Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});
  try {
    assert.equal(toggleReadingRecord('saved',{...toyota,privateNotes:'PRIVATE'} as ArticleSummary),true);
    assert.equal(visitArticle(toyota,'business-structure'),true);
    assert.equal(readLibrary().saved[0].slug,toyota.slug);
    assert.equal(readLibrary().history[0].section,'business-structure');
    assert.ok(![...memory.values()].join('').includes('PRIVATE'));
    toggleReadingRecord('saved',toyota);assert.equal(readLibrary().saved.length,0);
    storage.setItem('aishukatsu-reading-list-v1','{broken');assert.deepEqual(readLibrary(),{saved:[],history:[],compare:[]});
    Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('Storage disabled');}});
    assert.deepEqual(readLibrary(),{saved:[],history:[],compare:[]});assert.equal(toggleReadingRecord('saved',toyota),false);
  } finally {
    if(oldStorage)Object.defineProperty(globalThis,'localStorage',oldStorage);else Reflect.deleteProperty(globalThis,'localStorage');
    if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');
  }
});
