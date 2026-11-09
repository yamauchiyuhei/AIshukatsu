import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, FilePlus2, Folder, FolderOpen, FolderPlus, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, RefreshCw, Search, Upload } from 'lucide-react';
import type { FileTab } from '../hooks/useOpenTabs';
import type { Workspace, WorkspaceNode } from '../types';
import type { ContextMenuRequest } from './FileTree';
import { fileIconFor } from './fileIcons';
import { getFileKind } from '../lib/fileKind';
import { flushAllSaves } from '../lib/saveQueue';
import { usePreferences, updatePreferences } from '../lib/preferences';
import { toast } from '../spreadsheet/components/Toast';

interface Props {
  workspace: Workspace | null;
  activeFile?: FileTab | null;
  documentView?: ReactNode;
  onOpenFile: (file: Omit<FileTab, 'kind'>) => void;
  onBrowse: () => Promise<void>;
  onChooseFolder: () => Promise<unknown>;
  onStartSetup?: () => void;
  onRefresh: () => Promise<unknown>;
  onAddFolder: (path: string[]) => void;
  onAddFile: (path: string[]) => void;
  onAddCompany: () => void;
  onImportFiles?: (path: string[], files: File[]) => Promise<unknown>;
  onContextMenu?: (request: ContextMenuRequest) => void;
  onMoveNode?: (sourcePath: string[], destination: string[]) => void;
}
const MIME = 'application/x-aishukatsu-path';
const samePath = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);
function libraryTree(workspace: Workspace | null): WorkspaceNode[] {
  if (!workspace) return [];
  const nodes = [...workspace.tree];
  if (workspace.templates.dirHandle && workspace.templates.files.length) nodes.push({kind: 'folder', name: '_テンプレート', path: ['_テンプレート'], handle: workspace.templates.dirHandle, children: workspace.templates.files.map(file => ({kind: 'file', name: file.name, path: ['_テンプレート', file.name], handle: file.handle}))});
  return nodes;
}
const typeLabels: Record<string, string> = { markdown: 'Markdown', pdf: 'PDF', docx: 'Word', image: '画像', sheet: 'Excel・CSV', text: 'テキスト', unsupported: 'ファイル' };

