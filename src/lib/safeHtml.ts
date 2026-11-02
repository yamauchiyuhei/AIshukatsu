import DOMPurify from 'dompurify';
/** Imported files and generated HTML are untrusted, including their links. */
export function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['iframe', 'object', 'embed', 'form', 'input', 'button', 'style'], FORBID_ATTR: ['srcdoc'], ALLOW_UNKNOWN_PROTOCOLS: false });
}
export function safeExternalUrl(value: string): string | null {
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; }
}
