export const ARTICLE_ORIGIN: string;
export const RESEARCH_MIN_VERSION: string;
export function validArticleSlug(slug: unknown): slug is string;
export function researchDeepLink(slug: string): string;
export function parseResearchDeepLink(raw: unknown): string | null;
export function publicArticleUrl(slug: string): string;
