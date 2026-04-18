import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  Download,
  FileText,
  Kanban,
  CalendarDays,
  Shield,
  Sparkles,
  Monitor,
  Apple,
  Users,
  Building2,
  LayoutGrid,
  Table2,
  Newspaper,
} from 'lucide-react';
import { signInWithGoogle } from '../spreadsheet/lib/firebase';
import { Spotlight } from './ui/Spotlight';
import { Meteors } from './ui/Meteors';
import { Particles } from './ui/Particles';
import { ShimmerButton } from './ui/ShimmerButton';
import { AuroraText } from './ui/AuroraText';
import { NumberTicker } from './ui/NumberTicker';
import { MagicCard } from './ui/MagicCard';
import { BorderBeam } from './ui/BorderBeam';
import { BrowserFrame } from './ui/BrowserFrame';
import { TabbedShowcase, type ShowcaseTab } from './ui/TabbedShowcase';

const GITHUB_RELEASE =
  'https://github.com/yamauchiyuhei/AIshukatsu/releases/latest';
const DL_MACOS =
  `${GITHUB_RELEASE}/download/AIshukatsu_universal.app.tar.gz`;
const DL_WINDOWS = GITHUB_RELEASE;

interface Props {
  onSignIn: () => void;
}

// ---------------------------------------------------------------------------
// Main landing page.
//
// Rewritten around the Spotlight / Meteors / MagicCard / NumberTicker
// primitives (all MIT, adapted from Magic UI + Aceternity UI). Preserves the
// original scroll progress / nav solidify / google-sign-in behaviour.
// ---------------------------------------------------------------------------
export function LandingPage({ onSignIn }: Props) {
  const featuresRef = useRef<HTMLDivElement | null>(null);
  const downloadRef = useRef<HTMLDivElement | null>(null);
  const [navSolid, setNavSolid] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setNavSolid(y > 60);
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(total > 0 ? (y / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      onSignIn();
    } catch (e) {
      console.error('Sign-in failed', e);
    }
  };
  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) =>
    ref.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-950 text-slate-100 antialiased">
      {/* Scroll progress bar */}
      <div
        className="fixed left-0 top-0 z-[60] h-[3px] bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-rose-400 transition-[width] duration-150"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* ── Nav ── */}
      <nav
        className={`fixed inset-x-0 top-0 z-50 transition-all ${
          navSolid
            ? 'border-b border-white/10 bg-slate-950/80 backdrop-blur-md'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="AI就活" className="h-8 w-8 rounded-lg" />
            <span className="font-semibold tracking-wide">AI就活</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <button
              type="button"
              onClick={() => scrollTo(featuresRef)}
              className="hidden rounded-md px-3 py-1.5 text-sm text-slate-300 transition-colors hover:text-white sm:block"
            >
              機能
            </button>
            <button
              type="button"
              onClick={() => scrollTo(downloadRef)}
              className="hidden rounded-md px-3 py-1.5 text-sm text-slate-300 transition-colors hover:text-white sm:block"
            >
              ダウンロード
            </button>
            <ShimmerButton onClick={handleSignIn} className="px-4 py-2">
              Web版を使う <ArrowRight size={14} />
            </ShimmerButton>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-24">
        {/* Dotted grid */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:22px_22px] opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
        {/* Aurora blobs */}
        <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-indigo-500/30 blur-[120px]" />
        <div className="pointer-events-none absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/20 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-rose-500/20 blur-[120px]" />
        {/* Spotlight */}
        <Spotlight
          className="-top-40 left-0 md:-top-20 md:left-60"
          fill="white"
        />
        {/* Canvas particles */}
        <Particles quantity={80} color="#ffffff" ease={60} />

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 backdrop-blur-sm"
          >
            <Sparkles size={12} className="text-fuchsia-300" />
            就活効率化ツール
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mt-6 text-5xl font-bold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl"
          >
            <AuroraText>AI が就活を加速する。</AuroraText>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-6 max-w-2xl text-base text-slate-300 sm:text-lg"
          >
            企業研究・ES・面接・スケジュール。
            <br className="hidden sm:inline" />
            就活のすべてを、これ一つで。
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
          >
            <ShimmerButton onClick={handleSignIn} className="px-7 py-3">
              Web版を無料で使う <ArrowRight size={16} />
            </ShimmerButton>
            <button
              type="button"
              onClick={() => scrollTo(downloadRef)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              <Download size={16} />
              デスクトップ版をダウンロード
            </button>
          </motion.div>
          <motion.button
            type="button"
            onClick={() => scrollTo(featuresRef)}
            aria-label="下にスクロール"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.1 }}
            className="mt-20 animate-bounce rounded-full border border-white/10 p-2 text-slate-400 hover:text-white"
          >
            <ChevronDown size={20} />
          </motion.button>
        </div>
      </section>

      {/* ── Product Showcase: Spreadsheet views ── */}
      <section className="relative border-t border-white/5 py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.15),transparent_60%)]" />
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-12 max-w-2xl text-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 backdrop-blur-sm">
              <Sparkles size={12} className="text-fuchsia-300" />
              Product Showcase
            </div>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
              <AuroraText>3 つのビュー</AuroraText>で選考を可視化
            </h2>
            <p className="mt-3 text-slate-400">
              同じデータを、表・Kanban・カレンダーで瞬時に切替。
              <br className="hidden sm:inline" />
              全 {'22'} 社のエントリーを一元管理できます。
            </p>
          </motion.div>
          <TabbedShowcase
            tabs={SPREADSHEET_TABS}
            url="aisyuukatsu-30fdd.web.app/spreadsheet"
          />
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="relative border-t border-white/5 bg-slate-950 py-20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-6 md:grid-cols-3">
          <StatCard
            icon={<Building2 size={20} />}
            value={1734}
            suffix="+"
            label="企業テンプレート"
          />
          <StatCard
            icon={<LayoutGrid size={20} />}
            value={9}
            label="業界カテゴリ"
          />
          <StatCard
            icon={<Users size={20} />}
            value={3}
            label="ビュー (表・Kanban・カレンダー)"
          />
        </div>
      </section>

      {/* ── Features ── */}
      <section ref={featuresRef} className="relative py-24">
        <div className="mx-auto max-w-6xl px-6">
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="text-center text-3xl font-bold sm:text-4xl"
          >
            就活に必要な機能を、
            <AuroraText>すべてひとつに</AuroraText>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-4 max-w-2xl text-center text-slate-400"
          >
            AI就活 は就職活動に特化した統合プラットフォーム。
            <br className="hidden sm:inline" />
            複数のツールを行き来する必要はもうありません。
          </motion.p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Kanban size={22} />}
              title="就活スプレッドシート"
              description="表・Kanban・カレンダーの 3 ビューで選考状況を一覧管理。ES 締切・面接日程も一目瞭然。"
            />
            <FeatureCard
              icon={<FileText size={22} />}
              title="WYSIWYG エディタ"
              description="Markdown ベースのリッチエディタで企業分析・ES 下書き・面接メモを作成。色・装飾・見出しも自由自在。"
            />
            <FeatureCard
              icon={<Sparkles size={22} />}
              title="AI 企業分析"
              description="Gemini + Google 検索で企業情報を自動生成。オンボーディング時に選択した企業の資料が即座に揃います。"
            />
            <FeatureCard
              icon={<Shield size={22} />}
              title="ローカルファースト"
              description="データはあなたの PC に保存。クラウド同期は任意の暗号化バックアップとして使えます。"
            />
            <FeatureCard
              icon={<CalendarDays size={22} />}
              title="カレンダー & Kanban"
              description="ES 提出・面接・Web テストのスケジュールをカレンダーで俯瞰。Kanban でステータス管理も。"
            />
            <FeatureCard
              icon={<Monitor size={22} />}
              title="マルチフォーマット対応"
              description="Markdown だけでなく、PDF・画像・Word・Excel もアプリ内で閲覧。企業フォルダを丸ごと管理。"
            />
          </div>
        </div>
      </section>

      {/* ── Product Showcase: Research editor ── */}
      <section className="relative border-t border-white/5 py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(217,70,239,0.12),transparent_60%)]" />
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 backdrop-blur-sm">
                <Newspaper size={12} className="text-indigo-300" />
                企業研究 / 業界研究
              </div>
              <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                AI が生成する、
                <br />
                <AuroraText>深い企業・業界分析</AuroraText>
              </h2>
              <p className="mt-4 text-slate-400">
                Gemini + Google 検索で企業概要・沿革・市場規模まで自動生成。
                Markdown で保存されるので、お気に入りの AI にそのまま渡せます。
              </p>
              <ul className="mt-6 space-y-2 text-sm text-slate-300">
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400" />
                  <span>1,734 社のテンプレートから選んで即生成</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400" />
                  <span>9 業界カテゴリの業界研究メモもワンクリック</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400" />
                  <span>WYSIWYG で装飾・見出しも自由自在</span>
                </li>
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative"
            >
              <BrowserFrame url="企業分析.md" className="max-w-xl">
                <img
                  src="/screenshots/company.png"
                  alt="企業研究エディタ"
                  className="block h-auto w-full"
                  loading="lazy"
                />
              </BrowserFrame>
              {/* Floating secondary preview */}
              <motion.div
                initial={{ opacity: 0, y: 20, rotate: -3 }}
                whileInView={{ opacity: 1, y: 0, rotate: -4 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.7, delay: 0.35 }}
                className="absolute -bottom-10 -left-6 hidden w-60 sm:block lg:w-72"
              >
                <BrowserFrame url="業界研究.md" glow={false}>
                  <img
                    src="/screenshots/industry.png"
                    alt="業界研究エディタ"
                    className="block h-auto w-full"
                    loading="lazy"
                  />
                </BrowserFrame>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Download ── */}
      <section ref={downloadRef} className="relative py-24">
        <div className="mx-auto max-w-6xl px-6">
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center text-3xl font-bold sm:text-4xl"
          >
            デスクトップでも、<AuroraText>ブラウザでも</AuroraText>
          </motion.h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
            Web 版はアカウント登録だけで即座に使えます。
            <br className="hidden sm:inline" />
            デスクトップ版はネイティブアプリとして快適に動作します。
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <DownloadCard
              icon={<Apple size={26} />}
              title="macOS"
              desc="Apple Silicon / Intel 両対応 / Universal Binary"
              cta={
                <a
                  href={DL_MACOS}
                  className="relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/10"
                >
                  <Download size={16} />
                  ダウンロード (.app)
                  <BorderBeam size={120} duration={7} />
                </a>
              }
            />
            <DownloadCard
              icon={<Monitor size={26} />}
              title="Windows"
              desc="Windows 10 / 11 / x64・ARM64 対応"
              cta={
                <a
                  href={DL_WINDOWS}
                  className="relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/10"
                >
                  <Download size={16} />
                  ダウンロード (.exe)
                  <BorderBeam size={120} duration={7} delay={2} />
                </a>
              }
            />
            <DownloadCard
              icon={<Sparkles size={26} />}
              title="Web版"
              desc="インストール不要 / Google アカウントで即開始"
              highlight
              cta={
                <ShimmerButton onClick={handleSignIn} className="px-5 py-2.5">
                  無料で始める <ArrowRight size={16} />
                </ShimmerButton>
              }
            />
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden py-24">
        <div className="pointer-events-none absolute inset-0">
          <Meteors number={24} />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/30 to-transparent" />
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
          <h2 className="text-3xl font-bold sm:text-5xl">
            今すぐ、<AuroraText>就活をアップグレード</AuroraText>しよう
          </h2>
          <p className="mt-4 text-slate-400">
            30 秒で始められます。クレジットカード不要。
          </p>
          <div className="mt-10">
            <ShimmerButton onClick={handleSignIn} className="px-8 py-4 text-base">
              Web版を無料で使う <ArrowRight size={18} />
            </ShimmerButton>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="AI就活" className="h-6 w-6 rounded" />
            <span className="text-sm text-slate-300">AI就活</span>
          </div>
          <a
            href="https://github.com/yamauchiyuhei/AIshukatsu"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-400 hover:text-white"
          >
            GitHub
          </a>
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} AI就活. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

const SPREADSHEET_TABS: ShowcaseTab[] = [
  {
    id: 'table',
    label: '表',
    icon: <Table2 size={14} />,
    src: '/screenshots/table.png',
    alt: '就活スプレッドシート 表ビュー',
    caption:
      '全選考を一覧で俯瞰。並び替え・フィルタ・お気に入り・ステータス管理まで。',
  },
  {
    id: 'kanban',
    label: 'Kanban',
    icon: <Kanban size={14} />,
    src: '/screenshots/kanban.png',
    alt: '就活スプレッドシート Kanbanビュー',
    caption:
      '未応募 → エントリー済 → ES 提出 → 面接 → 内定。進捗を視覚的に管理。',
  },
  {
    id: 'calendar',
    label: 'カレンダー',
    icon: <CalendarDays size={14} />,
    src: '/screenshots/calendar.png',
    alt: '就活スプレッドシート カレンダービュー',
    caption:
      'ES 締切・面接日・Web テストを月次で俯瞰。見落としゼロ。',
  },
];

function StatCard({
  icon,
  value,
  suffix = '',
  label,
}: {
  icon: React.ReactNode;
  value: number;
  suffix?: string;
  label: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-3 text-4xl font-bold tracking-tight text-white">
        <NumberTicker value={value} />
        {suffix}
      </div>
      <BorderBeam size={140} duration={10} />
    </motion.div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <MagicCard
      className="border-white/10 bg-white/[0.03] text-slate-100 backdrop-blur-sm"
      gradientColor="rgba(129,140,248,0.22)"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/30 text-indigo-200">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
    </MagicCard>
  );
}

function DownloadCard({
  icon,
  title,
  desc,
  cta,
  highlight = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
      className={`relative overflow-hidden rounded-2xl border p-8 backdrop-blur-sm ${
        highlight
          ? 'border-fuchsia-500/30 bg-gradient-to-br from-indigo-500/10 via-fuchsia-500/5 to-rose-500/10'
          : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-white">
        {icon}
      </div>
      <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{desc}</p>
      <div className="mt-6 flex">{cta}</div>
      {highlight && <BorderBeam size={220} duration={8} />}
    </motion.div>
  );
}
