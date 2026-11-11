import { resolveSiteRoute } from './siteRoutes.mjs';

export const MEASUREMENT_ID = 'G-SSZ23XW2M8';
export const PUBLIC_ORIGIN = 'https://aishukatsu.net';
export const HOME_TITLE = 'AI就活 — 就活をもっとスマートに';

function publicUrl(value) {
  try {
    const url = new URL(value);
    if (url.origin !== PUBLIC_ORIGIN || !/^(?:\/(?:index\.html)?|\/magazine\/(?:[a-z0-9-]+\/|page\/[1-9]\d*\/)?)$/.test(url.pathname)) return null;
    // Only editorial canonical URLs are sent; search, auth and fragment data
    // never become analytics parameters.
    return url.origin + (url.pathname === '/index.html' ? '/' : url.pathname);
  } catch { return null; }
}

function safeReferrer(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    // External referrers need only an origin for acquisition reports. Internal
    // referrers are reduced to the origin too, so arbitrary paths cannot leak.
    return url.origin + '/';
  } catch { return ''; }
}

export function createPublicAnalytics(browser, { enabled = false } = {}) {
  let initialized = false;
  let previousPage = '';
  let lastPage = '';
  const disabledKey = `ga-disable-${MEASUREMENT_ID}`;
  function suspend() { browser[disabledKey] = true; }
  function trackAction(action, placement) {
    const actions = ['mac_download', 'windows_release', 'desktop_open_request', 'download_guide', 'web_trial', 'getting_started'];
    const placements = ['landing_download', 'article_next_step', 'article_footer'];
    const route = resolveSiteRoute(browser.location);
    if (!enabled || !initialized || browser[disabledKey] || browser.location.origin !== PUBLIC_ORIGIN || !['website', 'magazine'].includes(route) || !actions.includes(action) || !placements.includes(placement)) return;
    const page = publicUrl(browser.location.href);
    if (!page) return;
    // These are requests/clicks, never successful installation or purchase.
    browser.gtag('event', 'product_click', { action, placement, page_location: page, send_to: MEASUREMENT_ID });
  }
  function trackPage({ canonical, title }) {
    const route = resolveSiteRoute(browser.location);
    const pageLocation = publicUrl(canonical);
    if (!enabled || browser.location.origin !== PUBLIC_ORIGIN || !['website', 'magazine'].includes(route) || !pageLocation) {
      suspend();
      return;
    }
    browser[disabledKey] = false;
    // Also deduplicates React StrictMode effects and changes to search text,
    // categories, theme or in-article anchors on the same canonical page.
    if (pageLocation === lastPage) return;
    const page = { page_location: pageLocation, page_title: title, page_referrer: previousPage || safeReferrer(browser.document.referrer) };
    browser.dataLayer ||= [];
    browser.gtag ||= function () { browser.dataLayer.push(arguments); };
    browser.gtag('set', page);
    if (!initialized) {
      browser.gtag('js', new Date());
      browser.gtag('config', MEASUREMENT_ID, {
        ...page, send_page_view: false,
        allow_google_signals: false, allow_ad_personalization_signals: false,
      });
      const script = browser.document.createElement('script');
      script.id = 'public-google-analytics';
      script.async = true;
      script.referrerPolicy = 'origin';
      script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
      browser.document.head.append(script);
      initialized = true;
      browser.document.addEventListener?.('click', event => {
        const link = event.target?.closest?.('a[data-product-action]');
        if (link) trackAction(link.dataset.productAction, link.dataset.productPlacement);
      });
    }
    browser.gtag('event', 'page_view', { ...page, send_to: MEASUREMENT_ID });
    previousPage = lastPage = pageLocation;
  }
  return { trackPage, trackAction, suspend };
}
