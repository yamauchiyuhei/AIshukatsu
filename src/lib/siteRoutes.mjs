const previews = { '#ui': 'ui', '#dashboard': 'dashboard', '#tgweb': 'tgweb', '#mckinsey': 'mckinsey' };

// Public website routing deliberately does not depend on authentication or
// stored directory permissions. Only the workspace mounts those stateful gates.
export function resolveSiteRoute({ pathname, hash = '', desktop = false }) {
  const root = pathname === '/' || pathname === '/index.html';
  const workspace = ['/app', '/app/', '/app/index.html'].includes(pathname);
  if (root || workspace) {
    if (Object.hasOwn(previews, hash)) return previews[hash];
    if (desktop || workspace) return 'workspace';
    return 'website';
  }
  if (/^\/magazine(?:\/|$)/.test(pathname)) return 'magazine';
  return 'not-found';
}
