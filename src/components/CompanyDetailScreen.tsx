import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { Company, STATUS_FILE } from '../types';
import { listMarkdownFiles } from '../lib/fs';
import { readMarkdownBody, writeMarkdownBody } from '../lib/companies';
import { MarkdownEditor } from './MarkdownEditor';
import { useAutoSave } from '../hooks/useAutoSave';

interface Props {
  company: Company;
  onBack: () => void;
}

export function CompanyDetailScreen({ company, onBack }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [body, setBody] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const refreshFiles = useCallback(async () => {
    const list = await listMarkdownFiles(company.handle);
    setFiles(list);
    if (list.length > 0) {
      // 選考状況.md を優先
      const preferred = list.includes(STATUS_FILE) ? STATUS_FILE : list[0];
      setActiveFile((curr) => curr ?? preferred);
    }
  }, [company]);

  useEffect(() => {
    setActiveFile(null);
    setFiles([]);
    setBody('');
    refreshFiles();
  }, [company, refreshFiles]);

  const { state, schedule, flush, reset } = useAutoSave({
    onSave: async (value) => {
      if (!activeFile) return;
      await writeMarkdownBody(company.handle, activeFile, value);
    },
  });

  // ファイル切替時: 旧ファイルの未保存をflush → 新ファイル読込
  useEffect(() => {
    if (!activeFile) return;
    let cancelled = false;
    (async () => {
      await flush();
      reset();
      setLoading(true);
      try {
        const { body: b } = await readMarkdownBody(company.handle, activeFile);
        if (!cancelled) setBody(b);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile, company]);

  const saveLabel: Record<typeof state, string> = {
    idle: '',
    dirty: '未保存',
    saving: '保存中…',
    saved: '保存済み',
    error: '保存エラー',
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                await flush();
                onBack();
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm hover:bg-slate-50"
            >
              <ArrowLeft size={14} />
              一覧
            </button>
            <h1 className="text-lg font-semibold text-slate-900">
              {company.frontmatter.company_name}
            </h1>
          </div>
          <span className="text-xs text-slate-500">{saveLabel[state]}</span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-6 py-6">
        <aside className="w-60 shrink-0">
          <h2 className="mb-2 text-xs font-semibold uppercase text-slate-500">ファイル</h2>
          <ul className="space-y-1">
            {files.map((f) => (
              <li key={f}>
                <button
                  onClick={() => setActiveFile(f)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                    activeFile === f
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <FileText size={14} />
                  <span className="truncate">{f}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {loading || !activeFile ? (
              <p className="text-sm text-slate-500">読み込み中…</p>
            ) : (
              <MarkdownEditor
                resetKey={`${company.folderName}/${activeFile}`}
                initialValue={body}
                onChange={schedule}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
