// Standalone sign-in page for the Tauri desktop app.
//
// Flow:
//   1. Desktop app opens this page in the user's default browser.
//   2. This page runs `signInWithPopup` (Firebase Auth) against Google.
//   3. On success, it extracts the OAuth credential (idToken + accessToken)
//      and redirects to `aisyuukatsu://auth-callback?idToken=...&accessToken=...`
//   4. The desktop app catches the deep link, calls `signInWithCredential`
//      with the same credential, and the user is now signed in inside the app.
//
// Why go through an external browser?
//   - Tauri webviews don't have the persistent OAuth cookies the user already
//     has in Chrome/Safari, so popup-based auth inside Tauri is a poor UX
//     (and Google explicitly blocks auth in embedded webviews on some flows).

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as
    | string
    | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const statusEl = document.getElementById('status') as HTMLParagraphElement | null;
const errEl = document.getElementById('error') as HTMLParagraphElement | null;
const retryBtn = document.getElementById('retry') as HTMLButtonElement | null;

function setStatus(text: string) {
  if (statusEl) statusEl.textContent = text;
}
function setError(text: string) {
  if (errEl) errEl.textContent = text;
  if (retryBtn) retryBtn.style.display = 'inline-block';
}

async function runSignIn() {
  if (errEl) errEl.textContent = '';
  if (retryBtn) retryBtn.style.display = 'none';
  setStatus('Google アカウントでサインインしています…');

  if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId) {
    setError('Firebase の設定が見つかりません (.env.local)');
    return;
  }

  try {
    const app = initializeApp({
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      storageBucket: cfg.storageBucket,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
    });
    const auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    // Explicit scopes aren't strictly required for Firestore access, but
    // asking for them here makes the idToken usable for `signInWithCredential`
    // downstream without an extra round-trip.
    const result = await signInWithPopup(auth, provider);
    const cred = GoogleAuthProvider.credentialFromResult(result);
    if (!cred || !cred.idToken) {
      setError('認証情報の取得に失敗しました');
      return;
    }

    const params = new URLSearchParams();
    params.set('idToken', cred.idToken);
    if (cred.accessToken) params.set('accessToken', cred.accessToken);

    const target = `aisyuukatsu://auth-callback?${params.toString()}`;
    setStatus('サインインに成功しました。デスクトップアプリに戻ります…');
    // Navigate to the custom scheme. The OS hands the URL off to the
    // already-running Tauri app (via the single-instance plugin).
    window.location.href = target;
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : String(err);
    setError(`サインインに失敗しました: ${msg}`);
    setStatus('');
  }
}

if (retryBtn) {
  retryBtn.addEventListener('click', () => {
    void runSignIn();
  });
}

void runSignIn();
