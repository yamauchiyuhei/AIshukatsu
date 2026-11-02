export interface PendingAuth {state:string;createdAt:number;}
export function validateAuthCallback(raw:string,pending:PendingAuth|null,now=Date.now()){
 if(!pending||typeof pending.state!=='string'||!pending.state||!Number.isFinite(pending.createdAt)||now-pending.createdAt>300000||now<pending.createdAt)return null;
 try{const url=new URL(raw);if(url.protocol!=='aisyuukatsu:'||url.hostname!=='auth-callback'||url.username||url.password||url.searchParams.get('state')!==pending.state)return null;const idToken=url.searchParams.get('idToken');return idToken?{idToken,accessToken:url.searchParams.get('accessToken')}:null;}catch{return null;}
}
