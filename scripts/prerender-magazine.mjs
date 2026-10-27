import { readFile, readdir, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { pageSize, magazinePagePath } from '../src/magazine/schema.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const catalog = JSON.parse(await readFile(resolve(root, 'src/magazine/catalog.generated.json'), 'utf8'));
const bodies = [];
for (const file of (await readdir(resolve(root, 'public/magazine/articles'))).filter(name => name.endsWith('.json'))) bodies.push(JSON.parse(await readFile(resolve(root, 'public/magazine/articles', file), 'utf8')));
await mkdir(resolve(root, '.cache'), { recursive: true });
const temporary = await mkdtemp(resolve(root, '.cache/magazine-'));
try {
  await build({ configFile: false, root, plugins: [react()], publicDir: false, logLevel: 'warn', build: { ssr: resolve(root, 'src/magazine/prerender.tsx'), outDir: temporary, rollupOptions: { output: { entryFileNames: 'render.mjs' } } } });
  const { renderMagazine, renderLanding } = await import(pathToFileURL(resolve(temporary, 'render.mjs')));
  const base = await readFile(resolve(dist, 'index.html'), 'utf8');
  // The browser workspace has its own stable entry point. Authentication and
  // directory permissions are resolved there, independently of the public site.
  const workspace = base.replace(/<title>[\s\S]*?<\/title>/, '<title>AI就活 ワークスペース</title>')
    .replace('</head>', '<meta name="robots" content="noindex, nofollow">\n</head>');
  await mkdir(resolve(dist, 'app'), { recursive: true });
  await writeFile(resolve(dist, 'app/index.html'), workspace);
  // Render the same public landing component used in the browser so search
  // engines and readers can discover the magazine without executing the app.
  const siteOrigin = JSON.parse(await readFile(resolve(root, 'src/magazine/site.json'), 'utf8')).origin;
  const landingHead = `<link rel="canonical" href="${siteOrigin}/"><meta property="og:url" content="${siteOrigin}/"><meta name="robots" content="index,follow,max-image-preview:large">`;
  await writeFile(resolve(dist, 'index.html'), base.replace('content="/logo.png"', `content="${siteOrigin}/logo.png"`).replace('</head>', landingHead + '<noscript><style>[data-reveal],[data-stagger]{opacity:1!important;transform:none!important}</style></noscript>\n</head>').replace('<div id="root"></div>', `<div id="root">${renderLanding()}</div>`));
  async function writePage(path, article, notFound = false, page = 1) {
    const { html, seo } = renderMagazine(article, catalog, notFound, page);
    let document = base.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(seo.title)}</title>`);
    document = document.replace(/\s*<meta\s+(?:name="(?:description|twitter:card)"|property="og:[^"]+")[^>]*>/g, '');
    const metadata = [
      `<meta name="description" content="${escapeHtml(seo.description)}">`, `<meta name="robots" content="${seo.robots}">`,
      ...Object.entries({ 'og:title': seo.title, 'og:description': seo.description, 'og:url': seo.canonical, 'og:type': seo.type, 'og:image': seo.image, 'og:locale': 'ja_JP' }).map(([key, value]) => `<meta property="${key}" content="${escapeHtml(value)}">`),
      `<meta name="twitter:card" content="${article?.cover ? 'summary_large_image' : 'summary'}">`,
      ...(article ? [`<meta property="article:published_time" content="${escapeHtml(article.datePublished)}">`, `<meta property="article:modified_time" content="${escapeHtml(article.dateModified)}">`] : []),
      ...(notFound ? [] : [`<link rel="canonical" href="${escapeHtml(seo.canonical)}">`, `<script type="application/ld+json" id="magazine-structured-data">${json(seo.structuredData)}</script>`]),
      ...(article ? [`<script type="application/json" id="magazine-article-data">${json(article)}</script>`] : []),
    ].join('\n');
    document = document.replace('</head>', metadata + '\n</head>').replace('<div id="root"></div>', `<div id="root">${html}</div>`);
    const output = resolve(dist, path);
    await mkdir(resolve(output, '..'), { recursive: true });
    await writeFile(output, document);
  }
  await writePage('magazine/index.html', null);
  const listingPaths = [];
  for (let page = 2; page <= Math.ceil(catalog.length / pageSize); page++) {
    const path = magazinePagePath(page);
    listingPaths.push({ path });
    await writePage(path.slice(1) + 'index.html', null, false, page);
  }
  for (const article of bodies) await writePage(`magazine/${article.slug}/index.html`, article);
  await writePage('404.html', null, true);
  const site = JSON.parse(await readFile(resolve(root, 'src/magazine/site.json'), 'utf8'));
  const urls = [{ path: '/' }, { path: '/magazine/' }, ...listingPaths, ...catalog.map(article => ({ path: `/magazine/${article.slug}/`, modified: article.dateModified }))];
  await writeFile(resolve(dist, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(item => `<url><loc>${escapeHtml(site.origin + item.path)}</loc>${item.modified ? `<lastmod>${item.modified}</lastmod>` : ''}</url>`).join('\n') + '\n</urlset>\n');
  await writeFile(resolve(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site.origin}/sitemap.xml\n`);
  console.log(`サイト: アプリ入口・マガジン一覧・${bodies.length}本の記事・404・サイトマップを生成しました`);
} finally { await rm(temporary, { recursive: true, force: true }); }
