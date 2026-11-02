export type SiteRoute = 'website' | 'workspace' | 'magazine' | 'ui' | 'dashboard' | 'tgweb' | 'mckinsey' | 'not-found';
export function resolveSiteRoute(location: { pathname: string; hash?: string; desktop?: boolean }): SiteRoute;
