import { validateAuthCallback } from '../../lib/authCallback';
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

const runtimeEnv = import.meta.env ?? {};
const cfg = {
  apiKey: runtimeEnv.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: runtimeEnv.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: runtimeEnv.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: runtimeEnv.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: runtimeEnv.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: runtimeEnv.VITE_FIREBASE_APP_ID as string | undefined,
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
  (runtimeEnv.VITE_DESKTOP_AUTH_URL as string | undefined) ??
  // IMPORTANT: must match Firebase `authDomain` (firebaseapp.com), NOT web.app.
  // signInWithRedirect stores pending-state in IndexedDB on the authDomain
  // origin; serving this page from a different origin breaks getRedirectResult
  // due to Chrome's storage partitioning.
  'https://aisyuukatsu-30fdd.firebaseapp.com/desktop-auth-v2.html';

/**
 * Sign in with Google.
 *
 * - In a browser: opens the standard Firebase popup flow.
 * - In the Tauri desktop app: opens the user's default browser to the hosted
 *   desktop-auth page, waits for the `aisyuukatsu://auth-callback` deep link
 *   to come back, then exchanges the OAuth credential locally.
 */
export async function signInWithGoogle(signal?: AbortSignal): Promise<User | null> {
  if (!_auth) throw new Error('Firebase が設定されていません (.env.local)');

  if (isTauri()) {
    return await signInWithGoogleViaDeepLink(_auth, signal);
  }

  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(_auth, provider);
  return result.user;
}

const PENDING_AUTH = 'aishukatsu-pending-desktop-auth';
let desktopListener: Promise<void> | null = null;
async function installDesktopAuth(authInstance: Auth) {
  if (!isTauri()) return;
  if (desktopListener) return desktopListener;
  desktopListener = (async () => {
    const { onOpenUrl, getCurrent } = await import('@tauri-apps/plugin-deep-link');
    const receive = async (raw: string) => {
      try {
        const pending = JSON.parse(localStorage.getItem(PENDING_AUTH) ?? 'null');
        const callback=validateAuthCallback(raw,pending);
        if(!callback)return;
        localStorage.removeItem(PENDING_AUTH);
        const credential=GoogleAuthProvider.credential(callback.idToken,callback.accessToken);
        await signInWithCredential(authInstance,credential);
      } catch { window.dispatchEvent(new Event('aishukatsu-auth-error')); }
    };
    await onOpenUrl(urls=>{for(const url of urls)void receive(url);});
    for(const url of await getCurrent() ?? [])void receive(url);
  })().catch(()=>{desktopListener=null;window.dispatchEvent(new Event('aishukatsu-auth-error'));});
  return desktopListener;
}
async function signInWithGoogleViaDeepLink(authInstance: Auth, signal?: AbortSignal): Promise<User | null> {
  await installDesktopAuth(authInstance);
  if(signal?.aborted)throw new DOMException('キャンセルしました','AbortError');
  const state=crypto.randomUUID();
  localStorage.setItem(PENDING_AUTH,JSON.stringify({state,createdAt:Date.now()}));
  const target=new URL(DESKTOP_AUTH_URL);target.searchParams.set('state',state);
  const {open}=await import('@tauri-apps/plugin-shell');
  return new Promise<User | null>((resolve,reject)=>{
    let done=false;let unsubscribe:()=>void=()=>{};
    const finish=(user:User|null,error?:Error)=>{
      if(done)return;done=true;clearTimeout(timer);unsubscribe();signal?.removeEventListener('abort',cancel);window.removeEventListener('aishukatsu-auth-error',failed);
      try{if(JSON.parse(localStorage.getItem(PENDING_AUTH)??'null')?.state===state)localStorage.removeItem(PENDING_AUTH);}catch{}
      if(error)reject(error);else resolve(user);
    };
    const cancel=()=>finish(null,new DOMException('ログインをキャンセルしました','AbortError'));
    const failed=()=>finish(null,new Error('ログインを完了できませんでした。アプリからもう一度開始してください。'));
    const timer=setTimeout(()=>finish(null,new Error('ログインの有効時間が過ぎました。もう一度開始してください。')),5*60*1000);
    signal?.addEventListener('abort',cancel,{once:true});window.addEventListener('aishukatsu-auth-error',failed);
    unsubscribe=onAuthStateChanged(authInstance,user=>{if(user)finish(user);});
    void open(target.href).catch(failed);
  });
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
  void installDesktopAuth(_auth);
  return onAuthStateChanged(_auth, cb);
}

export type { User };
