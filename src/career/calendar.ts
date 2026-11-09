import type { CareerItem } from './planner';
import { shiftDay, validateDraft } from './planner';
const compact = (day: string, time='') => day.replace(/-/g,'') + (time ? 'T'+time.replace(':','')+'00' : '');
export function eventRange(item: CareerItem) {
  validateDraft(item); if (!item.date) throw new Error('日付を入力してからカレンダーへ登録してください。');
  if (!item.time) return { start: { date:item.date }, end: { date:shiftDay(item.date,1) } };
  const start = `${item.date}T${item.time}:00+09:00`;
  const end = item.endTime ? `${item.date}T${item.endTime}:00+09:00` : new Date(new Date(start).getTime()+item.minutes*60000).toISOString();
  return { start:{ dateTime:start,timeZone:'Asia/Tokyo' }, end:{ dateTime:end,timeZone:'Asia/Tokyo' } };
}
export function googleCalendarLink(item: CareerItem) {
  const range=eventRange(item); const start='date' in range.start ? compact(range.start.date!) : new Date(range.start.dateTime!).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');
  const end='date' in range.end ? compact(range.end.date!) : new Date(range.end.dateTime!).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');
  const p=new URLSearchParams({action:'TEMPLATE',text:`${item.company}｜${item.title}`,dates:`${start}/${end}`,ctz:'Asia/Tokyo',details:[item.notes,item.url].filter(Boolean).join('\n'),location:item.location});
  return `https://calendar.google.com/calendar/render?${p}`;
}
const escapeIcs=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
export function calendarFile(items: CareerItem[]) {
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AIshukatsu//Career Planner//JA','CALSCALE:GREGORIAN'];
  for(const item of items.filter(i=>i.date&&i.kind!=='es')){
    const range=eventRange(item);const stamp=(v:string)=>new Date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');
    lines.push('BEGIN:VEVENT',`UID:${item.id}@aishukatsu.net`,`DTSTAMP:${stamp(new Date().toISOString())}`,
      'date' in range.start?`DTSTART;VALUE=DATE:${compact(range.start.date!)}`:`DTSTART:${stamp(range.start.dateTime!)}`,
      'date' in range.end?`DTEND;VALUE=DATE:${compact(range.end.date!)}`:`DTEND:${stamp(range.end.dateTime!)}`,
      `SUMMARY:${escapeIcs(item.company+'｜'+item.title)}`,`DESCRIPTION:${escapeIcs([item.notes,item.url].filter(Boolean).join('\n'))}`,`LOCATION:${escapeIcs(item.location)}`,'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  // RFC 5545 folds lines by UTF-8 octets, including continuation whitespace.
  return lines.map(line=>{let out='',part='',bytes=0;for(const ch of line){const n=new TextEncoder().encode(ch).length;if(bytes+n>73){out+=part+'\r\n ';part='';bytes=1;}part+=ch;bytes+=n;}return out+part;}).join('\r\n')+'\r\n';
}
