import { Buffer } from 'buffer';
// gray-matter uses Node's Buffer; polyfill it for the browser.
const g = globalThis as unknown as { Buffer?: typeof Buffer };
if (typeof g.Buffer === 'undefined') {
  g.Buffer = Buffer;
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UiShowcase } from './UiShowcase';
import { Dashboard } from './components/Dashboard';
import { TgWebApp } from './tgweb/TgWebApp';
import { McKinseyApp } from './mckinsey/McKinseyApp';
import './styles/index.css';

// Optional visual routes — mounted via URL hash so they never interfere with
// the production auth/onboarding flow.
//   #ui        → UI primitives showcase
//   #dashboard → Flashy application dashboard preview
//   #tgweb     → TG-WEB password-gated answer search (bypasses Google login)
//   #mckinsey  → McKinsey interview Q&A (password + screen wake lock)
function pickRoot() {
  const hash = window.location.hash;
  if (hash === '#ui') return <UiShowcase />;
  if (hash === '#dashboard') return <Dashboard />;
  if (hash === '#tgweb') return <TgWebApp />;
  if (hash === '#mckinsey') return <McKinseyApp />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{pickRoot()}</React.StrictMode>,
);
