#!/usr/bin/env python3
"""Additional source/logic review for regulated and test-preparation topics."""
import argparse,concurrent.futures,datetime,hashlib,importlib.util,json,pathlib
spec=importlib.util.spec_from_file_location('author',pathlib.Path(__file__).with_name('author-magazine.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
parser=argparse.ArgumentParser();parser.add_argument('--workers',type=int,default=8);parser.add_argument('--ids');args=parser.parse_args()
S=json.loads((m.ROOT/'content/editorial/source-packets.json').read_text())
def digest(a):return hashlib.sha256(json.dumps(a,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
def run(path):
 if m.STOP.is_set():return
 x=json.loads(path.read_text());a=x['article'];id=x['plan']['id'];before=digest(a)
 if x.get('qualityReview',{}).get('sha256')==before:return
 # Include official material for these related topics; do not invent additional sources.
 keys=set(m.source_packet(x['plan']))|set(a['sourceIds'])
 n=int(id[1:]);title=x['plan']['title']
 if 601<=n<=700:keys|={'spi','cab','tamate','gab','tg','tgtypes','ef','scoa'}
 if 851<=n<=950:keys|={'offer','conditions','conditions2024','fair','hello'}
 if any(k in title for k in ['給与','手取り','奨学金','保険']):keys|={'residencetax','withholding','careinsurance','nationalhealth','jasso'}
 if any(k in title for k in ['健康','疲れ','療養','病気','緊張']):keys|={'wellbeing','breathing','fair'}
 packet={k:S[k] for k in keys if k in S}
 prompt='''公開用記事の独立した最終事実・論理校正です。下書きも前の校正も信頼せず、誤りを探してください。単なる文体好みの修正は不要です。
優先する問題：公的資料にない法的/医療的断定、申請時期や加入・脱退の混同、非課税条件や控除月の誤り、形式を一律に決めつける説明、資料にない試験仕様・適応型・誤答ペナルティ・問題スキップ機能、確かな根拠がない割合/ボーダー/採用基準、選択肢に複数正解がある練習、途中式や問題条件の矛盾、修正前の誤った文と修正後が両方残っている文章、未公開記事のJ番号。
数式は独立に計算して正解・途中式を確認。練習問題の仮定や架空設定は残してよいが、実統計と誤解する文は明確化。全ての選択肢について、他の正解が成立しないか具体的に検討。出典不足の細かな仕様は自作練習の提案として書くか削除し、資料確認手順に置換。ただしタイトルの約束が満たせなくなる場合はapproved:falseと理由をnotesに。
公開時はsourceIdsから出典欄を付す。資料の編集提案を公的機関の指示に誤帰属しない。特定の期限や許可、保証のない能力・採用結果を断定しない。
以下だけをJSONで返す。{"approved":true,"replacements":[{"before":"現原稿内の文字列フィールド全体と完全一致","after":"差替える全文","reason":"誤りの理由"}],"sourceIds":["実際に使った資料ID"],"notes":[]}
beforeはlead/description/headingまたはblocksのtextまたはlistの各itemsの文字列全体。部分一致は禁止。元の文字列が原稿に一度だけ存在すること。削除したい場合も最小限の正しい説明に差替。修正不要ならreplacements:[]。sourceIdsは既存と追加分から実際に本文で使う資料のみ。完成本文全体は返さない。
'''
 try:
  patch,meta=m.call(prompt+'\nタイトル：'+title+'\n確認資料：'+json.dumps(packet,ensure_ascii=False)+'\n原稿：'+json.dumps(a,ensure_ascii=False),m.WORK/(id+'-quality-'+before[:12]),'medium')
  if patch.get('approved') is not True:raise ValueError('hold: '+str(patch.get('notes')))
  final=json.loads(json.dumps(a));pending=[]
  for change in patch.get('replacements',[]):
   old,new=change['before'],change['after'];matches=[]
   def walk(o):
    if isinstance(o,dict):
     for k,v in o.items():
      if isinstance(v,str) and old in v:matches.extend([(o,k)]*v.count(old))
      elif isinstance(v,(dict,list)):walk(v)
    elif isinstance(o,list):
     for k,v in enumerate(o):
      if isinstance(v,str) and old in v:matches.extend([(o,k)]*v.count(old))
      elif isinstance(v,(dict,list)):walk(v)
   walk(final)
   if len(matches)!=1 or not new.strip():raise ValueError('ambiguous replacement')
   obj,key=matches[0];pending.append((obj,key,old,new))
  for obj,key,old,new in pending:
   if old not in obj[key]:raise ValueError('overlapping replacement')
   obj[key]=obj[key].replace(old,new,1)
  final['sourceIds']=patch.get('sourceIds',final['sourceIds']);errs=m.validate(final,x['plan'],packet)
  if errs:raise ValueError(errs)
  if digest(json.loads(path.read_text())['article'])!=before:raise ValueError('concurrent manuscript change')
  x['article']=final;x['bodyCharacters']=len(m.textof(final));x['qualityReview']={'sha256':digest(final),'beforeSha256':before,'model':meta,'corrections':patch.get('replacements',[]),'notes':patch.get('notes',[]),'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()};tmp=path.with_suffix('.quality.tmp');tmp.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n');tmp.replace(path);(m.WORK/(id+'-quality-error.json')).unlink(missing_ok=True);print(id,'quality-reviewed',len(patch.get('replacements',[])),flush=True)
 except Exception as e:(m.WORK/(id+'-quality-error.json')).write_text(json.dumps({'id':id,'error':str(e)},ensure_ascii=False));print(id,'QUALITY HOLD',str(e),flush=True)
ids=set(args.ids.split(',')) if args.ids else None
paths=[p for p in sorted(m.DRAFT.glob('*.json')) if p.stem in ids] if ids else [p for p in sorted(m.DRAFT.glob('*.json')) if 601<=int(p.stem[1:])<=700 or 851<=int(p.stem[1:])<=950]
with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:list(pool.map(run,paths))
