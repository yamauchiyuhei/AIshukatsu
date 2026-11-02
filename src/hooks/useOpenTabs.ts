import type { Workspace } from '../types';
import { collectSearchableFiles } from '../lib/documentSearch';
import { flushAllSaves } from '../lib/saveQueue';
import { useCallback, useState, useRef, useEffect } from 'react';
import { getFileKind, type FileKind } from '../lib/fileKind';

/**
 * A single open FILE tab. `kind` is derived from the file's extension and
 * drives which viewer is rendered (see `TabViewer`). Markdown is the only
 * editable kind; every other kind is read-only.
 */
export interface FileTab {
  kind: FileKind;
  instanceId?: string;
  key: string;          // unique path-like id
  label: string;        // display name shown in tab
  breadcrumb: string[]; // breadcrumb context (kept for tooltip / future use)
  handle: FileSystemFileHandle;
}

export type OpenTab = FileTab;

export function useOpenTabs(workspace?: Workspace | null, owner = 'local-guest') {
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const restored = useRef('');
  const skipPersist = useRef(false);
  const storageKey = workspace ? `aishukatsu-tabs:${owner}:${(workspace.root as unknown as {_absPath?:string})._absPath ?? workspace.root.name}` : '';
  useEffect(() => {
    if (!workspace || restored.current === storageKey) return;
    restored.current = storageKey; skipPersist.current = true;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? '{}');
      const available = new Map(collectSearchableFiles(workspace).map(file => [file.key,file]));
      const next: OpenTab[] = (Array.isArray(saved.keys) ? saved.keys : []).slice(0,40).flatMap((key:string) => {
        const file = available.get(key); return file ? [{...file,kind:getFileKind(file.label),instanceId:crypto.randomUUID()}] : [];
      });
      setTabs(next); setActiveKey(next.some(tab=>tab.key===saved.activeKey) ? saved.activeKey : null);
    } catch { setTabs([]); setActiveKey(null); }
  },[workspace,storageKey]);
  useEffect(()=>{
    if (!storageKey || restored.current !== storageKey) return;
    if (skipPersist.current) { skipPersist.current=false; return; }
    try { sessionStorage.setItem(storageKey,JSON.stringify({keys:tabs.map(tab=>tab.key),activeKey})); } catch {}
  },[storageKey,tabs,activeKey]);
  const guard = async () => {
    try { await flushAllSaves(); return true; } catch { window.dispatchEvent(new Event('aishukatsu-save-error')); return false; }
  };
  const openFile = useCallback(async (tab: Omit<FileTab,'kind'>) => {
    if (!await guard()) return;
    setTabs(previous => previous.some(item=>item.key===tab.key) ? previous : [...previous,{...tab,kind:getFileKind(tab.label),instanceId:crypto.randomUUID()}]);
    setActiveKey(tab.key);
  },[]);
  const close = useCallback(async (key:string) => {
    if (!await guard()) return;
    setTabs(previous=>{
      const index=previous.findIndex(tab=>tab.key===key); const next=previous.filter(tab=>tab.key!==key);
      if(key===activeKey)setActiveKey((next[index]??next[index-1])?.key??null);
      return next;
    });
  },[activeKey]);
  const activate = useCallback(async (key:string|null) => {if(await guard())setActiveKey(key);},[]);
  const purgeMissing = useCallback((valid:Set<string>) => {
    setTabs(previous=>{const next=previous.filter(tab=>valid.has(tab.key)); if(next.length!==previous.length&&!next.some(tab=>tab.key===activeKey))setActiveKey(null);return next.length===previous.length?previous:next;});
  },[activeKey]);
  const remapPrefix = async (oldPath:string[],nextPath:string[],getHandle:(path:string[])=>Promise<FileSystemFileHandle>) => {
    const old=oldPath.join('/'); let nextActive=activeKey;
    const next=await Promise.all(tabs.map(async tab=>{
      if(!tab.key.startsWith('co:'))return tab;
      const path=tab.key.slice(3);
      if(path!==old&&!path.startsWith(old+'/'))return tab;
      const parts=[...nextPath,...path.slice(old.length).split('/').filter(Boolean)]; const key='co:'+parts.join('/');
      if(tab.key===activeKey)nextActive=key;
      return {...tab,key,label:parts.at(-1)!,breadcrumb:parts.slice(0,-1),handle:await getHandle(parts)};
    }));
    setTabs(next);setActiveKey(nextActive);
  };
  return {tabs,activeKey,activeTab:tabs.find(tab=>tab.key===activeKey)??null,openFile,close,activate,purgeMissing,remapPrefix};
}
