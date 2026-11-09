import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, CheckSquare2, ChevronRight, Files, Link2, Palette, Search, Settings2, Table2, X } from 'lucide-react';
import { AppUpdateTrigger } from './UpdateBanner';
import { Modal } from './ui/Modal';
import { platformShortcut, updatePreferences, usePreferences, type AppTheme } from '../lib/preferences';
import { collectSearchableFiles } from '../lib/documentSearch';
import type { Workspace } from '../types';
import type { FileTab } from '../hooks/useOpenTabs';
import './app-shell.css';

export type AppSection = 'documents' | 'calendar' | 'spreadsheet' | 'tasks' | 'connections';
export const APP_SECTIONS = [
  { id: 'documents', label: '資料', icon: Files, description: 'ローカルの企業研究・ES・書類' },
  { id: 'calendar', label: 'カレンダー', icon: CalendarDays, description: '面接・説明会・提出期限' },
  { id: 'spreadsheet', label: '就活表', icon: Table2, description: '企業・選考状況の一覧表' },
  { id: 'tasks', label: 'タスク', icon: CheckSquare2, description: '今日の予定と次にすること' },
  { id: 'connections', label: '連携', icon: Link2, description: 'Googleカレンダー・Gmail' },
] as const;
export const APP_THEMES: {id: AppTheme; label: string; color: string; description: string}[] = [
  { id: 'aishukatsu', label: 'AI就活', color: '#5654b8', description: '標準 · ネイビーとインディゴ' },
  { id: 'sage', label: 'セージ', color: '#718063', description: '落ち着いたグリーン' },
  { id: 'plum', label: 'プラム', color: '#805a82', description: 'やわらかいパープル' },
  { id: 'midnight', label: 'ミッドナイト', color: '#292e4c', description: '暗い場所でも見やすい配色' },
];
interface Props {
  section: AppSection;
  onNavigate: (section: AppSection) => void;
  workspace?: Workspace | null;
  onOpenFile?: (file: Omit<FileTab, 'kind'>) => void;
  onSettings: () => void;
  status?: ReactNode;
  children: ReactNode;
}

