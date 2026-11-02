export interface UpdateInfo { currentVersion:string; version:string|null; notes:string|null }
export interface UpdateProgress { downloaded:number; total:number|null; verifying:boolean }
export interface UpdateApi {
  check():Promise<UpdateInfo>;
  download(onProgress:(progress:UpdateProgress)=>void):Promise<void>;
  install():Promise<void>;
}
export type UpdatePhase='idle'|'checking'|'current'|'available'|'downloading'|'ready'|'saving'|'installing';
export interface UpdateSnapshot { phase:UpdatePhase; info:UpdateInfo; progress:UpdateProgress|null; error:string|null; checkedAt:number|null }
export function updatePercent(progress:UpdateProgress|null){return progress?.total&&progress.total>0?Math.min(100,Math.max(0,Math.floor(progress.downloaded/progress.total*100))):null;}
export class AppUpdaterController {
  private listeners=new Set<()=>void>();
  private working=false;
  private snapshot:UpdateSnapshot;
  constructor(private api:UpdateApi,private beforeInstall:()=>Promise<void>,currentVersion:string){this.snapshot={phase:'idle',info:{currentVersion,version:null,notes:null},progress:null,error:null,checkedAt:null};}
  getSnapshot=()=>this.snapshot;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(patch:Partial<UpdateSnapshot>){this.snapshot={...this.snapshot,...patch};this.listeners.forEach(listener=>listener());}
  async check(){
    if(this.working||this.snapshot.phase==='ready')return;
    this.working=true;this.publish({phase:'checking',error:null});
    try{const info=await this.api.check();this.publish({info,phase:info.version?'available':'current',progress:null,checkedAt:Date.now()});}
    catch{this.publish({phase:this.snapshot.info.version?'available':'idle',error:'更新を確認できませんでした。接続を確認して、もう一度お試しください。',checkedAt:Date.now()});}
    finally{this.working=false;}
  }
  async download(){
    if(this.working||!['available','ready'].includes(this.snapshot.phase))return;
    this.working=true;this.publish({phase:'downloading',progress:null,error:null});
    try{await this.api.download(progress=>this.publish({progress}));this.publish({phase:'ready'});}
    catch(cause){const signature=/signature|signed.version/i.test(String(cause));this.publish({phase:'available',progress:null,error:signature?'更新ファイルの署名を確認できませんでした。インストールは行っていません。再度ダウンロードしてください。':'ダウンロードできませんでした。接続と空き容量を確認して、もう一度お試しください。'});}
    finally{this.working=false;}
  }
  async install(){
    if(this.working||this.snapshot.phase!=='ready')return;
    this.working=true;this.publish({phase:'saving',error:null});
    try{await this.beforeInstall();}
    catch{this.publish({phase:'ready',error:'保存できない変更があります。画面を閉じて保存・下書きの退避を完了してから、更新を再試行してください。'});this.working=false;return;}
    this.publish({phase:'installing'});
    try{await this.api.install();}
    catch{this.publish({phase:'ready',error:'更新を適用できませんでした。アプリを通常の保存先へ置き、空き容量を確認して再試行してください。必要に応じて再ダウンロードできます。'});}
    finally{this.working=false;}
  }
}
