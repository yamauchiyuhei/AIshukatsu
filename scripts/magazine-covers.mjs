// Register images produced with the built-in image generator. No network/API calls.
import { access, readFile, writeFile, readdir, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSlug, todayInTokyo, validateArticle } from '../src/magazine/schema.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = resolve(root, 'content/editorial/covers/manifest.json');
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const save = async (path, value) => { await writeFile(path + '.tmp', JSON.stringify(value, null, 2) + '\n'); await rename(path + '.tmp', path); };
async function saveProgress(report, release) {
  const path=resolve(root,'content/editorial/latest-publication.json'),summary=await read(path);
  const prepared=manifest.articles.filter(a=>a.cover).length,published=manifest.articles.filter(a=>a.status==='published').length;
  const awaitingReview=(await readyImages()).length;
  summary.covers={...(summary.covers||{}),target:manifest.target,prepared,published,awaitingReview,remainingToGenerate:manifest.target-prepared-awaitingReview,remainingToPrepare:manifest.target-prepared,remainingToPublish:manifest.target-published,generationMode:manifest.generationMode,status:published===manifest.target?'complete':'in_progress',updatedAt:new Date().toISOString()};
  if(report){Object.assign(summary,{release,verifiedAt:report.verifiedAt,verifiedPaths:report.paths,matchingPaths:report.matched});Object.assign(summary.covers,{release,verifiedAt:report.verifiedAt});}
  await save(path,summary);
}
async function readyImages() {
  const directory=resolve(root,'content/editorial/covers/generated');
  let files;try{files=await readdir(directory);}catch(error){if(error.code==='ENOENT')return [];throw error;}
  const candidates=[];
  for(const file of files.filter(f=>f.endsWith('.json'))){
    const result=await read(resolve(directory,file)),entry=manifest.articles.find(a=>a.slug===result.slug);
    if(entry?.status==='pending' && entry.prompt===result.prompt && result.path && !entry.rejectedGenerations?.some(r=>r.sourceFile===result.path)) {
      try{await access(result.path);candidates.push({...result,title:entry.title});}catch(error){if(error.code!=='ENOENT')throw error;}
    }
  }
  return [...new Map(candidates.map(r=>[r.slug,r])).values()];
}
const articles = await Promise.all((await readdir(resolve(root, 'content/magazine'))).filter(f => f.endsWith('.json')).map(f => read(resolve(root, 'content/magazine', f))));
const published = articles.filter(a => a.status === 'published');
let manifest;
try { manifest = await read(manifestPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const mode = process.argv[2];
if (mode === 'init') {
  const old = new Map(manifest?.articles.map(a => [a.slug, a]) || []);
  const original = published.filter(a => !a.editorialId).sort((a,b) => Number(!!b.featured)-Number(!!a.featured) || a.slug.localeCompare(b.slug));
  const latest = [...published].sort((a,b) => b.datePublished.localeCompare(a.datePublished) || a.slug.localeCompare(b.slug));
  const categoryFirst = [...new Set(published.map(a => a.category))].flatMap(c => latest.filter(a => a.category === c).slice(0,8));
  const order = [...new Map([...original, ...latest.slice(0,10), ...categoryFirst, ...latest].map(a => [a.slug, a])).values()];
  manifest = { version: 1, generationMode: 'built-in imagegen; one photograph per article; no external API', target: published.length, articles: order.map((a,i) => old.get(a.slug) || {
    slug:a.slug, title:a.title, category:a.category, status:'pending',
    alt: `${a.title.replace(/[「」『』]/g, '')}のテーマを表す就活準備のイメージ`,
    prompt: `Use case: photorealistic-natural. Create ONE distinct landscape 16:9 editorial cover photograph for this exact Japanese career-advice article: 「${a.title}」. Article summary: ${a.description}\nChoose a concrete everyday scene that clearly relates to this specific subject, using suitable people, objects and an authentic setting in Japan. Interpret the article's subject visually without any text. The people, if useful, are ordinary Japanese university students in their early twenties or a career adviser. Composition variation for this article: ${['a candid medium-wide view with natural human interaction','a thoughtfully composed close-up of relevant hands and ordinary preparation tools','an environmental portrait with a meaningful workplace or campus background','a slightly elevated side view of the subject in a real everyday setting'][i%4]}. Soft ${['morning window daylight','bright overcast daylight','warm late afternoon daylight','neutral diffused daylight'][Math.floor(i/4)%4]}, natural skin, realistic fingers and materials, restrained colors, professional magazine photography. Avoid staged stock-photo gestures, exaggerated smiles and visual cliches. No text overlay, readable writing, numbers, logos, brand marks, watermarks, illustrations, grids or collages. Screens and paper have only indistinct generic shapes. This is a newly generated illustrative scene, not documentary evidence of an actual employer, exam venue, person or event.`,
  }) };
  await mkdir(resolve(root, 'content/editorial/covers'), {recursive:true}); await save(manifestPath, manifest);
  console.log(JSON.stringify({target:manifest.target,prepared:manifest.articles.filter(a=>a.status!=='pending').length}));
} else if (mode === 'register') {
  const [slug, sourceFile] = process.argv.slice(3);
  if (!isSlug(slug) || !sourceFile?.startsWith('/')) throw new Error('Provide a valid slug and absolute generated image path.');
  const entry = manifest?.articles.find(a => a.slug === slug), article = published.find(a => a.slug === slug);
  if (!entry || !article) throw new Error('Unknown article; initialize the plan first.');
  if (entry.title !== article.title || entry.category !== article.category) throw new Error('The cover plan no longer matches the current article.');
  const source = await readFile(sourceFile), sourceSha = sha(source);
  if (manifest.articles.some(a => a.slug !== slug && a.sourceSha256 === sourceSha)) throw new Error('Each article requires a distinct generated image.');
  if (entry.sourceSha256 === sourceSha) { console.log('Already registered: ' + slug); process.exit(0); }
  const require = createRequire(import.meta.url);
  let sharp;
  try { sharp = require('sharp'); } catch { sharp = require(process.env.MAGAZINE_SHARP_PATH || resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')); }
  const meta = await sharp(source).metadata();
  if (meta.width < 900 || meta.height < 500) throw new Error('Cover source resolution is too low.');
  const version = sourceSha.slice(0,10), stem = slug + '-' + version;
  const dir = resolve(root, 'public/magazine/covers'); await mkdir(dir, {recursive:true});
  // Resize and encode only: preserve the generated photograph's full composition.
  const hero = await sharp(source).rotate().resize({width:1280,withoutEnlargement:true}).webp({quality:84}).toBuffer({resolveWithObject:true});
  const card = await sharp(source).rotate().resize({width:560,withoutEnlargement:true}).webp({quality:80}).toBuffer();
  await writeFile(resolve(dir, stem+'.webp'), hero.data); await writeFile(resolve(dir,stem+'-card.webp'),card);
  article.cover = {src:'/magazine/covers/'+stem+'.webp',thumbnail:'/magazine/covers/'+stem+'-card.webp',alt:entry.alt,width:hero.info.width,height:hero.info.height,source:'ai-generated'};
  article.dateModified = todayInTokyo();
  const errors = validateArticle(article); if(errors.length) throw new Error(errors.join('; '));
  await save(resolve(root,'content/magazine',slug+'.json'),article);
  const logPath=resolve(root,'content/editorial/publication-log.json'),log=await read(logPath),record=log.articles.find(a=>a.slug===slug);
  if(record) { record.sha256=sha(JSON.stringify(article)); record.dateModified=article.dateModified; await save(logPath,log); }
  Object.assign(entry,{status:'prepared',generatedAt:new Date().toISOString(),qualityReviewedAt:new Date().toISOString(),sourceFile,sourceSha256:sourceSha,cover:article.cover,heroSha256:sha(hero.data),thumbnailSha256:sha(card),heroBytes:hero.data.length,thumbnailBytes:card.length});
  await save(manifestPath,manifest);
  await saveProgress();
  console.log(JSON.stringify({slug,prepared:manifest.articles.filter(a=>a.status!=='pending').length,total:manifest.target,bytes:hero.data.length+card.length,cover:article.cover}));
} else if (mode === 'pending') {
  const generated=new Set((await readyImages()).map(a=>a.slug));
  console.log(JSON.stringify(manifest.articles.filter(a=>a.status==='pending'&&!generated.has(a.slug)).slice(0,Number(process.argv[3])||8)));
} else if (mode === 'ready') {
  console.log(JSON.stringify((await readyImages()).slice(0,Number(process.argv[3])||1006)));
} else if (mode === 'published') {
  const release=resolve(process.argv[3]),report=await read(resolve(release,'live-verification.json'));
  if(report.failures?.length || report.matched!==report.paths) throw new Error('Release verification has not succeeded.');
  const hashes=await read(resolve(release,'manifest.json'));
  for(const entry of manifest.articles.filter(a=>a.cover)) {
    if(hashes[entry.cover.src.slice(1)]===entry.heroSha256 && hashes[entry.cover.thumbnail.slice(1)]===entry.thumbnailSha256) Object.assign(entry,{status:'published',publishedAt:report.verifiedAt,release});
  }
  await save(manifestPath,manifest);
  await saveProgress(report,release);
  console.log(JSON.stringify({target:manifest.target,prepared:manifest.articles.filter(a=>a.status!=='pending').length,published:manifest.articles.filter(a=>a.status==='published').length}));
} else throw new Error('Use init, pending [count], ready [count], register <slug> <source.png>, or published <verified-release>.');
