import type { ArticleSummary } from './types';
export function companyName(article: ArticleSummary): string;
export function filterDiscovery(articles: ArticleSummary[], options?: {industry?: string; order?: string; collection?: string; category?: string; query?: string}): ArticleSummary[];
export function articleMemo(article: ArticleSummary): string;
