import DOMPurify from 'dompurify';
import { googleSession, clearGoogleConnection, type GoogleService } from './googleAuth';
import { eventRange } from './calendar';
import type { CareerItem } from './planner';
export class GoogleApiError extends Error { constructor(message:string,public status:number){super(message);} }
async function googleRequest(service:GoogleService,path:string,init:RequestInit={}){
  const session=googleSession(service);if(!session)throw new Error('接続の有効時間が過ぎました。Googleへ再接続してください。');
  const initial=session;const response=await fetch('https://www.googleapis.com/'+path,{...init,headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json',...init.headers},signal:init.signal??AbortSignal.timeout(20000)});
  if(googleSession(service)!==initial)throw new Error('Google接続が変更されました。もう一度操作してください。');
  if(!response.ok){if(response.status===401)clearGoogleConnection(service);throw new GoogleApiError(response.status===401?'接続の有効時間が過ぎました。再接続してください。':response.status===403?'Google側で利用が許可されていません。必要な権限・APIの有効化・公開前のテストユーザー設定を確認してください。':response.status===412?'Google側で予定が変更されています。予定を確認してからもう一度登録してください。':response.status===429?'Googleへの操作が混み合っています。少し待って再試行してください。':'Googleとの通信を完了できませんでした。再試行してください。',response.status);}
  if(response.status===204)return null;return response.json();
}
const calendarPath=(id:string)=>`calendar/v3/calendars/${encodeURIComponent(id)}`;
const calendarKey=(uid:string)=>`aishukatsu-calendar-v1:${uid}`;
let calendarCreation:Promise<string>|null=null;
export async function ensureCareerCalendar():Promise<string>{
  const session=googleSession('calendar');if(!session)throw new Error('Googleカレンダーに接続してください。');
  let id:string|null=null;try{id=localStorage.getItem(calendarKey(session.uid));}catch{}
  if(id){try{await googleRequest('calendar',calendarPath(id));return id;}catch(e){if(!(e instanceof GoogleApiError)||e.status!==404)throw e;}}
  if(calendarCreation)return calendarCreation;
  calendarCreation=(async()=>{const result=await googleRequest('calendar','calendar/v3/calendars',{method:'POST',body:JSON.stringify({summary:'AI就活',description:'AI就活で確認して登録した予定',timeZone:'Asia/Tokyo'})});if(!result?.id)throw new Error('予定表を作成できませんでした。');try{localStorage.setItem(calendarKey(session.uid),result.id);}catch{}return result.id;})();
  try{return await calendarCreation;}finally{calendarCreation=null;}
}
export async function calendarEventId(item:CareerItem){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('aishukatsu:'+item.id));return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function saveGoogleEvent(item:CareerItem,reminder=30){
  if(item.kind==='es')throw new Error('ES本文はカレンダーへ登録しません。');
  const range=eventRange(item);const calendarId=await ensureCareerCalendar();const id=await calendarEventId(item);const path=calendarPath(calendarId)+'/events';
  const body={summary:item.company+'｜'+item.title,...range,location:item.location,description:[item.notes,item.url].filter(Boolean).join('\n'),reminders:{useDefault:false,overrides:[{method:'popup',minutes:reminder}]},extendedProperties:{private:{app:'aishukatsu',sourceId:item.id}}};
  let existing=null;try{existing=await googleRequest('calendar',path+'/'+id);}catch(e){if(!(e instanceof GoogleApiError)||e.status!==404)throw e;}
  if(existing){if(existing.extendedProperties?.private?.app!=='aishukatsu'||existing.extendedProperties?.private?.sourceId!==item.id)throw new Error('別の予定との対応を確認できませんでした。Googleカレンダーで確認してください。');const saved=await googleRequest('calendar',path+'/'+id,{method:'PATCH',headers:{'If-Match':existing.etag},body:JSON.stringify(body)});return {url:saved.htmlLink,updated:true};}
  try{const saved=await googleRequest('calendar',path,{method:'POST',body:JSON.stringify({id,...body})});return {url:saved.htmlLink,updated:false};}catch(e){if(e instanceof GoogleApiError&&e.status===409)throw new Error('同じ予定はすでにGoogleにあります。もう一度操作して内容を確認してください。');throw e;}
}
export interface BusyPeriod{start:string;end:string;}
export async function primaryBusy(start:string,end:string):Promise<BusyPeriod[]>{const result=await googleRequest('calendar','calendar/v3/freeBusy',{method:'POST',body:JSON.stringify({timeMin:start,timeMax:end,timeZone:'Asia/Tokyo',items:[{id:'primary'}]})});const primary=result.calendars?.primary;if(primary?.errors?.length)throw new Error('メインカレンダーの空き時間を取得できませんでした。');return primary?.busy??[];}
export function hasConflict(item:CareerItem,busy:BusyPeriod[]){if(!item.time||!item.date)return false;const range=eventRange(item);const start=new Date(range.start.dateTime!).getTime(),end=new Date(range.end.dateTime!).getTime();return busy.some(b=>new Date(b.start).getTime()<end&&new Date(b.end).getTime()>start);}
export interface MailHeader{id:string;subject:string;from:string;date:string;}
export async function searchGmail(query:string,signal?:AbortSignal):Promise<MailHeader[]>{
  const data=await googleRequest('gmail','gmail/v1/users/me/messages?'+new URLSearchParams({q:query,maxResults:'10'}),{signal});
  const messages:MailHeader[]=[];
  for(const {id} of data.messages??[]){const message=await googleRequest('gmail',`gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,{signal});const h=(name:string)=>message.payload?.headers?.find((x:{name:string})=>x.name.toLowerCase()===name.toLowerCase())?.value??'';messages.push({id,subject:h('Subject')||'（件名なし）',from:h('From'),date:h('Date')});}return messages;
}
function base64Text(value:string){const bytes=Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));return new TextDecoder().decode(bytes);}
interface MailPart{mimeType?:string;body?:{data?:string};parts?:MailPart[];}
export function mailBody(part:MailPart):string{
  const leaves=(p:MailPart):MailPart[]=>p.parts?.length?p.parts.flatMap(leaves):[p];const all=leaves(part);const plain=all.filter(p=>p.mimeType==='text/plain'&&p.body?.data).map(p=>base64Text(p.body!.data!)).join('\n');if(plain)return plain;
  const html=all.filter(p=>p.mimeType==='text/html'&&p.body?.data).map(p=>base64Text(p.body!.data!)).join('\n');if(!html)return '';
  const safe=DOMPurify.sanitize(html.replace(/<\/(?:p|div|tr|li)>|<br\s*\/?>/gi,'\n'),{ALLOWED_TAGS:[],ALLOWED_ATTR:[]});const el=document.createElement('textarea');el.innerHTML=safe;return el.value;
}
export async function readGmail(id:string,signal?:AbortSignal){const data=await googleRequest('gmail',`gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,{signal});const h=(name:string)=>data.payload?.headers?.find((x:{name:string})=>x.name.toLowerCase()===name.toLowerCase())?.value??'';const body=mailBody(data.payload??{});if(!body.trim())throw new Error('本文を読み取れませんでした。Gmailで開き、本文を貼り付けてください。');return {text:`件名：${h('Subject')}\n差出人：${h('From')}\n${body}`,source:`Gmail:${id}`};}
