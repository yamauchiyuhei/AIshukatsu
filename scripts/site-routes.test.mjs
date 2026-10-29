import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSiteRoute } from '../src/lib/siteRoutes.mjs';

test('the public root and section links remain the website for every auth and permission state', () => {
  for (const pathname of ['/', '/index.html']) {
    for (const hash of ['', '#features', '#download', '#views', '#ai', '#stories', '#magazine', '#faq']) {
      for (const authenticated of [false, true]) {
        for (const permission of ['no-handle', 'needs-permission', 'ready']) {
          assert.equal(resolveSiteRoute({ pathname, hash, authenticated, permission }), 'website');
        }
      }
    }
  }
});

test('only the explicit browser app entry opens the workspace', () => {
  for (const pathname of ['/app', '/app/', '/app/index.html']) {
    assert.equal(resolveSiteRoute({ pathname }), 'workspace');
    assert.equal(resolveSiteRoute({ pathname, hash: '#features' }), 'workspace');
  }
  for (const pathname of ['/application', '/app/missing', '/missing']) assert.equal(resolveSiteRoute({ pathname }), 'not-found');
});

test('desktop launch still opens the existing workspace at its root', () => {
  for (const pathname of ['/', '/index.html']) {
    assert.equal(resolveSiteRoute({ pathname, desktop: true }), 'workspace');
    assert.equal(resolveSiteRoute({ pathname, hash: '#features', desktop: true }), 'workspace');
  }
});

test('legacy preview and password-gated hash routes remain available', () => {
  for (const name of ['ui', 'dashboard', 'tgweb', 'mckinsey']) {
    for (const pathname of ['/', '/app/']) assert.equal(resolveSiteRoute({ pathname, hash: '#' + name }), name);
    assert.equal(resolveSiteRoute({ pathname: '/', hash: '#' + name, desktop: true }), name);
  }
  assert.equal(resolveSiteRoute({ pathname: '/', hash: '#toString' }), 'website');
});

test('magazine routes stay public and unknown paths stay distinct', () => {
  for (const pathname of ['/magazine', '/magazine/', '/magazine/career-note/']) assert.equal(resolveSiteRoute({ pathname, hash: '#section-first' }), 'magazine');
  for (const pathname of ['/magazine-other', '/unknown/']) assert.equal(resolveSiteRoute({ pathname }), 'not-found');
});
