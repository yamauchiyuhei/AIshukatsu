// Tiny localStorage wrapper to remember whether the user has already walked
// through the first-run onboarding flow. Kept intentionally dependency-free
// so it can be imported from any layer without pulling in stores.

const KEY = 'aisyuukatsu:onboarded';

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* storage disabled – ignore */
  }
}

export function clearOnboarded(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