/** The shell owns navigation; feature views share one inset work surface. */
export function AppShell({ section, onNavigate, workspace, onOpenFile, onSettings, status, children }: Props) {
  const preferences = usePreferences();
  const [themeOpen, setThemeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [navigation, setNavigation] = useState<{items:AppSection[];index:number}>({items:[section],index:0});
  const {items:history,index:position}=navigation;
  const traveling = useRef<number|null>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target=traveling.current;traveling.current=null;
    setNavigation(previous => {
      if(previous.items[previous.index]===section)return previous;
      if(target!==null&&previous.items[target]===section)return {...previous,index:target};
      return {items:[...previous.items.slice(0,previous.index+1),section],index:previous.index+1};
    });
  }, [section]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !document.querySelector('[aria-modal="true"]')) {
        event.preventDefault(); setSearchOpen(true); setThemeOpen(false);
      }
      if (event.key === 'Escape') setThemeOpen(false);
    };
    const outside = (event: PointerEvent) => { if (!themeRef.current?.contains(event.target as Node)) setThemeOpen(false); };
    window.addEventListener('keydown', key); document.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside); };
  }, []);
  const files = useMemo(() => workspace ? collectSearchableFiles(workspace) : [], [workspace]);
  const normalized = query.trim().toLocaleLowerCase();
  const matchingFiles = normalized ? files.filter(file => [...file.breadcrumb, file.label].join('/').toLocaleLowerCase().includes(normalized)).slice(0, 30) : [];
  const sections = APP_SECTIONS.filter(item => !normalized || `${item.label} ${item.description}`.toLocaleLowerCase().includes(normalized));
  const navigate = (target: AppSection) => { traveling.current=null; onNavigate(target); setSearchOpen(false); setQuery(''); setThemeOpen(false); };
  const travel = (next: number) => { if (next < 0 || next >= history.length) return; traveling.current = next; onNavigate(history[next]); };
  return <div className={`workspace-app app-theme app-shell ${preferences.density === 'compact' ? 'workspace-compact' : 'workspace-comfortable'} ${preferences.textSize === 'large' ? 'workspace-large-text' : ''}`} data-theme={preferences.theme}>
    <header className="app-shell-header">
      <button className="app-brand" aria-label="AI就活 資料を開く" onClick={() => navigate('documents')}><span>AI<small>就活</small></span></button>
      <div className="app-shell-location"><button className="app-icon" aria-label="前の画面" disabled={position === 0} onClick={() => travel(position - 1)}><ArrowLeft size={19}/></button><button className="app-icon" aria-label="次の画面" disabled={position >= history.length - 1} onClick={() => travel(position + 1)}><ArrowRight size={19}/></button><strong>{APP_SECTIONS.find(item => item.id === section)?.label}</strong></div>
      <button className="app-global-search" onClick={() => { setSearchOpen(true); setThemeOpen(false); }}><Search size={19}/><span>資料・機能を検索</span><kbd>{platformShortcut('K')}</kbd></button>
      <div className="app-header-actions" ref={themeRef}>
        <button className="app-icon" aria-label="カラーテーマを変更" aria-expanded={themeOpen} onClick={() => setThemeOpen(open => !open)}><Palette size={20}/></button>
        {themeOpen && <div className="app-theme-menu" role="group" aria-label="カラーテーマ" onKeyDown={event=>{if(event.key==='Escape'){setThemeOpen(false);themeRef.current?.querySelector<HTMLButtonElement>('button')?.focus();}}}><div className="app-theme-menu-title">カラーテーマ<small>この端末での表示に適用</small></div>{APP_THEMES.map(theme => <button key={theme.id} aria-pressed={preferences.theme === theme.id} onClick={() => updatePreferences({ theme: theme.id })}><span className="app-theme-swatch" style={{ background: theme.color }}/><span>{theme.label}<small>{theme.description}</small></span>{preferences.theme === theme.id && <Check size={16}/>}</button>)}</div>}
      </div>
    </header>
    <div className="app-shell-body">
      <nav className="app-rail" aria-label="AI就活の機能">{APP_SECTIONS.map(item => <button key={item.id} title={item.description} aria-current={section === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><item.icon size={23} strokeWidth={1.65}/><span>{item.label}</span></button>)}<div className="app-rail-spacer"/><AppUpdateTrigger/><button onClick={onSettings} title="設定とバックアップ"><Settings2 size={22} strokeWidth={1.65}/><span>設定</span></button></nav>
      <main className={`app-inset-panel app-section-${section}`} aria-label={APP_SECTIONS.find(item => item.id === section)?.label}>
        {status && <div className="app-save-status">{status}</div>}
        <div className="app-panel-content">{children}</div>
      </main>
    </div>
    {searchOpen && <Modal open onClose={() => { setSearchOpen(false); setQuery(''); }} ariaLabel="資料と機能を検索" className="app-search-dialog"><div className="app-command-input"><Search size={21}/><input data-autofocus aria-label="資料・機能の検索語" placeholder="企業名、資料名、機能を検索…" value={query} onChange={event => setQuery(event.target.value)}/><button className="app-icon" aria-label="検索を閉じる" onClick={() => { setSearchOpen(false); setQuery(''); }}><X size={18}/></button></div><div className="app-command-results">{sections.length > 0 && <><p>機能</p>{sections.map(item => <button key={item.id} onClick={() => navigate(item.id)}><item.icon size={20}/><span>{item.label}<small>{item.description}</small></span><ChevronRight size={16}/></button>)}</>}{matchingFiles.length > 0 && <><p>資料</p>{matchingFiles.map(file => <button key={file.key} onClick={() => { onOpenFile?.(file); setSearchOpen(false); setQuery(''); }}><BookOpen size={19}/><span>{file.label}<small>{file.breadcrumb.join(' / ') || 'ライブラリ'}</small></span><ChevronRight size={16}/></button>)}</>}{!sections.length && !matchingFiles.length && <div className="app-search-empty">一致する資料・機能はありません。別の名前で検索してください。</div>}</div><footer>資料名・フォルダ名から検索します<span>Esc で閉じる</span></footer></Modal>}
  </div>;
}
