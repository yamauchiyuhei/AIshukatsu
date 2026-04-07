import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CalendarDays,
  CircleDot,
  Grid3x3,
  LayoutGrid,
  List,
  Plus,
  Tag,
  Target,
} from 'lucide-react';
import {
  Company,
  STATUS_FILE,
  STATUS_VALUES,
  Status,
  Workspace,
} from '../types';
import {
  Task,
  filterThisWeek,
  loadAllTasks,
  sortByDate,
  updateCompanyStatus,
  updateDeadline,
} from '../lib/dashboard';
import { DateCell, MatrixCell, StateCell, StatusCell } from './EditableCells';
import {
  CANONICAL_ORDER,
  normalizeItem,
  sortCanonicalFirst,
} from '../lib/itemNormalizer';

type DashboardTab = 'matrix' | 'all' | 'kanban' | 'thisWeek';
type MatrixMode = 'simple' | 'full';

// Minimum companies a (canonical) item must appear in for "simple" mode.
const MIN_COMPANIES_FOR_SIMPLE = 3;

function isTaskRelevant(t: Task): boolean {
  if (t.date) return true;
  if (t.state && !['未', '', '—'].includes(t.state)) return true;
  return false;
}

interface Props {
  workspace: Workspace;
  onOpenFile: (entry: {
    key: string;
    label: string;
    breadcrumb: string[];
    handle: FileSystemFileHandle;
  }) => void;
  onAddCompany: () => void;
  onRefresh: () => void;
}

