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
import './styles/index.css';

// Optional visual routes — mounted via URL hash so they never interfere with
// the production auth/onboarding flow.
//   #ui        → UI primitives showcase
//   #dashboard → Flashy application dashboard preview
function pickRoot() {
  const hash = window.location.hash;
  if (hash === '#ui') return <UiShowcase />;
  if (hash === '#dashboard') return <Dashboard />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{pickRoot()}</React.StrictMode>,
);
