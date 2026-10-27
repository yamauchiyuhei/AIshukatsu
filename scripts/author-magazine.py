#!/usr/bin/env python3
"""Resumable Claude-only drafting. Never publishes; accepted drafts require release review."""
import argparse, concurrent.futures, datetime, hashlib, json, os, pathlib, re, subprocess, threading, time
ROOT=pathlib.Path(__file__).resolve().parent.parent
WORK=ROOT/'content/editorial/production-work'
DRAFT=ROOT/'content/editorial/manuscripts'
PLAN=json.loads((ROOT/'docs/editorial/2026-10-26-title-plan/titles-1000.json').read_text())['articles']
SOURCES=json.loads((ROOT/'content/editorial/source-packets.json').read_text())
STOP=threading.Event()
LOCK=threading.Lock()
RULES='''あなたはAI就活マガジンの日本語編集者。出力はJSONのみ。です・ます調、温かく具体的、押し付けない文章。
指定のタイトル・検索意図を十分に解決する独自の本文を作る。Yamatomoの構成に倣い、結論の導入、固有の見出し、実用的な主部、つまずきの修正、次の行動。4〜7節、本文1800〜2400字程度を目安にテーマに必要な分量。見出しや説明の水増しはしない。隣接企画に主題を広げない。
【必須】タイトルに含まれる疑問・比較対象・数字・約束を全部本文で満たす。例文/質問例/記入例/独自練習問題など、読者が使える完成形とその解説を最低1つ含める。例は『架空の例』『文例』『独自の練習問題』と明示。問題は解答と計算過程も書き、全て検算。文字数指定例文は厳密にカウントできない場合『構成の例（指定字数に調整して使用）』と明示する。数字の改変や体験の捏造を勧めない。
【事実の制約】提供された確認済み資料以外から、統計、企業名、サービス固有の機能や料金、試験時間・問題数・ボーダー、法的結論、最新日程を追加しない。一般的で安定した概念や数学は説明してよい。独自の進め方は『提案』『一例』『目安』と分かる表現にする。『多くの学生』『一般企業は必ず』『最も多い』『よく聞く』等の未確認の頻度や取材を示す表現は禁止。根拠なく採用担当の意図を決めつけない。
【避ける誤り】TG-WEBが適応型で難易度を解答ごとに変えるという根拠は資料にないため書かない。資料にない提供元の検査構成・サービス仕様は記憶で補わない。相談手順の編集提案を「厚生労働省が示す」と誤帰属しない。3月を4年生と書かない。準備開始を3年6月と一律推奨しない（夏の募集はそれ以前もあるためまず公式募集確認）。1dayを制度上のインターンとしない。専門活用型は5日でなく2週間以上、他の要件もある。My CareerBox等を性格診断としない。無料・有料ツールを勝手に紹介しない。性格検査の嘘・代理受検・不正支援はしない。政府要請と個別採用日程を区別。
【追加確認】在留資格の変更申請は卒業後まで待つものではない。卒業見込みで受け付けられる申請がある。引越しと国保脱退は別で会社加入だけで全手続完了としない。同一自治体の転居と自治体間の転出入を区別。資料がない法律の義務や診断・治療効果は追加しない。
【出典】sourceIdsは本文の該当説明に使った提供IDだけ。一般的な文章作成法や独自の例文は無理に資料と関連づけず空配列でよい。制度・法律・健康・試験形式を扱う記事は対応資料が必要。出典の文章を長く転載しない。医療診断や個別の法的判断をせず、本人が持つ書類と適切な相談先を示す。
【AI記事】特定サービスの現行UI/料金/設定/保存仕様は資料がなければ断定しない。プロンプト例と確認・修正の手順に焦点を当て、個人情報や未公開情報を除く。実際に試した体験を偽らない。
生HTML/Markdown強調/Markdown表/URLを本文に入れない。sourcesはシステムがsourceIdsから追加。quoteは文例にも使えるが資料の引用と誤解しない表示にする。
出力は {"id":"指定ID","slug":"内容に即した英語ハイフンslug（85字以内）","description":"日本語80〜140字","lead":"結論から始める120〜200字","tags":["3〜5語"],"sections":[{"id":"english-slug","heading":"具体的な見出し","blocks":[{"type":"paragraph"または"note"または"quote","text":"本文"}または{"type":"list","items":["各項目"]}]}],"sourceIds":["資料ID"]}。
'''
def source_packet(a):
 n=int(a['id'][1:]);t=a['title'];ids=[]
 if n<=50:ids+=['schedule2028']
 if 51<=n<=100:ids+=['jobcard']
 if 101<=n<=250:ids+=['jobtag','conditions']
 if 501<=n<=550:ids+=['fair']
 if 601<=n<=650:ids+=['spi']
 if 651<=n<=700:ids+=['spi','tamate','cab','gab','tg','tgtypes','ef','scoa']
 if 701<=n<=750:ids+=['intern','schedule2028']
 if 751<=n<=800:ids+=['harassment']
 if 851<=n<=900:ids+=['offer','conditions','conditions2024']
 if 901<=n<=950:ids+=['hello']
 if any(w in t for w in ['呼吸','緊張','声','疲れ']):ids+=['wellbeing','breathing']
 for words, keys in [('合理的配慮 障害', ['accommodation']),('留学生 外国籍',['visa','visatiming']),('奨学金',['jasso']),('引越 住所',['moving','movinglist','nationalhealth']),('セクハラ ハラスメント オワハラ',['harassment']),('健康診断 病気 療養 疲れ',['fair','wellbeing']),('労働条件 雇用契約 給与 試用 就業規則',['conditions','conditions2024','residencetax','withholding','careinsurance'])]:
  if any(w in t for w in words.split()):ids+=keys
 return {k:SOURCES[k] for k in dict.fromkeys(ids)}