export function DocumentLibrary({workspace, activeFile, documentView, onOpenFile, onBrowse, onChooseFolder, onStartSetup, onRefresh, onAddFolder, onAddFile, onAddCompany, onImportFiles, onContextMenu, onMoveNode}: Props) {
  const preferences = usePreferences();
  const [smallScreen,setSmallScreen] = useState(()=>window.matchMedia('(max-width:700px)').matches);
  const [mobileExplorer,setMobileExplorer] = useState(false);
  useEffect(()=>{const media=window.matchMedia('(max-width:700px)');const changed=()=>{setSmallScreen(media.matches);setMobileExplorer(false);};media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);},[]);
  const explorerCollapsed=preferences.sidebarCollapsed||(smallScreen&&!mobileExplorer);
  const closeExplorer=()=>{if(smallScreen)setMobileExplorer(false);else updatePreferences({sidebarCollapsed:true});};
  const openExplorer=()=>{setMobileExplorer(true);updatePreferences({sidebarCollapsed:false});};
  const [path, setPath] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('name');
  const [format, setFormat] = useState('all');
  const [busy, setBusy] = useState(false);
  const [modified, setModified] = useState<Record<string, number>>({});
  const tree = useMemo(() => libraryTree(workspace), [workspace]);
  useEffect(() => { setPath([]); setQuery(''); setModified({}); }, [workspace?.root]);
  let nodes = tree;
  let valid = true;
  for (const segment of path) { const folder = nodes.find(node => node.kind === 'folder' && node.name === segment); if (!folder || folder.kind !== 'folder') { valid = false; break; } nodes = folder.children; }
  const currentPath = valid ? path : [];
  if (!valid) nodes = tree;
  const visible = nodes.filter(node => node.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (format === 'all' || (format === 'folder' ? node.kind === 'folder' : node.kind === 'file' && getFileKind(node.name) === format))).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
    if (sort === 'modified') return (modified[b.path.join('/')] || 0) - (modified[a.path.join('/')] || 0) || a.name.localeCompare(b.name, 'ja');
    return (sort === 'reverse' ? -1 : 1) * a.name.localeCompare(b.name, 'ja', { numeric: true });
  });
  const nodeKey = nodes.map(node => node.path.join('/')).join('\n');
  useEffect(() => {
    let cancelled = false;
    const files = nodes.filter((node): node is Extract<WorkspaceNode,{kind:'file'}> => node.kind === 'file');
    void Promise.all(files.map(async node => { try { return [node.path.join('/'), (await node.handle.getFile()).lastModified] as const; } catch { return [node.path.join('/'), 0] as const; } })).then(entries => { if (!cancelled) setModified(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [workspace, nodeKey]);
  const run = async (action: () => Promise<unknown>) => { if (busy) return; setBusy(true); try { await action(); } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) toast.error(error instanceof Error ? error.message : '操作を完了できませんでした。'); } finally { setBusy(false); } };
  const browse = (next: string[]) => void run(async () => { await flushAllSaves(); await onBrowse(); setPath(next); setQuery(''); if(smallScreen)setMobileExplorer(false); });
  const open = (node: WorkspaceNode) => {
    if (node.kind === 'folder') { browse(node.path); return; }
    if(smallScreen)setMobileExplorer(false);
    onOpenFile({ key: node.path[0] === '_テンプレート' ? `tpl/${node.name}` : `co:${node.path.join('/')}`, label: node.name, handle: node.handle, breadcrumb: node.path.slice(0,-1) });
  };
  const context = (event: {clientX: number; clientY: number; preventDefault: () => void}, node: WorkspaceNode) => { if (!onContextMenu || node.path[0] === '_テンプレート') return; event.preventDefault(); onContextMenu({ x: event.clientX, y: event.clientY, target: { kind: node.kind, name: node.name, path: node.path } }); };
  const drop = (event: React.DragEvent, destination: string[]) => {
    const raw = event.dataTransfer.getData(MIME); if (!raw || !onMoveNode) return;
    event.preventDefault(); event.stopPropagation();
    try { const source = JSON.parse(raw); if (!Array.isArray(source) || !source.every(part => typeof part === 'string') || !source.length || source[0] === '_テンプレート' || destination[0] === '_テンプレート' || samePath(source, destination) || samePath(source.slice(0,-1), destination) || (source.length < destination.length && source.every((part, index) => destination[index] === part))) return; onMoveNode(source, destination); } catch {}
  };
  const dragOver = (event: React.DragEvent) => { if (onMoveNode && event.dataTransfer.types.includes(MIME)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } };
  const title = activeFile ? activeFile.label : currentPath.at(-1) || 'すべての資料';
  const crumbs = activeFile ? activeFile.breadcrumb : currentPath;
  return <div className="document-library">
    {!explorerCollapsed && <aside className="document-explorer" aria-label="資料のエクスプローラー" style={{width: preferences.sidebarWidth}}>
      <header><span>エクスプローラー</span><div><button className="app-icon" aria-label="資料一覧を更新" disabled={busy} onClick={() => void run(onRefresh)}><RefreshCw size={16}/></button><button className="app-icon" aria-label="エクスプローラーを閉じる" onClick={closeExplorer}><PanelLeftClose size={17}/></button></div></header>
      <div className="document-tree" onDragOver={dragOver} onDrop={event => drop(event, [])}>
        <button className={`document-tree-root ${!currentPath.length && !activeFile ? 'is-current' : ''}`} aria-current={!currentPath.length && !activeFile ? 'location' : undefined} onClick={() => browse([])}><FolderOpen size={20}/><span>すべての資料</span><small>{countFiles(tree)}</small></button>
        {tree.map(node => <LibraryTreeNode key={node.path.join('/')} node={node} depth={0} currentPath={currentPath} activeFile={activeFile} onOpen={open} onContext={context} onDrop={drop} onDragOver={dragOver}/>)}
      </div>
      <footer><button disabled={busy} onClick={() => void run(async () => { await flushAllSaves(); await onChooseFolder(); })}><FolderOpen size={16}/><span>{workspace?.root.name || 'ローカルフォルダを選択'}<small>{workspace ? 'フォルダを変更' : 'この端末の資料を開く'}</small></span><ChevronRight size={15}/></button></footer>
      <div className="document-explorer-resize" role="separator" aria-label="エクスプローラーの幅" aria-orientation="vertical" aria-valuemin={200} aria-valuemax={400} aria-valuenow={preferences.sidebarWidth} tabIndex={0} onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();updatePreferences({sidebarWidth:Math.max(200,Math.min(400,preferences.sidebarWidth+(event.key==='ArrowRight'?20:-20)))});}}} onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId)){const left=event.currentTarget.parentElement!.getBoundingClientRect().left;updatePreferences({sidebarWidth:Math.max(200,Math.min(400,event.clientX-left))});}}} onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}/>
    </aside>}
    <section className="document-main" aria-label="資料一覧と閲覧画面">
      <div className="document-toolbar"><div className="document-breadcrumb">{explorerCollapsed && <button className="app-icon" aria-label="エクスプローラーを開く" onClick={openExplorer}><PanelLeftOpen size={18}/></button>}<button onClick={() => browse([])}>ライブラリ</button>{crumbs.map((part, index) => <span key={index}><ChevronRight size={15}/><button onClick={() => browse(crumbs.slice(0,index+1))}>{part}</button></span>)}{activeFile && <><ChevronRight size={15}/><span className="document-current-file">{activeFile.label}</span></>}</div>
        {workspace && <div className="document-tools">{activeFile ? <button className="app-button" onClick={() => browse(currentPath)}>資料一覧へ</button> : <><button className="app-icon" aria-label="企業フォルダを追加" title="企業フォルダを追加" onClick={onAddCompany}><Plus size={18}/></button><button className="app-icon" aria-label="新しいフォルダ" title="新しいフォルダ" disabled={currentPath[0] === '_テンプレート'} onClick={() => onAddFolder(currentPath)}><FolderPlus size={18}/></button><button className="app-button" disabled={currentPath[0] === '_テンプレート'} onClick={() => onAddFile(currentPath)}><FilePlus2 size={16}/><span>文書を作成</span></button></>}</div>}
      </div>
      {activeFile && documentView ? <div className="document-open-view">{documentView}</div> : workspace ? <div className="document-list-content">
        <div className="document-list-title"><h1>{title}</h1><span>{nodes.length} 項目</span></div>
        <div className="document-list-controls"><label className="document-search"><Search size={19}/><input aria-label="このフォルダを検索" placeholder="このフォルダを検索" value={query} onChange={event => setQuery(event.target.value)}/></label><label>並び順<select aria-label="資料の並び順" value={sort} onChange={event => setSort(event.target.value)}><option value="name">名前</option><option value="reverse">名前（降順）</option><option value="modified">更新日時</option></select></label><label>形式<select aria-label="資料の形式" value={format} onChange={event => setFormat(event.target.value)}><option value="all">すべて</option><option value="folder">フォルダ</option><option value="markdown">Markdown</option><option value="pdf">PDF</option><option value="sheet">Excel・CSV</option><option value="docx">Word</option><option value="image">画像</option></select></label>{onImportFiles && currentPath[0] !== '_テンプレート' && <label className={`app-button document-upload ${busy ? 'is-disabled' : ''}`}><Upload size={16}/><span>ファイルを追加</span><input type="file" multiple disabled={busy} aria-label="資料ファイルを追加" onChange={event => { const files = [...(event.target.files || [])]; event.target.value = ''; if (files.length) void run(() => onImportFiles(currentPath, files)); }}/></label>}</div>
        <div className="document-list-head"><span>名前</span><span>形式</span></div>
        <div className="document-rows" onDragOver={dragOver} onDrop={event => drop(event, currentPath)}>{visible.map(node => {const Icon = node.kind === 'folder' ? Folder : fileIconFor(node.name); const date = modified[node.path.join('/')]; return <div className="document-row" key={node.path.join('/')} onContextMenu={event => context(event,node)} onDragOver={node.kind === 'folder' ? dragOver : undefined} onDrop={node.kind === 'folder' ? event => drop(event,node.path) : undefined}><button className="document-row-open" onClick={() => open(node)} draggable={node.path[0] !== '_テンプレート'} onDragStart={event => { event.dataTransfer.setData(MIME,JSON.stringify(node.path)); event.dataTransfer.effectAllowed = 'move'; }}><Icon size={25} strokeWidth={1.6}/><span><strong>{node.name}</strong><small>{node.kind === 'folder' ? `${node.children.length} 項目` : date ? new Date(date).toLocaleDateString('ja-JP') : 'ローカルファイル'}</small></span><span className="document-file-kind">{node.kind === 'folder' ? 'フォルダ' : typeLabels[getFileKind(node.name)]}</span><ChevronRight size={18}/></button>{onContextMenu && node.path[0] !== '_テンプレート' && <button className="app-icon document-row-more" aria-label={`${node.name}の操作`} onClick={event => context(event,node)}><MoreHorizontal size={20}/></button>}</div>;})}{!visible.length && <div className="document-empty"><FolderOpen size={30}/><h2>{nodes.length ? '一致する資料はありません' : 'このフォルダは空です'}</h2><p>{nodes.length ? '検索語や形式を変更してください。' : '文書を作成するか、ファイルを追加して整理しましょう。'}</p>{nodes.length > 0 && <button className="app-button" onClick={() => {setQuery('');setFormat('all');}}>絞り込みを解除</button>}</div>}</div>
      </div> : <div className="document-empty document-folder-prompt"><FolderOpen size={38}/><h1>就活の資料を、ひとつの場所に。</h1><p>企業研究やESを保存したローカルフォルダを選んでください。<br/>PDF・Word・Excel・画像も、そのまま開けます。</p><button className="app-button primary" disabled={busy} onClick={() => void run(onChooseFolder)}><FolderOpen size={18}/>ローカルフォルダを選択</button><small>選んだフォルダ内のファイルを表示します。</small>{onStartSetup&&<button className="document-setup-link" onClick={onStartSetup}>はじめての方：就活フォルダを準備する</button>}</div>}
    </section>
  </div>;
}
function countFiles(nodes: WorkspaceNode[]): number { return nodes.reduce((sum,node) => sum + (node.kind === 'file' ? 1 : countFiles(node.children)),0); }
function LibraryTreeNode({node,depth,currentPath,activeFile,onOpen,onContext,onDrop,onDragOver}: {node: WorkspaceNode;depth: number;currentPath: string[];activeFile?: FileTab|null;onOpen: (node: WorkspaceNode) => void;onContext: (event: React.MouseEvent,node: WorkspaceNode) => void;onDrop: (event: React.DragEvent,path: string[]) => void;onDragOver: (event: React.DragEvent) => void}) {
  const [expanded,setExpanded] = useState<boolean|null>(null);
  const active = node.kind === 'folder' ? !activeFile && samePath(node.path,currentPath) : activeFile?.handle === node.handle;
  const ancestor = node.kind === 'folder' && node.path.every((part,index) => (activeFile?.breadcrumb || currentPath)[index] === part);
  const open = expanded ?? ancestor;
  useEffect(()=>{if(ancestor)setExpanded(null);},[ancestor,currentPath.join('/'),activeFile?.key]);
  const Icon = node.kind === 'folder' ? open ? FolderOpen : Folder : fileIconFor(node.name);
  return <div><div className={`document-tree-row ${active ? 'is-current' : ''}`} style={{paddingLeft: 8 + depth * 16}} onContextMenu={event => onContext(event,node)} onDragOver={node.kind === 'folder' ? onDragOver : undefined} onDrop={node.kind === 'folder' ? event => onDrop(event,node.path) : undefined}>{node.kind === 'folder' ? <button className="document-tree-chevron" aria-label={`${node.name}を${open ? '折りたたむ' : '展開'}`} aria-expanded={open} onClick={() => { setExpanded(!open); }}><ChevronDown size={14} style={{transform: open ? undefined : 'rotate(-90deg)'}}/></button> : <span className="document-tree-chevron"/>}<button className="document-tree-name" aria-current={active ? 'location' : undefined} title={node.name} onClick={() => onOpen(node)}><Icon size={19} strokeWidth={1.7}/><span>{node.name}</span></button></div>{node.kind === 'folder' && open && node.children.map(child => <LibraryTreeNode key={child.path.join('/')} node={child} depth={depth+1} currentPath={currentPath} activeFile={activeFile} onOpen={onOpen} onContext={onContext} onDrop={onDrop} onDragOver={onDragOver}/>)}</div>;
}
