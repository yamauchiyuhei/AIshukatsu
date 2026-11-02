import { Channel, invoke } from '@tauri-apps/api/core';
import type { UpdateApi, UpdateInfo, UpdateProgress } from './appUpdater';
export const nativeUpdater:UpdateApi={
  check:()=>invoke<UpdateInfo>('app_update_check'),
  async download(onProgress){const progress=new Channel<UpdateProgress>();progress.onmessage=onProgress;await invoke('app_update_download',{progress});},
  install:()=>invoke('app_update_install',{confirmed:true}),
};