def decode(s):
 s=s.strip()
 if s.startswith('```'):s=re.sub(r'^```(?:json)?\s*|\s*```$','',s).strip()
 # Remove only syntactic trailing commas outside JSON string values.
 # Preserve the original response file for provenance.
 chars=[];quoted=False;escaped=False
 for i,c in enumerate(s):
  if quoted:
   chars.append(c)
   if escaped:escaped=False
   elif c=='\\':escaped=True
   elif c=='"':quoted=False
  else:
   if c=='"':quoted=True
   if c==',' and s[i+1:].lstrip().startswith(('}',']')):continue
   chars.append(c)
 s=''.join(chars)
 if s.startswith('{'):
  value,end=json.JSONDecoder().raw_decode(s)
  tail=s[end:].strip()
  if tail and not tail.startswith(('```','**修正','修正','---')):raise ValueError('Unexpected trailing data')
  return value
 return json.loads(s)

def textof(a):return a.get('lead','')+'\n'+'\n'.join(b.get('text','')+'\n'.join(b.get('items',[])) for sec in a.get('sections',[]) for b in sec.get('blocks',[]))
def validate(a,p,packet):
 e=[]
 if a.get('id')!=p['id']:e.append('id mismatch')
 if not re.fullmatch('[a-z0-9]+(?:-[a-z0-9]+)*',a.get('slug','')) or len(a['slug'])>85:e.append('slug')
 if not 4<=len(a.get('sections',[]))<=9:e.append('sections count')
 if len(textof(a))<1500:e.append('本文不足（1500文字以上、具体例と解説を加える）')
 if len(set(s.get('id') for s in a.get('sections',[])))!=len(a.get('sections',[])):e.append('duplicate section id')
 if not isinstance(a.get('sourceIds'),list) or any(k not in packet for k in a.get('sourceIds',[])):e.append('unknown sources')
 if not 3<=len(a.get('tags',[]))<=6 or len(set(a['tags']))!=len(a['tags']):e.append('tags')
 if re.search(r'J\d{4}|隣接記事',textof(a)):e.append('内部編集番号・未公開記事への参照を削除')
 if '<script' in textof(a) or ('Markdown' not in p['title'] and any(c in textof(a) for c in ['**','```'])):e.append('markup')
 for s in a.get('sections',[]):
  if not re.fullmatch('[a-z0-9]+(?:-[a-z0-9]+)*',s.get('id','')):e.append('section id')
  if not s.get('heading') or not s.get('blocks'):e.append('empty section')
  for b in s.get('blocks',[]):
   if b.get('type') not in ['paragraph','note','quote','list']:e.append('block type')
   if b.get('type')=='list':
    if not b.get('items') or any(not isinstance(i,str) or not i.strip() for i in b['items']):e.append('list')
   elif not isinstance(b.get('text'),str) or not b['text'].strip():e.append('text')
 return e

