import { createPublicAnalytics } from './publicAnalytics.mjs';
import { isTauri } from './tauriFsaShim';

export const publicAnalytics = createPublicAnalytics(window, {
  enabled: import.meta.env.PROD && !isTauri(),
});
