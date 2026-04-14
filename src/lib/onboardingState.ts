// localStorage wrapper to remember whether each user has already walked
// through the first-run onboarding flow. Keyed by Firebase uid so that
// switching accounts correctly re-triggers onboarding for new users.

const LEGACY_KEY = 'aisyuukatsu:onboarded';
const MIGRATION_DONE_KEY = 'aisyuukatsu:onboarded-migrated-to-uid';

function key(uid: string) {
  return `aisyuukatsu:onboarded:${uid}`;
}

export function isOnboarded(uid: string): boolean {
  try {
    if (localStorage.getItem(key(uid)) === '1') return true;
    // Migrate from legacy global key (pre-v0.2.9).
    // Only the first uid claims the legacy flag — subsequent users start fresh.
    if (localStorage.getItem(LEGACY_KEY) === '1') {
      const migratedTo = localStorage.getItem(MIGRATION_DONE_KEY);
      if (!migratedTo || migratedTo === uid) {
        localStorage.setItem(key(uid), '1');
        localStorage.setItem(MIGRATION_DONE_KEY, uid);
        return true;
      }
      // Another uid already claimed the legacy data → this is a new user.
    }
    return false;
  } catch {
    return false;
  }
}

export function markOnboarded(uid: string): void {
  try {
    localStorage.setItem(key(uid), '1');
  } catch {
    /* storage disabled – ignore */
  }
}

export function clearOnboarded(uid: string): void {
  try {
    localStorage.removeItem(key(uid));
  } catch {
    /* ignore */
  }
}