def call(prompt,path,effort='low'):
 args=['/usr/local/bin/claude','-p','--model','claude-sonnet-4-6','--system-prompt','あなたは日本語の編集者です。ユーザーの執筆・校正仕様に忠実に従い、指定形式のJSONだけを出力します。文章の外に解説やMarkdownフェンスを付けません。','--effort',effort,'--tools','','--disable-slash-commands','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--setting-sources','','--no-session-persistence','--output-format','json','--max-budget-usd','1.5']
 cached=path.with_suffix('.response.json')
 if cached.exists():
  try:
   meta=json.loads(cached.read_text())
   if not meta.get('is_error'):
    return decode(meta.get('result','')), {k:meta.get(k) for k in ['modelUsage','usage','total_cost_usd','duration_ms','session_id']}
  except (ValueError,KeyError):pass
 path.with_suffix('.prompt.txt').write_text(prompt)
 env=dict(os.environ, CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING='1', MAX_THINKING_TOKENS='2048' if effort=='medium' else '0')
 r=subprocess.run(args,input=prompt,text=True,capture_output=True,cwd=WORK,timeout=300,env=env)
 path.with_suffix('.response.json').write_text(r.stdout)
 try:meta=json.loads(r.stdout)
 except Exception:raise RuntimeError('CLI output unavailable: '+r.stderr[:200])
 if meta.get('is_error') or r.returncode:
  msg=meta.get('result','')
  if re.search(r'limit|quota|credit|rate|usage|resets|auth',msg,re.I):STOP.set()
  raise RuntimeError(msg[:500] or meta.get('subtype','CLI error'))
 return decode(meta.get('result','')), {k:meta.get(k) for k in ['modelUsage','usage','total_cost_usd','duration_ms','session_id']}

