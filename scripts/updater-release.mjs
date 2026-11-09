import { createHash,createPublicKey,verify } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { fileURLToPath } from 'node:url';
export const UPDATE_TARGETS=['darwin-aarch64','darwin-x86_64','windows-x86_64','windows-aarch64'];
export function verifyUpdateSignature(bytes,signature,publicKey,version){
 const decode=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(value.trim()))throw Error('Invalid signature encoding');return Buffer.from(value.trim(),'base64');};
 const pubLines=decode(publicKey).toString().trim().split(/\r?\n/),sigLines=decode(signature).toString().trim().split(/\r?\n/);
 if(pubLines.length!==2||sigLines.length!==4||!sigLines[2].startsWith('trusted comment: '))throw Error('Invalid signature format');
 const pub=decode(pubLines[1]),sig=decode(sigLines[1]),commentSignature=decode(sigLines[3]);
 if(pub.length!==42||sig.length!==74||commentSignature.length!==64||!pub.subarray(2,10).equals(sig.subarray(2,10))||!['Ed','ED'].includes(sig.subarray(0,2).toString()))throw Error('Unexpected signing key');
 const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),pub.subarray(10)]),format:'der',type:'spki'});
 const payload=sig.subarray(0,2).toString()==='ED'?createHash('blake2b512').update(bytes).digest():bytes;
 const comment=sigLines[2].slice('trusted comment: '.length);
 if(!verify(null,payload,key,sig.subarray(10))||!verify(null,Buffer.concat([sig.subarray(10),Buffer.from(comment)]),key,commentSignature))throw Error('Signature verification failed');
 const versions=comment.split('\t').filter(field=>field.startsWith('version:'));
 if(versions.length!==1||versions[0]!==`version:${version}`)throw Error('Signed version does not match release');
 return true;
}
export async function prepareUpdateManifest({directory,version,publicKey,notes}){
 if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid release version');
 const names={
  'darwin-aarch64':'AIshukatsu_universal.app.tar.gz','darwin-x86_64':'AIshukatsu_universal.app.tar.gz',
  'windows-x86_64':`AIshukatsu_${version}_x64-setup.exe`,'windows-aarch64':`AIshukatsu_${version}_arm64-setup.exe`,
 };
 const platforms={};
 for(const target of UPDATE_TARGETS){
  const name=names[target];const bytes=await readFile(join(directory,name));const signature=(await readFile(join(directory,name+'.sig'),'utf8')).trim();
  if(bytes.length<100_000||bytes.length>256*1024*1024)throw Error('Unexpected artifact size');
  if(target.startsWith('darwin')?bytes[0]!==0x1f||bytes[1]!==0x8b:bytes.subarray(0,2).toString()!=='MZ')throw Error('Invalid installer format');
  verifyUpdateSignature(bytes,signature,publicKey,version);
  const entry={url:`https://github.com/yamauchiyuhei/AIshukatsu/releases/download/v${version}/${name}`,signature};
  platforms[target]=entry;platforms[target+(target.startsWith('darwin')?'-app':'-nsis')]=entry;
 }
 const manifest={version,notes,pub_date:new Date().toISOString(),platforms};
 await writeFile(join(directory,'latest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [directory,version]=process.argv.slice(2);if(!directory||!version)throw Error('Usage: updater-release.mjs DIRECTORY VERSION');
 const config=JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json',import.meta.url),'utf8'));
 const manifest=await prepareUpdateManifest({directory,version,publicKey:config.plugins.updater.pubkey,notes:'企業研究の記事からMac・Windowsアプリを開き、企業名と記事URLを入れた研究メモを作成できるようになりました。起動済み・新規起動の両方に対応し、ログインや保存先の設定後も記事を引き継ぎます。同名のメモは上書きせず開きます。更新前に作業を保存してください。'});
 console.log(`Verified signed update ${manifest.version}: Mac Apple Silicon / Intel, Windows x64 / ARM64`);
}
