import { motion } from 'framer-motion';
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { Particles } from './ui/Particles';
import { Meteors } from './ui/Meteors';
import { NumberTicker } from './ui/NumberTicker';
import { BorderBeam } from './ui/BorderBeam';
import { MagicCard } from './ui/MagicCard';
import { AuroraText } from './ui/AuroraText';

/**
 * Standalone demo dashboard — showcases Tremor-style KPI cards, funnel bars,
 * and a sparkline built from the new effect primitives. All numbers are
 * sample data; the intent is to demonstrate how the real spreadsheet
 * pipeline could render once wired up.
 */
export function Dashboard() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Backdrop */}
      <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-indigo-500/25 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-40 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/15 blur-[140px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:22px_22px] opacity-20 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_80%)]" />
      <Particles quantity={40} color="#ffffff" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-12">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 flex items-end justify-between gap-4 flex-wrap"
        >
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 backdrop-blur-sm">
              <Sparkles size={12} className="text-fuchsia-300" />
              Application Dashboard
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight">
              <AuroraText>就活状況サマリ</AuroraText>
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              2026 年春卒業向け・サンプルデータ
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar size={14} />
            {new Date().toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </div>
        </motion.header>

        {/* KPI cards */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi
            icon={<Briefcase size={18} />}
            label="エントリー企業"
            value={32}
            trend="+4 今週"
            gradient="from-indigo-500/20 to-blue-500/10"
          />
          <Kpi
            icon={<Clock size={18} />}
            label="選考進行中"
            value={17}
            trend="+2 今週"
            gradient="from-fuchsia-500/20 to-purple-500/10"
          />
          <Kpi
            icon={<CheckCircle2 size={18} />}
            label="内定"
            value={3}
            trend="新規 1"
            gradient="from-emerald-500/20 to-teal-500/10"
            highlight
          />
          <Kpi
            icon={<XCircle size={18} />}
            label="お祈りメール"
            value={7}
            trend="-"
            gradient="from-rose-500/20 to-red-500/10"
          />
        </section>

        {/* Funnel + Sparkline */}
        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Funnel */}
          <MagicCard
            className="col-span-2 border-white/10 bg-white/[0.03] p-6 text-slate-100 backdrop-blur-sm"
            gradientColor="rgba(168,85,247,0.22)"
          >
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <TrendingUp size={16} className="text-fuchsia-300" />
              選考フェーズ別ファネル
            </div>
            <div className="mt-6 space-y-3">
              <FunnelRow label="エントリー" count={32} max={32} tone="indigo" />
              <FunnelRow label="ES 提出" count={28} max={32} tone="violet" />
              <FunnelRow label="Web テスト" count={21} max={32} tone="fuchsia" />
              <FunnelRow label="一次面接" count={14} max={32} tone="pink" />
              <FunnelRow label="最終面接" count={6} max={32} tone="rose" />
              <FunnelRow label="内定" count={3} max={32} tone="emerald" />
            </div>
          </MagicCard>

          {/* Upcoming */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Calendar size={16} className="text-indigo-300" />
              今週の予定
            </div>
            <ul className="mt-5 space-y-3 text-sm">
              <ScheduleItem
                date="04/16"
                label="株式会社サンプル 一次面接"
                hot
              />
              <ScheduleItem date="04/17" label="テックカンパニー ES 締切" />
              <ScheduleItem date="04/18" label="金融A社 Web テスト" />
              <ScheduleItem date="04/20" label="業界研究メモ 更新" />
            </ul>
            <BorderBeam size={180} duration={8} />
          </motion.div>
        </section>

        {/* Activity */}
        <section className="relative mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm">
          <Meteors number={14} />
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Users size={16} className="text-fuchsia-300" />
            今月のアクティビティ
          </div>
          <div className="mt-4 grid grid-cols-2 gap-6 md:grid-cols-4">
            <ActivityStat label="ES 作成" value={24} suffix=" 件" />
            <ActivityStat label="面接実施" value={11} suffix=" 回" />
            <ActivityStat label="企業分析生成" value={47} suffix=" 社" />
            <ActivityStat label="学習時間" value={28} suffix=" 時間" />
          </div>
        </section>

        <footer className="mt-12 text-center text-xs text-slate-500">
          ハッシュを外すと通常アプリに戻ります · URL: <code>#dashboard</code>
        </footer>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  trend,
  gradient,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend: string;
  gradient: string;
  highlight?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5 }}
      className={`relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br ${gradient} p-5 backdrop-blur-sm`}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-4xl font-bold tabular-nums text-white">
        <NumberTicker value={value} />
      </div>
      <div className="mt-1 text-xs text-slate-400">{trend}</div>
      {highlight && <BorderBeam size={160} duration={7} />}
    </motion.div>
  );
}

const TONE_CLASSES: Record<string, string> = {
  indigo: 'from-indigo-500 to-indigo-400',
  violet: 'from-violet-500 to-violet-400',
  fuchsia: 'from-fuchsia-500 to-fuchsia-400',
  pink: 'from-pink-500 to-pink-400',
  rose: 'from-rose-500 to-rose-400',
  emerald: 'from-emerald-500 to-emerald-400',
};

function FunnelRow({
  label,
  count,
  max,
  tone,
}: {
  label: string;
  count: number;
  max: number;
  tone: string;
}) {
  const pct = Math.max(6, Math.round((count / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span className="tabular-nums text-slate-400">{count} 社</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full rounded-full bg-gradient-to-r ${
            TONE_CLASSES[tone] ?? 'from-indigo-500 to-indigo-400'
          }`}
        />
      </div>
    </div>
  );
}

function ScheduleItem({
  date,
  label,
  hot = false,
}: {
  date: string;
  label: string;
  hot?: boolean;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`shrink-0 rounded-md border px-2 py-1 text-xs tabular-nums ${
          hot
            ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
            : 'border-white/10 bg-white/5 text-slate-300'
        }`}
      >
        {date}
      </span>
      <span className="truncate text-slate-300">{label}</span>
      {hot && (
        <span className="ml-auto inline-flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
          HOT
        </span>
      )}
    </li>
  );
}

function ActivityStat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-white">
        <NumberTicker value={value} />
        <span className="text-base font-medium text-slate-400">{suffix}</span>
      </div>
    </div>
  );
}
