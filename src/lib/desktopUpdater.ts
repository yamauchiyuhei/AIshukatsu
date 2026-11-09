import {AppUpdaterController} from './appUpdater';
import {nativeUpdater} from './nativeUpdater';
import {flushAllSaves} from './saveQueue';
import {getUpdateWork} from './updateWork';
import packageInfo from '../../package.json';
export async function prepareForAppUpdate(){
  if(getUpdateWork().length)throw new Error('unsaved_dialog_work');
  await flushAllSaves();
  if(getUpdateWork().length)throw new Error('unsaved_dialog_work');
}
export const desktopUpdater=new AppUpdaterController(nativeUpdater,prepareForAppUpdate,packageInfo.version);
