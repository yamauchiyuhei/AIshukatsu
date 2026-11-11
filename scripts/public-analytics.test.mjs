import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPublicAnalytics, MEASUREMENT_ID, PUBLIC_ORIGIN } from '../src/lib/publicAnalytics.mjs';

function fixture(path = '/', enabled = true, referrer = '', storage = new Map()) {
  const scripts = [], listeners = {};
  const browser = {
    addEventListener: (name, fn) => { listeners[name] = fn; },
    location: new URL(path, PUBLIC_ORIGIN),
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    document: { referrer, createElement: () => ({}), head: { append: script => scripts.push(script) } },
  };
  const analytics = createPublicAnalytics(browser, { enabled });
  const calls = () => (browser.dataLayer || []).map(args => Array.from(args));
  const views = () => calls().filter(args => args[0] === 'event' && args[1] === 'page_view');
  return { browser, scripts, analytics, calls, views, listeners };
}
const home = { canonical: PUBLIC_ORIGIN + '/', title: 'AI就活' };
const article = { canonical: PUBLIC_ORIGIN + '/magazine/interview-guide/', title: '面接対策 | AI就活マガジン' };

test('public tracking loads one tag, counts once per page and disables automatic views and ads', () => {
  const f = fixture();
  f.analytics.trackPage(home);
  f.analytics.suspend();
  f.analytics.trackPage(home); // StrictMode re-mount
  assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].referrerPolicy, 'origin');
  assert.equal(f.views().length, 1);
  assert.equal(f.browser[`ga-disable-${MEASUREMENT_ID}`], false);
  const config = f.calls().find(args => args[0] === 'config')[2];
  assert.equal(config.send_page_view, false);
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
});

test('private workspace, previews, unknown routes, desktop/development and other hosts never load a tag', () => {
  for (const path of ['/app/', '/app/#tgweb', '/#dashboard', '/#tgweb', '/#mckinsey', '/#ui', '/desktop-auth.html', '/missing/', 'http://localhost:5173/', 'https://example.com/']) {
    const f = fixture(path);
    f.analytics.trackPage(home);
    assert.equal(f.scripts.length, 0, path);
    assert.equal(f.views().length, 0, path);
    assert.equal(f.browser[`ga-disable-${MEASUREMENT_ID}`], true, path);
  }
  const disabled = fixture('/', false);
  disabled.analytics.trackPage(home);
  assert.equal(disabled.scripts.length, 0);
});

test('search/auth fragments and referrer queries or arbitrary paths cannot enter analytics', () => {
  const f = fixture('/magazine/?q=private-name&code=secret#private-file', true, 'https://google.com/search?q=private-name#secret');
  f.analytics.trackPage({ canonical: PUBLIC_ORIGIN + '/magazine/?q=private-name#private-file', title: 'マガジン' });
  const event = f.views()[0][2];
  assert.equal(event.page_location, PUBLIC_ORIGIN + '/magazine/');
  assert.equal(event.page_referrer, 'https://google.com/');
  assert.doesNotMatch(JSON.stringify(f.calls()), /private|secret/);
  const internal = fixture('/', true, PUBLIC_ORIGIN + '/app/private-file?email=private-name');
  internal.analytics.trackPage(home);
  assert.equal(internal.views()[0][2].page_referrer, PUBLIC_ORIGIN + '/');
});

test('canonical pagination and back navigation produce views with the correct previous public page', () => {
  const f = fixture('/magazine/');
  const listing = { canonical: PUBLIC_ORIGIN + '/magazine/', title: 'マガジン' };
  f.analytics.trackPage(listing);
  f.browser.location = new URL(PUBLIC_ORIGIN + '/magazine/?q=private&page=2');
  f.analytics.trackPage({ canonical: PUBLIC_ORIGIN + '/magazine/page/2/', title: 'マガジン（2ページ目）' });
  f.analytics.trackPage({ canonical: PUBLIC_ORIGIN + '/magazine/page/2/', title: 'マガジン（2ページ目）' });
  f.browser.location = new URL(PUBLIC_ORIGIN + '/magazine/');
  f.analytics.trackPage(listing);
  assert.equal(f.views().length, 3);
  assert.equal(f.views()[1][2].page_referrer, listing.canonical);
  assert.equal(f.views()[2][2].page_referrer, PUBLIC_ORIGIN + '/magazine/page/2/');
});

test('article metadata is used and entering a private preview suspends all collection', () => {
  const f = fixture('/magazine/interview-guide/');
  f.analytics.trackPage(article);
  assert.equal(f.views()[0][2].page_title, article.title);
  f.browser.location = new URL(PUBLIC_ORIGIN + '/#tgweb');
  f.analytics.trackPage(home);
  assert.equal(f.browser[`ga-disable-${MEASUREMENT_ID}`], true);
  assert.equal(f.views().length, 1);
});

