import { useCallback, useState } from 'react';

export interface OpenTab {
  key: string;          // unique path-like id
  label: string;        // display name shown in tab
  breadcrumb: string[]; // breadcrumb context (kept for tooltip / future use)
  handle: FileSystemFileHandle;
}

export function useOpenTabs() {
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const openFile = useCallback((tab: OpenTab) => {
    setTabs((prev) => {
      const exists = prev.find((t) => t.key === tab.key);
      if (exists) return prev;
      return [...prev, tab];
    });
    setActiveKey(tab.key);
  }, []);

  const close = useCallback(
    (key: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.key === key);
        if (idx === -1) return prev;
        const next = prev.filter((t) => t.key !== key);
        if (key === activeKey) {
          const fallback = next[idx] ?? next[idx - 1] ?? next[0] ?? null;
          setActiveKey(fallback?.key ?? null);
        }
        return next;
      });
    },
    [activeKey],
  );

  const activate = useCallback((key: string) => {
    setActiveKey(key);
  }, []);

  const purgeMissing = useCallback(
    (validKeys: Set<string>) => {
      setTabs((prev) => {
        const next = prev.filter((t) => validKeys.has(t.key));
        if (next.length !== prev.length) {
          if (!next.some((t) => t.key === activeKey)) {
            setActiveKey(next[0]?.key ?? null);
          }
        }
        return next;
      });
    },
    [activeKey],
  );

  const activeTab = tabs.find((t) => t.key === activeKey) ?? null;

  return {
    tabs,
    activeKey,
    activeTab,
    openFile,
    close,
    activate,
    purgeMissing,
  };
}
