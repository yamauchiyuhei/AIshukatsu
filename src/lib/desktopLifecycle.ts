import { isTauri } from './tauriFsaShim';
import { flushAllSaves } from './saveQueue';
/** The application menu's Quit action does not always close each window first. */
export async function installDesktopLifecycle(){
 if(!isTauri())return;
 const [{listen},{invoke}]=await Promise.all([import('@tauri-apps/api/event'),import('@tauri-apps/api/core')]);
 let exiting=false;
 await listen('aishukatsu-request-exit',async()=>{
  if(exiting)return;exiting=true;
  try{await new Promise(resolve=>setTimeout(resolve,50));await flushAllSaves();await invoke('finish_app_exit');}
  catch{exiting=false;window.dispatchEvent(new Event('aishukatsu-save-error'));}
 });
 await invoke('enable_exit_guard');
}
