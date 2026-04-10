import { useMemo } from 'react';
import { useSheet, getActiveSheet } from '../lib/store';
import { computeStats } from '../lib/stats';

export function StatsBar() {
  const sheet = useSheet((s) => getActiveSheet(s));
  const stats = useMemo(() => computeStats(sheet.rows), [sheet.rows]);

  const interviewing =
    (stats.byStatus['1次面接'] ?? 0) +
    (stats.byStatus['2次面接'] ?? 0) +
    (stats.byStatus['最終面接'] ?? 0);
  const esSubmitted = stats.byStatus['ES提出済'] ?? 0;
  const esRate = stats.total > 0 ? Math.round((esSubmitted / stats.total) * 100) : 0;
  const offerRate = stats.total > 0 ? ((stats.offerCount / stats.total) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-2 gap-3 border-b border-slate-200/60 bg-white/40 px-5 py-3 backdrop-blur md:grid-cols-5">
      <Tile label="エントリー" value={stats.total} accent="text-slate-700" />
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
      <Tile
        label="⚠ 7日以内"
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
      <div className="truncate whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-0.5 truncate whitespace-nowrap text-lg font-semibold tabular-nums ${accent}`}>
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
