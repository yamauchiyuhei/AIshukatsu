import { useToday } from '../../hooks/useToday';
import { applyFilters } from '../lib/filtering';
import { useMemo } from 'react';
import { useSheet, getActiveSheet } from '../lib/store';
import { computeStats } from '../lib/stats';

export function StatsBar() {
  const sheet = useSheet((s) => getActiveSheet(s));
  const today = useToday();
  const query=useSheet(s=>s.searchQuery), industry=useSheet(s=>s.filterIndustry), status=useSheet(s=>s.filterStatus);
  const filters={query,industry,status,sortColumnId:null,sortDir:'asc' as const};
  const visible = applyFilters(sheet.rows,sheet.columns,filters);
  const stats = useMemo(() => computeStats(visible,sheet.columns), [sheet.rows,sheet.columns,today,filters.query,filters.industry,filters.status]);

  const interviewing =
    (stats.byStatus['1次面接'] ?? 0) +
    (stats.byStatus['2次面接'] ?? 0) +
    (stats.byStatus['最終面接'] ?? 0);
  const esSubmitted = stats.esSubmittedCount;
  const esRate = stats.total > 0 ? Math.round((esSubmitted / stats.total) * 100) : 0;
  const offerRate = stats.total > 0 ? ((stats.offerCount / stats.total) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-2 gap-3 border-b border-slate-200/60 bg-white/40 px-5 py-3 backdrop-blur md:grid-cols-3 xl:grid-cols-6">
      <Tile label="表示中のエントリー" value={stats.total} accent="text-slate-700" />
      <Tile
        label="ES提出済"
        value={`${esSubmitted}/${stats.total}`}
        accent="text-blue-700"
        progress={esRate}
        progressColor="bg-blue-500"
      />
      <Tile label="面接中" value={interviewing} accent="text-indigo-700" />
      <Tile
        label="🏆 内定"
        value={`${stats.offerCount} (${offerRate}%)`}
        accent="text-emerald-700"
      />
      <Tile label="期限超過" value={stats.overdueCount} accent={stats.overdueCount ? 'text-rose-700' : 'text-slate-500'} emphasized={stats.overdueCount > 0}/>
      <Tile
        label="今日〜7日先"
        value={stats.urgentCount}
        accent={stats.urgentCount > 0 ? 'text-rose-700' : 'text-slate-400'}
        emphasized={stats.urgentCount > 0}
      />
    </div>
  );
}

interface TileProps {
  label: string;
  value: number | string;
  accent: string;
  progress?: number;
  progressColor?: string;
  emphasized?: boolean;
}
function Tile({ label, value, accent, progress, progressColor, emphasized }: TileProps) {
  return (
    <div
      className={`min-w-0 rounded-xl border px-3 py-2 shadow-sm backdrop-blur-sm transition ${
        emphasized
          ? 'border-rose-200 bg-rose-50/70'
          : 'border-slate-200/70 bg-white/80'
      }`}
    >
      <div title={label}
      className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-0.5 whitespace-nowrap text-base font-semibold tabular-nums ${accent}`}>
        {value}
      </div>
      {progress !== undefined && (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200/70">
          <div
            className={`h-full rounded-full ${progressColor ?? 'bg-indigo-500'}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
