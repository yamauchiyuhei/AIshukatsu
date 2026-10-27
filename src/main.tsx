import { Buffer } from 'buffer';
// gray-matter uses Node's Buffer; polyfill it for the browser.
const g = globalThis as unknown as { Buffer?: typeof Buffer };
if (typeof g.Buffer === 'undefined') {
  g.Buffer = Buffer;
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { MagazineApp } from './magazine/MagazineApp';
import { LandingPage } from './components/LandingPage';
import { isTauri } from './lib/tauriFsaShim';
import { resolveSiteRoute } from './lib/siteRoutes.mjs';
import { publicAnalytics } from './lib/analytics';
import { HOME_TITLE, PUBLIC_ORIGIN } from './lib/publicAnalytics.mjs';
import './styles/index.css';
import './magazine/magazine.css';

// Readers do not need the private spreadsheet workspace or password-gated
// preparation tools. Load those bundles only when their existing route opens.
const App = React.lazy(() => import('./App'));
const UiShowcase = React.lazy(() => import('./UiShowcase').then(module => ({ default: module.UiShowcase })));
const Dashboard = React.lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const TgWebApp = React.lazy(() => import('./tgweb/TgWebApp').then(module => ({ default: module.TgWebApp })));
const McKinseyApp = React.lazy(() => import('./mckinsey/McKinseyApp').then(module => ({ default: module.McKinseyApp })));

// Optional visual routes — mounted via URL hash so they never interfere with
// the production auth/onboarding flow.
//   #ui        → UI primitives showcase
//   #dashboard → Flashy application dashboard preview
//   #tgweb     → TG-WEB password-gated answer search (bypasses Google login)
//   #mckinsey  → McKinsey interview Q&A (password + screen wake lock)
function currentRoute() {
  return resolveSiteRoute({ pathname: window.location.pathname, hash: window.location.hash, desktop: isTauri() });
}

function subscribeToRoute(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
  };
}

function SiteRoot() {
  const route = React.useSyncExternalStore(subscribeToRoute, currentRoute);
  React.useEffect(() => {
    if (route === 'website') {
      document.title = HOME_TITLE;
      publicAnalytics.trackPage({ canonical: PUBLIC_ORIGIN + '/', title: HOME_TITLE });
    } else if (route !== 'magazine') publicAnalytics.suspend();
    return () => publicAnalytics.suspend();
  }, [route]);
  switch (route) {
    case 'website': return <LandingPage onOpenApp={() => window.location.assign('/app/')} />;
    case 'workspace': return <App />;
    case 'ui': return <UiShowcase />;
    case 'dashboard': return <Dashboard />;
    case 'tgweb': return <TgWebApp />;
    case 'mckinsey': return <McKinseyApp />;
    default: return <MagazineApp />;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><React.Suspense fallback={<p role="status">読み込み中…</p>}><SiteRoot /></React.Suspense></React.StrictMode>,
);
