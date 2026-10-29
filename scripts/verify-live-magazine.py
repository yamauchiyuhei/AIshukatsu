#!/usr/bin/env python3
"""Compare a frozen Hosting release with the bytes served publicly."""
import concurrent.futures,datetime,hashlib,json,pathlib,sys,time,urllib.request,urllib.error
release=pathlib.Path(sys.argv[1]);origin='https://aisyuukatsu-30fdd.web.app'
manifest=json.loads((release/'manifest.json').read_text());paths=[p for p in manifest if p.endswith('.html') or p in ['sitemap.xml','robots.txt'] or p.startswith(('assets/','magazine/covers/','magazine/articles/'))]
def check(path):
 urlpath='/'+path
 if path.endswith('/index.html'):urlpath='/'+path[:-10]
 elif path=='index.html':urlpath='/'
 for attempt in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(origin+urlpath,headers={'User-Agent':'AIShukatsu-Publication-Verification/1.0'}),timeout=30) as response:
    body=response.read();return {'path':urlpath,'status':response.status,'matches':hashlib.sha256(body).hexdigest()==manifest[path]}
  except urllib.error.HTTPError as e:
   if path=='404.html':return {'path':urlpath,'status':e.code,'matches':hashlib.sha256(e.read()).hexdigest()==manifest[path]}
   error=str(e)
  except Exception as e:error=str(e)
 return {'path':urlpath,'error':error,'matches':False}
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:rows=list(pool.map(check,paths))
report={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'origin':origin,'paths':len(rows),'matched':sum(r['matches'] for r in rows),'failures':[r for r in rows if not r['matches']],'results':rows};(release/'live-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='results'},ensure_ascii=False));sys.exit(bool(report['failures']))
