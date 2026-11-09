import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, setPersistence, inMemoryPersistence, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { firebaseEnabled } from '../spreadsheet/lib/firebase';
import { isTauri } from '../lib/tauriFsaShim';
import { useSyncExternalStore } from 'react';
export type GoogleService = 'calendar' | 'gmail';
export const GOOGLE_SCOPES = {
  calendar: ['https://www.googleapis.com/auth/calendar.app.created','https://www.googleapis.com/auth/calendar.freebusy'],
  gmail: ['https://www.googleapis.com/auth/gmail.readonly'],
};
export interface GoogleSession { token:string; uid:string; email:string; expiresAt:number; }
const sessions = new Map<GoogleService,GoogleSession>(); const listeners=new Set<()=>void>();let revision=0;let owner='';
const notify=()=>{revision++;listeners.forEach(f=>f());};
export function googleSession(service:GoogleService){const s=sessions.get(service);return s&&s.expiresAt>Date.now()?s:null;}
export function useGoogleConnections(){useSyncExternalStore(cb=>{listeners.add(cb);return()=>{listeners.delete(cb);};},()=>revision);return {calendar:googleSession('calendar'),gmail:googleSession('gmail')};}
export function clearGoogleConnection(service?:GoogleService){if(service)sessions.delete(service);else sessions.clear();notify();}
export function setGoogleConnectionOwner(next:string){if(next!==owner){owner=next;clearGoogleConnection();}}
export function validGoogleCallback(raw:string,pending:{state:string;service:GoogleService;createdAt:number;uid?:string},now=Date.now()){
  try{const url=new URL(raw);const p=new URLSearchParams(url.hash.slice(1));if(url.protocol!=='aisyuukatsu:'||url.hostname!=='google-connect'||url.username||url.password||now<pending.createdAt||now-pending.createdAt>300000||p.get('state')!==pending.state||p.get('service')!==pending.service||!p.get('token')||!p.get('uid')||(pending.uid&&p.get('uid')!==pending.uid))return null;return {token:p.get('token')!,uid:p.get('uid')!,email:p.get('email')??'',expiresAt:now+50*60000};}catch{return null;}
}
export async function googlePopup(service:GoogleService):Promise<GoogleSession>{
  if(!firebaseEnabled)throw new Error('Google連携の設定がありません。メールの貼り付けとカレンダーファイルはそのまま使えます。');
  const app=getApps().find(a=>a.name==='career-integrations')??initializeApp(getApp().options,'career-integrations');const auth=getAuth(app);await setPersistence(auth,inMemoryPersistence);
  const p=new GoogleAuthProvider();GOOGLE_SCOPES[service].forEach(s=>p.addScope(s));p.setCustomParameters({prompt:'select_account'});
  try{const result=await signInWithPopup(auth,p);const credential=GoogleAuthProvider.credentialFromResult(result);if(!credential?.accessToken)throw new Error('連携する権限を確認できませんでした。Googleの許可画面でもう一度確認してください。');return {token:credential.accessToken,uid:result.user.uid,email:result.user.email??'',expiresAt:Date.now()+50*60000};}finally{await signOut(auth);}
}
export async function connectGoogle(service:GoogleService,expectedUid?:string):Promise<GoogleSession>{
  const initialOwner=owner;let session:GoogleSession;
  if(!isTauri())session=await googlePopup(service);
  else{
    const {onOpenUrl}=await import('@tauri-apps/plugin-deep-link');const {open}=await import('@tauri-apps/plugin-shell');
    const state=crypto.randomUUID();const pending={state,service,createdAt:Date.now(),uid:expectedUid};
    const target=new URL('https://aisyuukatsu-30fdd.firebaseapp.com/google-connect.html');target.searchParams.set('state',state);target.searchParams.set('service',service);
    session=await new Promise<GoogleSession>((resolve,reject)=>{let unlisten=()=>{};let done=false;const finish=(s?:GoogleSession,e?:Error)=>{if(done)return;done=true;clearTimeout(timer);unlisten();if(s)resolve(s);else reject(e??new Error('接続を完了できませんでした。'));};const timer=setTimeout(()=>finish(undefined,new Error('接続の有効時間が過ぎました。もう一度接続してください。')),300000);
      void onOpenUrl(urls=>{for(const raw of urls){const result=validGoogleCallback(raw,pending);if(result)finish(result);}}).then(off=>{unlisten=off;if(done)off();else void open(target.href).catch(()=>finish(undefined,new Error('ブラウザを開けませんでした。')));}).catch(()=>finish(undefined,new Error('Google接続の受け取りを準備できませんでした。')));
    });
  }
  if(owner!==initialOwner)throw new Error('保存先またはログイン状態が変わりました。もう一度接続してください。');
  if(expectedUid&&session.uid!==expectedUid)throw new Error('AI就活にログインしているGoogleアカウントを選んでください。');
  sessions.set(service,session);notify();setTimeout(()=>{if(sessions.get(service)===session){sessions.delete(service);notify();}},50*60000);return session;
}
