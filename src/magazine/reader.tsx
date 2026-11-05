import './entry.css';
import './magazine.css';
import { useEffect, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { createPublicAnalytics } from '../lib/publicAnalytics.mjs';
import { MagazineView, type MagazineTheme } from './MagazineView';
import { readWebsiteTheme, saveWebsiteTheme } from '../lib/websiteTheme';
import type { Article, ArticleSummary } from './types';

const PREVIOUS_THEME_KEY = 'aishukatsu-magazine-theme';

function Reader({ article, related }: { article: Article; related: ArticleSummary[] }) {
  const [theme, setTheme] = useState<MagazineTheme>('light');

  useEffect(() => {
    setTheme(readWebsiteTheme('light', PREVIOUS_THEME_KEY));
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) {
      createPublicAnalytics(window, { enabled: import.meta.env.PROD })
        .trackPage({ canonical: canonical.href, title: document.title });
    }
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    saveWebsiteTheme(next);
  }

  return <MagazineView articles={related} article={article} page="article" theme={theme} onThemeChange={toggleTheme} />;
}

const root = document.getElementById('root');
const payload = document.getElementById('magazine-article-data');
if (root && payload?.textContent) {
  const data: { article: Article; related: ArticleSummary[] } = JSON.parse(payload.textContent);
  hydrateRoot(root, <Reader {...data} />);
}