export function DashboardView({
  workspace,
  onOpenFile,
  onAddCompany,
  onRefresh,
}: Props) {
  const [tab, setTab] = useState<DashboardTab>('matrix');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [matrixMode, setMatrixMode] = useState<MatrixMode>('simple');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingTasks(true);
    loadAllTasks(workspace)
      .then((t) => {
        if (!cancelled) setTasks(t);
      })
      .catch((e) => console.error(e))
      .finally(() => {
        if (!cancelled) setLoadingTasks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  const allCompanies = useMemo(() => {
    const out: Company[] = [];
    for (const cat of workspace.categories) {
      out.push(...cat.companies);
    }
    return out;
  }, [workspace]);

  const relevantTasks = useMemo(() => tasks.filter(isTaskRelevant), [tasks]);
  const displayTasks = showAll ? tasks : relevantTasks;

  const handleStatusChange = async (company: Company, next: Status) => {
    try {
      await updateCompanyStatus(company, next);
      await onRefresh();
    } catch (e) {
      console.error(e);
      alert('ステータス更新に失敗しました');
    }
  };

  const handleDeadlineUpdate = async (
    company: Company,
    item: string,
    patch: { date?: string | null; state?: string },
  ) => {
    try {
      await updateDeadline(company, item, patch);
      await onRefresh();
    } catch (e) {
      console.error(e);
      alert(
        e instanceof Error ? e.message : '締切の更新に失敗しました',
      );
    }
  };

  const handleOpenStatusFile = (company: Company) => {
    const file = company.files.find((f) => f.name === STATUS_FILE);
    if (!file) return;
    onOpenFile({
      key: `co:${company.category}/${company.name}/${file.name}`,
      label: file.name,
      breadcrumb: [company.category, company.name],
      handle: file.handle,
    });
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="border-b border-slate-200 bg-white px-8 pt-6 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">就活管理</h2>
            <p className="mt-1 text-xs text-slate-500">
              {workspace.categories.length} カテゴリ / {allCompanies.length} 社 /{' '}
              {relevantTasks.length} 件のアクティブ締切
              {tasks.length > relevantTasks.length && (
                <span className="text-slate-400">
                  {' '}
                  (空欄含 {tasks.length} 件)
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onAddCompany}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
          >
            <Plus size={14} />
            企業を追加
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-0">
            <ViewTab
              active={tab === 'matrix'}
              icon={<Grid3x3 size={13} />}
              label="マトリクス"
              onClick={() => setTab('matrix')}
            />
            <ViewTab
              active={tab === 'all'}
              icon={<List size={13} />}
              label="リスト"
              onClick={() => setTab('all')}
            />
            <ViewTab
              active={tab === 'kanban'}
              icon={<LayoutGrid size={13} />}
              label="ステータス別"
              onClick={() => setTab('kanban')}
            />
            <ViewTab
              active={tab === 'thisWeek'}
              icon={<CalendarDays size={13} />}
              label="今週の締切"
              onClick={() => setTab('thisWeek')}
            />
          </div>
          <div className="flex items-center gap-3 pb-2">
            {tab === 'matrix' && (
              <>
                <div className="flex items-center overflow-hidden rounded border border-slate-200 text-xs">
                  <button
                    onClick={() => setMatrixMode('simple')}
                    className={`px-2 py-1 ${
                      matrixMode === 'simple'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    title="標準8項目だけ表示"
                  >
                    シンプル
                  </button>
                  <button
                    onClick={() => setMatrixMode('full')}
                    className={`border-l border-slate-200 px-2 py-1 ${
                      matrixMode === 'full'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    title="独自項目も含めて全表示"
                  >
                    全項目
                  </button>
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                >
                  <option value="">全カテゴリ</option>
                  {workspace.categories.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {tab === 'all' && (
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(e) => setShowAll(e.target.checked)}
                  className="h-3 w-3"
                />
                空欄も表示
              </label>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-8 py-4">
        {loadingTasks && tasks.length === 0 ? (
          <p className="text-sm text-slate-500">読み込み中…</p>
        ) : tab === 'matrix' ? (
          <MatrixTable
            companies={
              categoryFilter
                ? allCompanies.filter((c) => c.category === categoryFilter)
                : allCompanies
            }
            tasks={tasks}
            mode={matrixMode}
            onOpenCompany={handleOpenStatusFile}
            onChangeDeadline={handleDeadlineUpdate}
          />
        ) : tab === 'all' ? (
          <TaskTable
            tasks={sortByDate(displayTasks)}
            onOpenCompany={handleOpenStatusFile}
            onChangeDeadline={handleDeadlineUpdate}
            onChangeStatus={handleStatusChange}
            emptyMessage={
              showAll
                ? '締切がまだ登録されていません'
                : '日付や状態が入力された締切はまだありません。「空欄も表示」で全件確認できます。'
            }
          />
        ) : tab === 'thisWeek' ? (
          <TaskTable
            tasks={sortByDate(filterThisWeek(tasks))}
            onOpenCompany={handleOpenStatusFile}
            onChangeDeadline={handleDeadlineUpdate}
            onChangeStatus={handleStatusChange}
            emptyMessage="今週(7日以内)の締切はありません"
          />
        ) : (
          <StatusKanban
            companies={allCompanies}
            onSelectCompany={handleOpenStatusFile}
            onChangeStatus={handleStatusChange}
          />
        )}
      </div>
    </div>
  );
}

function ViewTab({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 pb-2 pt-1 text-sm transition ${
        active
          ? 'font-semibold text-slate-900'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {icon}
      {label}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-slate-900" />
      )}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// TaskTable — Notion-style dense editable grid
// ────────────────────────────────────────────────────────────────────────────

type SortKey = 'date' | 'company' | 'item';
type SortDir = 'asc' | 'desc';

function TaskTable({
  tasks,
  onOpenCompany,
  onChangeDeadline,
  onChangeStatus,
  emptyMessage,
}: {
  tasks: Task[];
  onOpenCompany: (c: Company) => void;
  onChangeDeadline: (
    c: Company,
    item: string,
    patch: { date?: string | null; state?: string },
  ) => void | Promise<void>;
  onChangeStatus: (c: Company, s: Status) => void | Promise<void>;
  emptyMessage: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    const arr = [...tasks];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') {
        const da = a.date ? Date.parse(a.date) : Infinity;
        const db = b.date ? Date.parse(b.date) : Infinity;
        cmp = (isNaN(da) ? Infinity : da) - (isNaN(db) ? Infinity : db);
      } else if (sortKey === 'company') {
        cmp = a.company.name.localeCompare(b.company.name, 'ja');
      } else if (sortKey === 'item') {
        cmp = a.item.localeCompare(b.item, 'ja');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [tasks, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  // Group adjacent rows by company for visual grouping
  const rows = sorted.map((t, i) => {
    const prev = sorted[i - 1];
    const sameCompanyAsPrev =
      prev &&
      prev.company.category === t.company.category &&
      prev.company.name === t.company.name &&
      sortKey === 'company'; // Only group when sorted by company
    return { task: t, sameCompanyAsPrev: !!sameCompanyAsPrev };
  });

  return (
    <div className="overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-white">
            <ColHeader
              icon={<Building2 size={12} />}
              label="企業"
              sortable
              sortDir={sortKey === 'company' ? sortDir : null}
              onClick={() => toggleSort('company')}
              className="w-[26%]"
            />
            <ColHeader
              icon={<Tag size={12} />}
              label="項目"
              sortable
              sortDir={sortKey === 'item' ? sortDir : null}
              onClick={() => toggleSort('item')}
              className="w-[18%]"
            />
            <ColHeader
              icon={<CalendarDays size={12} />}
              label="期日"
              sortable
              sortDir={sortKey === 'date' ? sortDir : null}
              onClick={() => toggleSort('date')}
              className="w-[18%]"
            />
            <ColHeader
              icon={<CircleDot size={12} />}
              label="状態"
              className="w-[12%]"
            />
            <ColHeader
              icon={<Target size={12} />}
              label="選考状況"
              className="w-[26%]"
            />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ task: t, sameCompanyAsPrev }, i) => (
            <tr key={`${t.company.category}/${t.company.name}/${t.item}/${i}`}>
              <td
                className={`border-b border-slate-100 px-3 py-1 ${
                  sameCompanyAsPrev ? '' : 'pt-1.5'
                }`}
              >
                {sameCompanyAsPrev ? (
                  <span className="pl-3 text-slate-300">↳</span>
                ) : (
                  <button
                    onClick={() => onOpenCompany(t.company)}
                    className="group flex items-baseline gap-2 rounded px-1 text-left hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900 group-hover:underline">
                      {t.company.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {t.company.category}
                    </span>
                  </button>
                )}
              </td>
              <td className="border-b border-slate-100 px-3 py-1 text-slate-700">
                {t.item}
              </td>
              <td className="border-b border-slate-100 px-1 py-1">
                <DateCell
                  value={t.date}
                  onChange={(v) =>
                    onChangeDeadline(t.company, t.item, { date: v })
                  }
                />
              </td>
              <td className="border-b border-slate-100 px-1 py-1">
                <StateCell
                  value={t.state || '未'}
                  onChange={(v) =>
                    onChangeDeadline(t.company, t.item, { state: v })
                  }
                />
              </td>
              <td className="border-b border-slate-100 px-1 py-1">
                <StatusCell
                  value={t.company.status}
                  onChange={(s) => onChangeStatus(t.company, s)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ColHeader({
  icon,
  label,
  sortable,
  sortDir,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  sortable?: boolean;
  sortDir?: SortDir | null;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <th
      className={`border-b border-slate-200 bg-white px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500 ${className ?? ''}`}
    >
      <button
        onClick={onClick}
        disabled={!sortable}
        className={`inline-flex items-center gap-1 ${sortable ? 'hover:text-slate-900' : 'cursor-default'}`}
      >
        <span className="text-slate-400">{icon}</span>
        {label}
        {sortDir === 'asc' && <ArrowUp size={10} />}
        {sortDir === 'desc' && <ArrowDown size={10} />}
      </button>
    </th>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MatrixTable — rows = companies, columns = items
// ────────────────────────────────────────────────────────────────────────────

function MatrixTable({
  companies,
  tasks,
  mode,
  onOpenCompany,
  onChangeDeadline,
}: {
  companies: Company[];
  tasks: Task[];
  mode: MatrixMode;
  onOpenCompany: (c: Company) => void;
  onChangeDeadline: (
    c: Company,
    item: string,
    patch: { date?: string | null; state?: string },
  ) => void | Promise<void>;
}) {
  // Build the column set & lookup table.
  // - Each task is normalized to a canonical item name.
  // - lookup[companyKey][canonical] = the original Task (to preserve raw item name on write-back).
  // - canonicalCounts: how many distinct companies use each canonical item.
  const { columns, lookup, columnCounts } = useMemo(() => {
    const counts = new Map<string, Set<string>>(); // canonical → companyKeys
    const lk = new Map<string, Map<string, Task>>(); // companyKey → canonical → Task

    for (const t of tasks) {
      const canonical = normalizeItem(t.item);
      const cKey = `${t.company.category}/${t.company.name}`;

      // Count
      let set = counts.get(canonical);
      if (!set) {
        set = new Set();
        counts.set(canonical, set);
      }
      set.add(cKey);

      // Lookup (first task wins for duplicate canonicals on the same company)
      let inner = lk.get(cKey);
      if (!inner) {
        inner = new Map();
        lk.set(cKey, inner);
      }
      if (!inner.has(canonical)) {
        inner.set(canonical, t);
      }
    }

    const allCanonicals = Array.from(counts.keys());

    let cols: string[];
    if (mode === 'simple') {
      // Only canonical (CANONICAL_ORDER) items appearing in ≥ MIN_COMPANIES_FOR_SIMPLE
      cols = CANONICAL_ORDER.filter((c) => {
        const set = counts.get(c);
        return set && set.size >= MIN_COMPANIES_FOR_SIMPLE;
      });
    } else {
      // Full mode: every canonical found, sorted (canonical first, unknowns alphabetical)
      cols = sortCanonicalFirst(allCanonicals);
    }

    const colCounts = new Map<string, number>();
    for (const c of cols) colCounts.set(c, counts.get(c)?.size ?? 0);

    return { columns: cols, lookup: lk, columnCounts: colCounts };
  }, [tasks, mode]);

  if (companies.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
        表示する企業がありません
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500">
        締切項目がまだありません
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-lg border border-slate-200">
      <table className="border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-20">
          <tr>
            <th className="sticky left-0 z-30 w-[220px] min-w-[220px] border-b border-r border-slate-200 bg-white px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Building2 size={12} className="text-slate-400" />
                企業
              </span>
            </th>
            {columns.map((col) => {
              const count = columnCounts.get(col) ?? 0;
              return (
                <th
                  key={col}
                  title={`${col} (${count}社)`}
                  className="w-[92px] min-w-[92px] border-b border-r border-slate-200 bg-white px-2 py-2 text-center text-[11px] font-medium text-slate-600 last:border-r-0"
                >
                  <div className="truncate">{col}</div>
                  <div className="text-[9px] font-normal text-slate-400">
                    {count}社
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => {
            const inner = lookup.get(`${c.category}/${c.name}`);
            return (
              <tr key={`${c.category}/${c.name}`} className="group">
                <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-1 group-hover:bg-slate-50">
                  <button
                    onClick={() => onOpenCompany(c)}
                    className="block w-full text-left"
                  >
                    <div className="truncate text-[13px] font-medium text-slate-900 hover:underline">
                      {c.name}
                    </div>
                    <div className="truncate text-[10px] text-slate-400">
                      {c.category}
                    </div>
                  </button>
                </td>
                {columns.map((col) => {
                  const t = inner?.get(col);
                  if (!t) {
                    return (
                      <td
                        key={col}
                        className="h-10 border-b border-r border-slate-100 p-0 last:border-r-0 group-hover:bg-slate-50/50"
                      >
                        <button
                          type="button"
                          onClick={() => onOpenCompany(c)}
                          title="この企業の md を開く"
                          className="flex h-full w-full items-center justify-center text-slate-200 hover:bg-slate-50 hover:text-slate-400"
                        >
                          ·
                        </button>
                      </td>
                    );
                  }
                  return (
                    <td
                      key={col}
                      className="h-10 border-b border-r border-slate-100 p-0 last:border-r-0 group-hover:bg-slate-50/50"
                    >
                      <MatrixCell
                        date={t.date}
                        state={t.state || '未'}
                        onChange={(patch) =>
                          // Write back to the original raw item name in the md
                          onChangeDeadline(c, t.item, patch)
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// StatusKanban
// ────────────────────────────────────────────────────────────────────────────

function StatusKanban({
  companies,
  onSelectCompany,
  onChangeStatus,
}: {
  companies: Company[];
  onSelectCompany: (c: Company) => void;
  onChangeStatus: (c: Company, s: Status) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<Status | '未分類', Company[]>();
    for (const s of STATUS_VALUES) map.set(s, []);
    map.set('未分類', []);
    for (const c of companies) {
      const key = c.status ?? '未分類';
      map.get(key)?.push(c);
    }
    return map;
  }, [companies]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STATUS_VALUES.map((status) => {
        const list = grouped.get(status) ?? [];
        return (
          <div
            key={status}
            className="flex w-64 shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-50/40"
          >
            <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <span className="text-xs font-semibold text-slate-700">{status}</span>
              <span className="text-xs text-slate-400">{list.length}</span>
            </header>
            <div className="flex flex-1 flex-col gap-1.5 p-2">
              {list.length === 0 ? (
                <p className="px-2 py-3 text-center text-[11px] text-slate-300">
                  なし
                </p>
              ) : (
                list.map((c) => (
                  <CompanyCard
                    key={`${c.category}/${c.name}`}
                    company={c}
                    onOpen={() => onSelectCompany(c)}
                    onChangeStatus={(next) => onChangeStatus(c, next)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompanyCard({
  company,
  onOpen,
  onChangeStatus,
}: {
  company: Company;
  onOpen: () => void;
  onChangeStatus: (s: Status) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="group relative rounded-md border border-slate-200 bg-white px-3 py-2 hover:border-slate-300 hover:shadow-sm">
      <button
        onClick={onOpen}
        className="block w-full text-left text-sm font-medium text-slate-800 hover:text-slate-900"
      >
        {company.name}
      </button>
      <p className="mt-0.5 text-[10px] text-slate-400">{company.category}</p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        className="absolute right-2 top-2 rounded p-0.5 text-slate-400 opacity-0 hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
        title="ステータス変更"
      >
        ⋯
      </button>
      {menuOpen && (
        <div
          className="absolute right-2 top-7 z-20 w-36 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg"
          onMouseLeave={() => setMenuOpen(false)}
        >
          {STATUS_VALUES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setMenuOpen(false);
                onChangeStatus(s);
              }}
              className={`block w-full px-3 py-1.5 text-left hover:bg-slate-100 ${
                s === company.status ? 'font-semibold text-slate-900' : 'text-slate-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
