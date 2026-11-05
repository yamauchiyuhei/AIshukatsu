type WebsiteTheme = 'light' | 'dark';
const THEME_KEY = 'aishukatsu-website-theme';

export function readWebsiteTheme(fallback: WebsiteTheme, previousKey: string): WebsiteTheme {
  try {
    const stored = localStorage.getItem(THEME_KEY) ?? localStorage.getItem(previousKey);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* Storage may be unavailable. */ }
  return fallback;
}

export function saveWebsiteTheme(theme: WebsiteTheme) {
  try { localStorage.setItem(THEME_KEY, theme); }
  catch { /* The active page still changes theme. */ }
}