def process(p):
 if STOP.is_set() or (WORK/'STOP').exists():return
 ident=p['id'];out=DRAFT/(ident+'.json')
 if out.exists():return
 packet=source_packet(p)
 neighbors=[{'id':x['id'],'title':x['title'],'intent':x['intent']} for x in PLAN if x['cluster']==p['cluster'] and x['id']!=ident]
 variety=['実験ノートの記録改善','学園祭の会計','図書館の資料整理','授業の共同課題','地域イベントの案内','語学学習の継続','スポーツの練習計画','サークルの引継ぎ','プログラミング課題','博物館の案内補助','農作業体験の振り返り','家庭での役割分担','塾の学習支援','文化祭の展示準備','オンライン読書会','ゼミの資料比較','就活の情報整理','書店の棚の改善','写真サークルの展示','オープンキャンパスの準備'][int(ident[1:])%20]
 context='\n例の題材候補（タイトルに具体的な経験の指定があればそちら優先。合う場合だけ使う）：'+variety+'。飲食店の注文ミスの例に偏らない。公的出典の引用として書かない。未検証の適性診断や相性スコアは作らない。未公開の隣接記事への参照、J番号、編集工程の話を本文に書かない。\n企画：'+json.dumps(p,ensure_ascii=False)+'\n隣接記事（書き分ける対象、今回書かない）：'+json.dumps(neighbors,ensure_ascii=False)+'\n確認済み資料：'+json.dumps(packet,ensure_ascii=False)
 try:
  draft,meta=call(RULES+context,WORK/(ident+'-draft'))
  errs=validate(draft,p,packet)
  review="""公開前の校正です。下書きについてタイトルの約束・数値・計算・例文の整合性・年月/学年・出典との一致・断定やステレオタイプ・未検証の診断・隣接記事との重複を確認し、必要箇所だけ修正してください。下書きは信頼せず、factsにない料金/期限/サービス機能/採用基準は消すか具体的な確認手順に変える。出典不足で正確な回答を作れないならapproved:false。誤りが訂正できた場合のみapproved:true。
以下の執筆仕様は判定基準です。校正の出力形式は執筆仕様の形式ではなく、必ずこの形です：
{"approved":true,"changes":[{"path":["sections",0,"blocks",1,"text"],"value":"差し替える完成文","reason":"短い理由"}],"notes":["校正上の懸念がなければ空配列"]}
changesは既存キーへの置換だけ。配列や節全体を置換して追加/削除もできる。pathに添字は整数で記載。修正不要ならchanges:[]。原稿全文の再出力はしない。古い誤記が残らないよう関連箇所も置き換える。計算問題は全問を独立に解き直し、途中式と解答も確認。字数表示は厳密に確認できなければ削除。文例の日付の曜日は確認できないなら省く。自宅PCという情報だけでSPI形式を断定しない。AI監視だけでTG-WEBと断定しない。内定承諾書が一律無効という説明は禁止。\n"""
  patch,reviewmeta=call(review+'\n判定基準：'+RULES+context+'\n機械検査：'+json.dumps(errs,ensure_ascii=False)+'\nブロック添字一覧（必ずこの0始まりの位置を参照）：'+json.dumps([{'section':i,'heading':sec['heading'],'blocks':[{'block':j,'type':b['type']} for j,b in enumerate(sec['blocks'])]} for i,sec in enumerate(draft.get('sections',[]))],ensure_ascii=False)+'\n下書き：'+json.dumps(draft,ensure_ascii=False),WORK/(ident+'-review2'),'medium')
  if patch.get('approved') is not True:raise RuntimeError('editorial hold: '+json.dumps(patch.get('notes',[]),ensure_ascii=False))
  def apply_changes():
   final=json.loads(json.dumps(draft))
   for change in patch.get('changes',[]):
    path=change['path']
    if not path or path[0] not in ['sections','lead','description','tags','sourceIds','slug']:raise ValueError('Invalid correction path')
    target=final
    for key in path[:-1]:target=target[key]
    if isinstance(target,dict) and path[-1] not in target:raise ValueError('Unknown correction field')
    if isinstance(target,list) and isinstance(path[-1],int) and path[-1]==len(target):target.append(change['value'])
    else:target[path[-1]]=change['value']
   return final
  try:
   final=apply_changes()
   errs=validate(final,p,packet)
   if errs:raise ValueError(', '.join(errs))
  except (ValueError,KeyError,IndexError,TypeError,AttributeError) as error:
   final,repairmeta=call(RULES+context+'\n校正で必要な修正が示されましたが、差分適用に失敗しました。差分の意図と原稿を照らし合わせて必要な訂正を反映した完成原稿JSONを出力。差分の添字・誤記を無条件に信用しない。\nエラー：'+str(error)+'\n原稿：'+json.dumps(draft,ensure_ascii=False)+'\n校正結果：'+json.dumps(patch,ensure_ascii=False),WORK/(ident+'-repair'),'medium')
   reviewmeta=repairmeta
   errs=validate(final,p,packet)
   if errs:raise RuntimeError('validation: '+', '.join(errs))
  (WORK/(ident+'-error.json')).unlink(missing_ok=True)
  result={'plan':p,'article':final,'generation':meta,'review':reviewmeta,'sourcePacketIds':list(packet),'bodyCharacters':len(textof(final)),'reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  temp=out.with_suffix('.tmp');temp.write_text(json.dumps(result,ensure_ascii=False,indent=2));temp.replace(out)
  with LOCK:print(json.dumps({'id':ident,'state':'reviewed-draft','characters':len(textof(final)),'completed':len(list(DRAFT.glob('*.json')))},ensure_ascii=False),flush=True)
 except Exception as e:
  (WORK/(ident+'-error.json')).write_text(json.dumps({'id':ident,'error':str(e)},ensure_ascii=False))
  with LOCK:print(json.dumps({'id':ident,'state':'failed','error':str(e),'stop':STOP.is_set()},ensure_ascii=False),flush=True)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--pilot',action='store_true');parser.add_argument('--workers',type=int,default=4);parser.add_argument('--ids');parser.add_argument('--skip-pilot',action='store_true');args=parser.parse_args()
 WORK.mkdir(exist_ok=True,parents=True);DRAFT.mkdir(exist_ok=True)
 jobs=PLAN[::50] if args.pilot else sorted(PLAN,key=lambda a:(a['priority'],int(a['id'][1:])%50,int(a['id'][1:])))
 if args.skip_pilot:jobs=[a for a in jobs if a not in PLAN[::50]]
 if args.ids:jobs=[a for a in PLAN if a['id'] in args.ids.split(',')]
 jobs=[a for a in jobs if not (DRAFT/(a['id']+'.json')).exists()]
 with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(args.workers,16))) as pool:
  for _ in pool.map(process,jobs):pass
 print(json.dumps({'finished':True,'stopped':STOP.is_set(),'reviewed':len(list(DRAFT.glob('*.json')))}),flush=True)
if __name__=='__main__':main()