test('invalid or non-public canonical URLs fail closed', () => {
  for (const canonical of ['bad', PUBLIC_ORIGIN + '/app/', 'https://example.com/', PUBLIC_ORIGIN + '/desktop-auth.html', PUBLIC_ORIGIN + '/magazine/private%40email/']) {
    const f = fixture();
    f.analytics.trackPage({ ...home, canonical });
    assert.equal(f.views().length, 0, canonical);
    assert.equal(f.scripts.length, 0, canonical);
  }
});

test('public HTML revalidates after deploy while fingerprinted images and scripts stay immutable', async () => {
  const config = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8'));
  const rule = config.hosting.headers.find(rule => rule.regex);
  const matcher = new RegExp(rule.regex);
  assert.match(rule.headers[0].value, /no-cache/);
  for (const path of ['/', '/index.html', '/404.html', '/magazine', '/magazine/', '/magazine/index.html', '/magazine/find-your-own-career-axis/', '/magazine/find-your-own-career-axis/index.html', '/magazine/page/2/', '/magazine/page/42/index.html']) assert.equal(matcher.test(path), true, path);
  for (const path of ['/assets/main-123.js', '/magazine/covers/photo-123.webp', '/magazine/articles/article.json']) assert.equal(matcher.test(path), false, path);
});


test('product clicks are whitelisted, privacy safe and disabled on private routes', () => {
  const f = fixture('/magazine/interview-guide/?email=secret#private');
  f.analytics.trackPage(article);
  f.analytics.trackAction('desktop_open_request', 'article_next_step');
  f.analytics.trackAction('purchase', 'article_next_step');
  f.analytics.trackAction('mac_download', 'secret');
  f.browser.location = new URL('/app/?email=secret', PUBLIC_ORIGIN);
  f.analytics.trackAction('mac_download', 'landing_download');
  const clicks = f.calls().filter(args => args[1] === 'product_click');
  assert.equal(clicks.length, 1);
  assert.equal(clicks[0][2].page_location, article.canonical);
  assert.doesNotMatch(JSON.stringify(clicks), /secret|private|email|purchase/);
});


test('operator opt-out persists across pages and on explicitly restores public tracking', () => {
  const storage = new Map();
  const off = fixture('/?metrics=off', true, '', storage);
  off.analytics.trackPage(home);
  off.analytics.trackAction('mac_download', 'landing_download');
  assert.equal(storage.get('site_metrics_exclude'), '1');
  assert.equal(off.scripts.length, 0);
  assert.equal(off.calls().length, 0);
  assert.equal(off.browser[`ga-disable-${MEASUREMENT_ID}`], true);
  const next = fixture('/magazine/interview-guide/', true, '', storage);
  next.analytics.trackPage(article);
  assert.equal(next.scripts.length, 0);
  const on = fixture('/?metrics=on&email=private', true, PUBLIC_ORIGIN + '/?metrics=off', storage);
  on.analytics.trackPage(home);
  assert.equal(storage.has('site_metrics_exclude'), false);
  assert.equal(on.views().length, 1);
  assert.doesNotMatch(JSON.stringify(on.calls()), /metrics|private/);
});

test('URL opt-out works without storage and remains effective during SPA navigation', () => {
  const blocked = new Proxy({}, { get() { throw new Error('Storage blocked'); } });
  const f = fixture('/?metrics=off', true, '', blocked);
  f.analytics.trackPage(home);
  f.browser.location = new URL('/magazine/interview-guide/', PUBLIC_ORIGIN);
  f.analytics.trackPage(article);
  f.analytics.trackAction('desktop_open_request', 'article_next_step');
  assert.equal(f.scripts.length, 0);
  assert.equal(f.calls().length, 0);
  f.browser.location = new URL('/?metrics=on', PUBLIC_ORIGIN);
  f.analytics.trackPage(home);
  assert.equal(f.views().length, 1);
});

test('opt-out after initialization suspends later page views and clicks', () => {
  const storage = new Map();
  const f = fixture('/', true, '', storage);
  f.analytics.trackPage(home);
  const count = f.calls().length;
  storage.set('site_metrics_exclude', '1');
  f.listeners.storage();
  assert.equal(f.browser[`ga-disable-${MEASUREMENT_ID}`], true);
  f.analytics.trackAction('mac_download', 'landing_download');
  f.browser.location = new URL('/magazine/interview-guide/', PUBLIC_ORIGIN);
  f.analytics.trackPage(article);
  assert.equal(f.calls().length, count);
  assert.equal(f.browser[`ga-disable-${MEASUREMENT_ID}`], true);
});

test('metrics=on never bypasses private route, development or production-host guards', () => {
  for (const path of ['/app/?metrics=on', '/?metrics=on#dashboard', 'https://example.com/?metrics=on']) {
    const f = fixture(path, true, '', new Map([['site_metrics_exclude', '1']]));
    f.analytics.trackPage(home);
    assert.equal(f.scripts.length, 0, path);
  }
  const dev = fixture('/?metrics=on', false);
  dev.analytics.trackPage(home);
  assert.equal(dev.scripts.length, 0);
});
