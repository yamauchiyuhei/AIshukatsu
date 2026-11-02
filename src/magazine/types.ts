export type CategoryId = 'self-analysis' | 'company-research' | 'es' | 'interview' | 'schedule' | 'ai';

export interface ArticleBlock {
  type: 'paragraph' | 'note' | 'list' | 'quote';
  text?: string;
  items?: string[];
}

export interface ArticleSection {
  id: string;
  heading: string;
  blocks: ArticleBlock[];
}

export interface ArticleCoverImage {
  src: string;
  thumbnail: string;
  alt: string;
  width: number;
  height: number;
  source: 'ai-generated';
}

export interface ArticleSummary {
  slug: string;
  title: string;
  description: string;
  category: CategoryId;
  author: string;
  datePublished: string;
  dateModified: string;
  tags: string[];
  readingMinutes: number;
  featured?: boolean;
  writingAssistance?: string;
  cover?: ArticleCoverImage;
}

export interface Article extends ArticleSummary {
  status: 'published';
  lead: string;
  sections: ArticleSection[];
  sources: { title: string; url: string }[];
}

export interface Category {
  id: CategoryId;
  label: string;
  english: string;
  description: string;
}
