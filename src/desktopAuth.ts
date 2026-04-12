// Standalone sign-in page for the Tauri desktop app.
//
// Flow (redirect-based to sidestep Chrome's 3rd-party cookie blocking):
//   1. Desktop app opens this page in the user's default browser.
//   2. On load, we call `getRedirectResult()`. If we are returning from
//      Google with a valid credential, step 5 runs immediately.
//   3. Otherwise, we show a "Google でサインイン" button and wait for a click.
//   4. On click, `signInWithRedirect()` navigates the tab to Google.
//      After the user signs in, Google redirects back to this same page.
//   5. We extract the OAuth credential (idToken + accessToken) and navigate
//      to `aisyuukatsu://auth-callback?idToken=...&accessToken=...`.
//   6. The desktop app catches the deep link via plugin-deep-link, calls
//      `signInWithCredential`, and the user is now signed in inside the app.

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  browserLocalPersistence,
  setPersistence,
  type Auth,
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
const signinBtn = document.getElementById('signin') as HTMLButtonElement | null;
const returnLink = document.getElementById('returnLink') as HTMLAnchorElement | null;

function setStatus(text: string) {
  if (statusEl) statusEl.textContent = text;
}
function setError(text: string) {
  if (errEl) errEl.textContent = text;
  if (signinBtn) {
    signinBtn.disabled = false;
    signinBtn.style.display = 'inline-block';
    signinBtn.textContent = 'もう一度試す';
  }
}

function initFirebaseAuth(): Auth | null {
  if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId) {
    setError('Firebase の設定が見つかりません (.env.local)');
    return null;
  }
  const app = initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  });
  return getAuth(app);
}

function handleCredential(
  idToken: string | null | undefined,
  accessToken: string | null | undefined,
) {
  if (!idToken) {
    setError('認証情報 (idToken) の取得に失敗しました');
    return;
  }
  const params = new URLSearchParams();
  params.set('idToken', idToken);
  if (accessToken) params.set('accessToken', accessToken);
  const target = `aisyuukatsu://auth-callback?${params.toString()}`;

  setStatus(
    'サインインに成功しました。下のボタンを押してデスクトップアプリに戻ってください。',
  );

  // Hide the sign-in button — it's no longer needed.
  if (signinBtn) {
    signinBtn.style.display = 'none';
  }

  // Show a real <a href="aisyuukatsu://..."> anchor. Chrome honors direct
  // anchor clicks to custom schemes much more reliably than scripted
  // window.location navigation — even with a user gesture, the latter is
  // sometimes silently blocked.
  if (returnLink) {
    returnLink.href = target;
    returnLink.style.display = 'inline-block';
    // Focus the link so the user can also press Enter to activate it.
    try {
      returnLink.focus();
    } catch {
      /* ignored */
    }
  } else {
    // Fallback: no anchor element available — attempt scripted navigation.
    window.location.href = target;
  }
}

async function startSignIn(auth: Auth) {
  if (signinBtn) {
    signinBtn.disabled = true;
    signinBtn.textContent = 'Google に移動しています…';
  }
  setStatus('Google のサインインページに移動します…');
  try {
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
    // Browser navigates away here; nothing after this runs.
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : String(err);
    setError(`サインインに失敗しました: ${msg}`);
    setStatus('下のボタンを押して Google アカウントでサインインしてください。');
  }
}

async function main() {
  const auth = initFirebaseAuth();
  if (!auth) return;

  // Case 1: We're returning from Google with a redirect result.
  try {
    setStatus('サインイン状態を確認しています…');
    const result = await getRedirectResult(auth);
    if (result) {
      const cred = GoogleAuthProvider.credentialFromResult(result);
      handleCredential(cred?.idToken, cred?.accessToken);
      return;
    }
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : String(err);
    setError(`リダイレクト結果の取得に失敗しました: ${msg}`);
    return;
  }

  // Case 2: Fresh visit — wait for the user to click the sign-in button.
  setStatus('下のボタンを押して Google アカウントでサインインしてください。');
  if (signinBtn) {
    signinBtn.disabled = false;
    signinBtn.textContent = 'Google でサインイン';
    signinBtn.addEventListener('click', () => {
      void startSignIn(auth);
    });
  }
}

void main();
