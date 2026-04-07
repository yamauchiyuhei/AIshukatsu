import matter from 'gray-matter';
import {
  CompanyFrontMatter,
  SELECTION_STATUSES,
  SelectionStatus,
} from '../types';

interface ParsedStatusFile {
  data: CompanyFrontMatter;
  body: string;
}

function isSelectionStatus(v: unknown): v is SelectionStatus {
  return typeof v === 'string' && (SELECTION_STATUSES as readonly string[]).includes(v);
}

export function parseStatusFile(
  raw: string,
  fallbackName: string,
): ParsedStatusFile {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (e) {
    console.warn('frontmatter parse error:', e);
    parsed = { data: {}, content: raw } as matter.GrayMatterFile<string>;
  }
  const data = (parsed.data ?? {}) as Partial<CompanyFrontMatter>;
  const now = new Date().toISOString().slice(0, 10);
  const fm: CompanyFrontMatter = {
    status: isSelectionStatus(data.status) ? data.status : '未エントリー',
    next_action_date:
      typeof data.next_action_date === 'string' ? data.next_action_date : undefined,
    next_action_label:
      typeof data.next_action_label === 'string' ? data.next_action_label : undefined,
    company_name:
      typeof data.company_name === 'string' && data.company_name.length > 0
        ? data.company_name
        : fallbackName,
    created_at: typeof data.created_at === 'string' ? data.created_at : now,
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : now,
  };
  return { data: fm, body: parsed.content };
}

export function serializeStatusFile(
  data: CompanyFrontMatter,
  body: string,
): string {
  // gray-matter の stringify は YAML を綺麗に書いてくれる
  const cleaned: Record<string, unknown> = { ...data };
  // undefined を取り除く
  Object.keys(cleaned).forEach((k) => {
    if (cleaned[k] === undefined) delete cleaned[k];
  });
  return matter.stringify(body, cleaned);
}
