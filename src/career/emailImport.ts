import { newDraft, safeUrl, type CareerDraft } from './planner';
import { parseLocalDate } from '../lib/deadlines';
export interface MailPreview { company: string; items: CareerDraft[]; warnings: string[]; }
export const MAIL_EXAMPLE = `件名：【株式会社みらい】一次面接のご案内
株式会社みらい 採用担当です。
以下の日程で一次面接を行います。
日時：2026年11月20日（金）14:00〜15:00
会場：オンライン
参加URL：https://meet.google.com/abc-defg-hij
参加可否は2026年11月15日（日）までにご返信ください。
履歴書を2026年11月19日（木）23:59までにご提出ください。`;
const datePattern = /(?:(\d{4})[年/.-])?(\d{1,2})[月/.-](\d{1,2})(?:日)?/g;
function dateIn(line: string, today: string): { date: string; index: number; end: number; inferred: boolean }[] {
  const result = [];
  for (const m of line.matchAll(datePattern)) {
    // Do not treat pieces of a phone number, timestamp, URL, or a longer number as dates.
    if (/\d/.test(line[m.index!-1] ?? '') || /\d/.test(line[m.index!+m[0].length] ?? '')) continue;
    const year = m[1] ? Number(m[1]) : Number(today.slice(0,4));
    const date = `${year}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    if (parseLocalDate(date)) result.push({ date, index: m.index!, end: m.index!+m[0].length, inferred: !m[1] });
  }
  return result;
}
function times(line: string) {
  return [...line.matchAll(/(?:(午前|午後)\s*)?(\d{1,2})\s*(?::\s*(\d{2})|時\s*(?:(\d{1,2})分|半)?)/g)].map(m => {
    let h = Number(m[2]); const min = m[3] ? Number(m[3]) : m[4] ? Number(m[4]) : /半/.test(m[0]) ? 30 : 0;
    if (m[1] === '午後' && h < 12) h += 12; if (m[1] === '午前' && h === 12) h = 0;
    return h < 24 && min < 60 ? `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}` : '';
  }).filter(Boolean);
}
export function previewMail(raw: string, today: string, knownCompanies: string[] = []): MailPreview {
  if (raw.length > 100000) throw new Error('メールは10万文字以内で貼り付けてください。');
  const text = raw.normalize('NFKC').replace(/\r/g,'');
  // Quoted messages often contain superseded dates. The original remains visible in the editor.
  const current = text.split(/\n(?:On .+wrote:|[- ]*Original Message[- ]*|[- ]*転送メッセージ[- ]*)/i)[0];
  const lines = current.split('\n').filter(l => !/^\s*>/.test(l));
  const activeText = lines.join('\n');
  const companyMatches = [...new Set(knownCompanies.filter(c => activeText.includes(c)))];
  const senderLine = lines.find(l => /(?:株式会社|合同会社|有限会社).*(?:採用|人事|担当)/.test(l));
  const subject = lines.find(l=>/^(?:件名|Subject)\s*[:：]/i.test(l)) ?? '';
  const company = companyMatches.length === 1 ? companyMatches[0] : ((subject+'\n'+(senderLine??'')).match(/(?:株式会社|合同会社|有限会社)[^\s\n【】「」<>:：、。]{1,35}/)?.[0] ?? '').replace(/(?:採用|人事|のご案内).*$/,'');
  const urls = [...activeText.matchAll(/https?:\/\/[^\s<>"）)」]+/g)].map(m=>safeUrl(m[0])).filter(Boolean);
  const meetingUrl = urls.find(u=>/meet\.google\.com|zoom\.(?:us|com)|teams\.microsoft\.com/.test(new URL(u).hostname)) ?? '';
  const location = lines.find(l=>/^(?:会場|場所|実施方法)\s*[:：]/.test(l.trim()))?.replace(/^.*?[:：]\s*/,'').trim() ?? '';
  const items: CareerDraft[] = []; const warnings = new Set<string>(); let inferred = false;
  for (let i=0; i<lines.length; i++) {
    const line = lines[i]; if (/https?:\/\//.test(line) && !/(?:日時|締切|期限|までに)/.test(line)) continue;
    const dates = dateIn(line,today); if (!dates.length) continue;
    const context = lines.slice(Math.max(0,i-2),i+2).join(' ');
    for (let j=0;j<dates.length;j++) {
      const d=dates[j]; inferred ||= d.inferred;
      const segment = line.slice(d.index, dates[j+1]?.index ?? undefined);
      const task = /締切|締め切り|期限|までに|返信|提出|アップロード|回答|予約/.test(line);
      const old = /旧日程|変更前|以前の|前回の|送信日時|受信日時/.test(line);
      if (old) { warnings.add('過去の日程と思われる行は候補から除きました。原文も確認してください。'); continue; }
      let title = task ? /返信|参加可否|回答/.test(line) ? '参加可否を返信する' : /履歴書/.test(line) ? '履歴書を提出する' : /ES|エントリーシート/.test(line) ? 'ESを提出する' : /適性|検査|テスト/.test(line) ? 'Webテストを受ける' : '提出・対応期限を確認する' :
        /最終面接/.test(context) ? '最終面接' : /二次|2次/.test(context) ? '二次面接' : /一次|1次/.test(context) ? '一次面接' : /面接/.test(context) ? '面接' : /説明会/.test(context) ? '会社説明会' : /面談/.test(context) ? '面談' : '予定を確認する';
      const ts=times(segment); const start=ts[0]??''; const end=!task&&ts[1]&&ts[1]>start?ts[1]:'';
      if (dates.length>1 && !task) warnings.add('複数の日程があります。候補日か確定日かを確認し、不要な候補を外してください。');
      if (d.date<today) warnings.add('過去の日付を含みます。年・日程変更・引用メールを確認してください。');
      items.push(newDraft({ company, kind: task?'task':'event', title, date:d.date, time:start, endTime:end,
        location:task?'':location, url:task?'':meetingUrl, notes:line.trim(), minutes:task?15:60, source:'メール取り込み' }));
    }
  }
  if (inferred) warnings.add('年がない日付は今年を候補にしています。登録前に年を確認してください。');
  if (/明日|明後日|来週|翌日|前日/.test(current)) warnings.add('相対的な日付は自動で確定していません。必要な対応事項を手動で追加してください。');
  if (companyMatches.length>1) warnings.add('企業名が複数見つかりました。登録先の企業を選んでください。');
  if (!company) warnings.add('企業名を確認できませんでした。企業名を入力してください。');
  if (/変更|延期|キャンセル|中止/.test(current)) warnings.add('変更・中止の案内かもしれません。既存の予定を確認し、必要に応じて編集してください。');
  if (!items.length) warnings.add('日付を含む候補が見つかりませんでした。予定・タスクを手動で追加できます。');
  if (items.length > 50) warnings.add('候補が多いため、最初の50件を表示しています。メールを分けて取り込んでください。');
  return { company, items:items.slice(0,50), warnings:[...warnings] };
}
