import { isTauri } from './tauriFsaShim';
import { parseResearchDeepLink } from './researchLinks.mjs';
import { researchRequests } from './researchRequests';
let installed: Promise<void> | null = null;
export function receiveResearchUrls(urls: string[]) {
  for (const raw of urls) {
    const slug = parseResearchDeepLink(raw);
    if (slug && !researchRequests.enqueue(slug)) window.dispatchEvent(new Event('aishukatsu-research-queue-full'));
  }
}
export function installDesktopResearch() {
  if (!isTauri()) return Promise.resolve();
  if (installed) return installed;
  installed = (async () => {
    const {onOpenUrl,getCurrent} = await import('@tauri-apps/plugin-deep-link');
    // Listen before retrieving cold-start URLs so a warm link cannot fall
    // between the two operations. The queue deduplicates both deliveries.
    await onOpenUrl(receiveResearchUrls);
    receiveResearchUrls(await getCurrent() || []);
  })().catch(error => { installed = null; throw error; });
  return installed;
}
