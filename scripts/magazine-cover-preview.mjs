// Compact local previews for reviewing large sets; public photographs are unchanged.
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
let sharp;try{sharp=require('sharp');}catch{sharp=require(process.env.MAGAZINE_SHARP_PATH||resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));}
const file=process.argv[2];
if(!file?.startsWith('/'))throw new Error('Provide an absolute image path.');
const bytes=await sharp(file).rotate().resize({width:640,withoutEnlargement:true}).jpeg({quality:76}).toBuffer();
process.stdout.write('data:image/jpeg;base64,'+bytes.toString('base64'));
