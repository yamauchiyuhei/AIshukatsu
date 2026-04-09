import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { isTauri } from '../../lib/tauriFsaShim';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

/** True only if all required keys are present. */
export const firebaseEnabled = Boolean(
  cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId,
);

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

if (firebaseEnabled) {
  app = initializeApp({
    apiKey: cfg.apiKey!,
    authDomain: cfg.authDomain!,
    projectId: cfg.projectId!,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId!,
  });
  _auth = getAuth(app);
  _db = getFirestore(app);
}

export const auth = _auth;
export const db = _db;

/**
 * URL of the hosted desktop sign-in page. In production this is served from
 * Firebase Hosting alongside the main SPA. The Vite env var
 * `VITE_DESKTOP_AUTH_URL` can override it (e.g. during local testing).
 */
const DESKTOP_AUTH_URL =
  (import.meta.env.VITE_DESKTOP_AUTH_URL as string | undefined) ??
  'https://aisyuukatsu-30fdd.web.app/desktop-auth.html';

/**
 * Sign in with Google.
 *
 * - In a browser: opens the standard Firebase popup flow.
 * - In the Tauri desktop app: opens the user's default browser to the hosted
 *   desktop-auth page, waits for the `aisyuukatsu://auth-callback` deep link
 *   to come back, then exchanges the OAuth credential locally.
 */
export async function signInWithGoogle(): Promise<User | null> {
  if (!_auth) throw new Error('Firebase が設定されていません (.env.local)');

  if (isTauri()) {
    return await signInWithGoogleViaDeepLink(_auth);
  }

  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(_auth, provider);
  return result.user;
}

async function signInWithGoogleViaDeepLink(authInstance: Auth): Promise<User | null> {
  const [{ onOpenUrl }, shell] = await Promise.all([
    import('@tauri-apps/plugin-deep-link'),
    import('@tauri-apps/plugin-shell'),
  ]);

  // Resolve on the first `auth-callback` deep link we see.
  const credPromise = new Promise<{ idToken: string; accessToken?: string }>(
    (resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('サインインがタイムアウトしました (5分)'));
      }, 5 * 60 * 1000);

      void onOpenUrl((urls: string[]) => {
        if (settled) return;
        for (const raw of urls) {
          try {
            const u = new URL(raw);
            if (u.protocol !== 'aisyuukatsu:') continue;
            if (u.host !== 'auth-callback' && u.pathname !== '//auth-callback') {
              // Deep link URLs from different platforms put the "host" in
              // different places — accept either shape.
              if (!raw.includes('auth-callback')) continue;
            }
            const idToken = u.searchParams.get('idToken');
            const accessToken = u.searchParams.get('accessToken') ?? undefined;
            if (!idToken) continue;
            settled = true;
            window.clearTimeout(timer);
            resolve({ idToken, accessToken });
            return;
          } catch {
            // Ignore malformed URLs.
          }
        }
      });
    },
  );

  // Kick off the external browser.
  await shell.open(DESKTOP_AUTH_URL);

  const { idToken, accessToken } = await credPromise;
  const cred = GoogleAuthProvider.credential(idToken, accessToken);
  const result = await signInWithCredential(authInstance, cred);
  return result.user;
}

export async function signOut(): Promise<void> {
  if (!_auth) return;
  await fbSignOut(_auth);
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  if (!_auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(_auth, cb);
}

export type { User };
