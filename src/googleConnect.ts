import { googlePopup, type GoogleService } from './career/googleAuth';
const p=new URL(location.href).searchParams;const state=p.get('state');const service=p.get('service') as GoogleService;
const status=document.getElementById('status')!;const button=document.getElementById('connect') as HTMLButtonElement;const link=document.getElementById('return') as HTMLAnchorElement;
if(state&&/^[a-f0-9-]{36}$/i.test(state)&&['calendar','gmail'].includes(service)){
  status.textContent=service==='gmail'?'選んだメールから予定を取り込むため、Gmailの読み取りを許可します。送信・削除は行いません。':'AI就活の専用カレンダーへの登録と、メインカレンダーの空き時間の確認を許可します。';button.hidden=false;
  button.onclick=async()=>{button.disabled=true;try{const s=await googlePopup(service);const params=new URLSearchParams({state,service,token:s.token,uid:s.uid,email:s.email});link.href='aisyuukatsu://google-connect#'+params;link.hidden=false;link.style.display='inline-block';button.hidden=true;status.textContent='接続の準備ができました。アプリに戻って完了してください。';link.focus();setTimeout(()=>{link.removeAttribute('href');link.hidden=true;status.textContent='有効時間が過ぎました。アプリからもう一度開始してください。';},300000);}catch{document.getElementById('error')!.textContent='接続できませんでした。Googleの権限とAPI設定を確認し、もう一度試してください。';button.disabled=false;}};
}
