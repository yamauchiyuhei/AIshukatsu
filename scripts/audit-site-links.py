#!/usr/bin/env python3
"""Check every emitted HTML link, asset and fragment against the build output."""
import argparse, json, re
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote
from datetime import datetime, timezone

class Page(HTMLParser):
    def __init__(self, content):
        super().__init__(convert_charrefs=True)
        self.ids=set(); self.links=[]
        self.feed(content)
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if a.get('id'): self.ids.add(a['id'])
        if tag=='a' and a.get('name'): self.ids.add(a['name'])
        if tag in ('a','link') and a.get('href'): self.links.append((tag,a['href']))
        if tag in ('img','script','iframe','source','video','audio') and a.get('src'): self.links.append((tag,a['src']))
        if tag in ('img','source') and a.get('srcset'):
            for v in a['srcset'].split(','):
                if v.strip(): self.links.append((tag,v.strip().split()[0]))

p=argparse.ArgumentParser();p.add_argument('--output',default='.cache/site-links.json'); args=p.parse_args()
root=Path(__file__).resolve().parents[1];dist=root/'dist';origin=json.loads((root/'src/magazine/site.json').read_text())['origin']
pages={x:Page(x.read_text()) for x in dist.rglob('*.html')}
errors=[]; externals=defaultdict(set); internals=set(); occurrences=0
for file,page in pages.items():
    rel=file.relative_to(dist).as_posix(); url=origin+'/'+(rel[:-10] if rel.endswith('index.html') else rel)
    for tag,raw in page.links:
        occurrences+=1; resolved=urljoin(url,raw); u=urlsplit(resolved)
        if u.scheme not in ('http','https'):continue
        if u.netloc!=urlsplit(origin).netloc:
            externals[resolved.split('#')[0]].add(url);continue
        path=unquote(u.path); target=dist/path.lstrip('/')
        if target.is_dir(): target=target/'index.html'
        elif not target.exists() and not target.suffix and (target.with_suffix('.html')).exists():target=target.with_suffix('.html')
        internals.add(path)
        reason=None
        if not target.is_relative_to(dist): reason='path-outside-dist'
        elif not target.is_file():reason='missing-file'
        elif tag=='a' and u.fragment and target in pages and unquote(u.fragment) not in pages[target].ids:reason='missing-fragment'
        if reason:errors.append({'page':url,'url':resolved,'kind':tag,'reason':reason})
# CSS url() assets are also needed before the first paint.
for file in (dist/'assets').glob('*.css'):
    for matches in re.findall(r'''url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)''',file.read_text()):
        raw=next((value for value in matches if value), '').strip()
        if raw.startswith(('data:','http:','https:','#')):continue
        target=dist/raw.lstrip('/') if raw.startswith('/') else file.parent/raw.split('?')[0]
        if not target.is_file():errors.append({'page':str(file.relative_to(dist)),'url':raw,'reason':'missing-css-asset'})
result={'checkedAt':datetime.now(timezone.utc).isoformat(),'htmlPages':len(pages),'linkOccurrences':occurrences,'uniqueInternalPaths':len(internals),'uniqueExternalUrls':len(externals),'errors':errors,'externalUrls':[{'url':u,'pages':sorted(v)} for u,v in sorted(externals.items())]}
out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in result.items() if k!='externalUrls'},ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
