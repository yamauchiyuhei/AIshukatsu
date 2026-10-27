#!/usr/bin/env python3
"""Read-only editorial QA report. Findings require judgment, not automatic deletion."""
import collections,difflib,hashlib,json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parent.parent
D=ROOT/'content/editorial/manuscripts';records=[];paragraphs=collections.defaultdict(list);slugs=collections.defaultdict(list);flags=[];within=[];similar=[];cluster_text=collections.defaultdict(list)
for path in sorted(D.glob('*.json')):
 x=json.loads(path.read_text());a=x['article'];id=x['plan']['id'];slugs[a['slug']].append(id)
 blocks=[b for s in a['sections'] for b in s['blocks']];text=a['lead']+'\n'+'\n'.join(b.get('text','')+'\n'.join(b.get('items',[])) for b in blocks)
 long_blocks=[(i,b['text']) for i,b in enumerate(blocks) if len(b.get('text',''))>120]
 for i,(bi,t) in enumerate(long_blocks):
  for bj,u in long_blocks[i+1:]:
   if min(len(t),len(u))/max(len(t),len(u))>.65:
    ratio=difflib.SequenceMatcher(None,t,u,autojunk=False).ratio()
    if ratio>.8:within.append({'id':id,'blocks':[bi,bj],'similarity':round(ratio,3)})
 normalized=re.sub(r'\s','',text);shingles={normalized[i:i+5] for i in range(len(normalized)-4)}
 for other_id,other_shingles in cluster_text[x['plan']['cluster']]:
  overlap=len(shingles&other_shingles)/max(1,len(shingles|other_shingles))
  if overlap>.35:similar.append({'ids':[other_id,id],'similarity':round(overlap,3)})
 cluster_text[x['plan']['cluster']].append((id,shingles))
 for b in blocks:
  for t in [b.get('text',''),*b.get('items',[])]:
   if len(t)>=100:paragraphs[re.sub(r'\s','',t)].append(id)
 pattern=r'J\d{4}|隣接記事|本稿では|最多|必ず合格|合格率|無料.{0,15}有料|卒業年度3月|専門活用型.{0,20}5日|（約?\d+字）|[0-9]+月[0-9]+日[（(][月火水木金土日][）)]|[0-9]{2,}[%％]|万円|[0-9]+割|適性診断|相性スコア'
 matches=list(re.finditer(pattern,text))
 if matches:flags.append({'id':id,'title':x['plan']['title'],'matches':[text[max(0,m.start()-45):m.end()+65] for m in matches]})
 records.append({'id':id,'title':x['plan']['title'],'cluster':x['plan']['cluster'],'characters':len(text),'slug':a['slug'],'sources':a['sourceIds'],'sha256':hashlib.sha256(text.encode()).hexdigest(),'sections':[s['heading'] for s in a['sections']]})
report={'drafts':len(records),'articles':records,'duplicateSlugs':{k:v for k,v in slugs.items() if len(v)>1},'duplicateParagraphs':[{'ids':list(dict.fromkeys(ids)),'text':text} for text,ids in paragraphs.items() if len(set(ids))>1],'similarParagraphsWithinArticle':within,'similarArticles':similar,'reviewFlags':flags}
out=ROOT/'content/editorial/production-work/editorial-audit.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({k:len(v) if isinstance(v,(list,dict)) else v for k,v in report.items()},ensure_ascii=False))
