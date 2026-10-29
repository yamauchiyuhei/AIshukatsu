export const MEASUREMENT_ID: string;
export const PUBLIC_ORIGIN: string;
export const HOME_TITLE: string;
export interface PublicAnalytics {
  trackPage(page: { canonical: string; title: string }): void;
  suspend(): void;
}
export function createPublicAnalytics(browser: Window, options?: { enabled?: boolean }): PublicAnalytics;
