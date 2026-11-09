import {fileExists} from './fs';
import {validateFileName} from './fileNames';

/** Copy selected files into the current document folder, preserving existing names. */
export async function importLibraryFiles(directory:FileSystemDirectoryHandle,files:File[]):Promise<{added:number;skipped:number}> {
  for(const file of files){const error=validateFileName(file.name);if(error||file.name.startsWith('.'))throw new Error(`${file.name}: ${error||'隠しファイルは資料として追加できません。'}`);}
  let added=0,skipped=0;
  for(const file of files){
    if(await fileExists(directory,file.name)){skipped++;continue;}
    const target=await directory.getFileHandle(file.name,{create:true});
    const writer=await target.createWritable();
    try{await writer.write(await file.arrayBuffer());await writer.close();added++;}
    catch(error){await writer.abort().catch(()=>{});throw new Error(`${added}件の追加後、「${file.name}」を保存できませんでした。保存先と空き容量を確認してください。`,{cause:error});}
  }
  return {added,skipped};
}
