import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LegalModal } from './onboarding/LegalModal';
import { TERMS_OF_SERVICE, PRIVACY_POLICY } from '../data/legal';
import { LandingMagazine } from '../magazine/LandingMagazine';
import { readWebsiteTheme, saveWebsiteTheme } from '../lib/websiteTheme';

const CONTACT_EMAIL = 'yamatomo.inc@gmail.com';
const CONTACT_RATE_LIMIT_MS = 60_000;
const CONTACT_RATE_LIMIT_KEY = 'aishukatsu-contact-last-submit';

// ───────────────────────── constants ─────────────────────────
const GITHUB_RELEASE =
  'https://github.com/yamauchiyuhei/AIshukatsu/releases/latest';
const DL_MACOS = `${GITHUB_RELEASE}/download/AIshukatsu_universal.app.tar.gz`;

// ───────────────────────── theme tokens ─────────────────────────
type ThemeKey = 'dark' | 'light';

interface ThemeTokens {
  bg: string;
  bg2: string;
  text: string;
  textMuted: string;
  textDim: string;
  border: string;
  card: string;
  cardHover: string;
  glass: string;
  btn: string;
  btnGhost: string;
  chip: string;
  grid: string;
  aurora: string;
  heading: string;
}

const themes: Record<ThemeKey, ThemeTokens> = {
  dark: {
    bg: 'bg-[#05060a]',
    bg2: 'bg-[#0a0b12]',
    text: 'text-white',
    textMuted: 'text-white/60',
    textDim: 'text-white/65',
    border: 'border-white/10',
    card: 'bg-white/[0.03]',
    cardHover: 'hover:bg-white/[0.06]',
    glass: 'bg-white/[0.04] backdrop-blur-xl border border-white/10',
    btn: 'bg-white text-black hover:bg-white/90',
    btnGhost: 'border border-white/15 text-white hover:bg-white/5',
    chip: 'bg-white/5 border border-white/10 text-white/70',
    grid: 'landing-grid-bg',
    aurora: 'landing-aurora',
    heading: 'landing-text-gradient',
  },
  light: {
    bg: 'bg-[#fafafa]',
    bg2: 'bg-white',
    text: 'text-slate-900',
    textMuted: 'text-slate-600',
    textDim: 'text-slate-600',
    border: 'border-slate-200',
    card: 'bg-white',
    cardHover: 'hover:bg-slate-50',
    glass: 'bg-white/70 backdrop-blur-xl border border-slate-200',
    btn: 'bg-slate-900 text-white hover:bg-slate-800',
    btnGhost: 'border border-slate-300 text-slate-800 hover:bg-slate-100',
    chip: 'bg-slate-100 border border-slate-200 text-slate-700',
    grid: 'landing-grid-bg-light',
    aurora: 'landing-aurora-light',
    heading: 'landing-text-gradient-light',
  },
};

// ───────────────────────── inline CSS (scoped to landing) ─────────────────────────
const LandingStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    .landing-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
    .landing-serif { font-family: 'Instrument Serif', ui-serif, serif; font-style: italic; }
    .landing-sans-jp { font-family: 'Noto Sans JP', 'Inter', system-ui, sans-serif; }
    .landing-page :is(a,button,summary,input,textarea,select):focus-visible {
      outline: 2px solid #818cf8; outline-offset: 3px;
    }
    .landing-page .landing-skip { position: fixed; top: 10px; left: 12px; z-index: 60; }
    .landing-page .landing-skip:not(:focus) { clip-path: inset(50%); pointer-events: none; }
    .landing-contact::backdrop { background: #05060a99; backdrop-filter: blur(4px); }
    @media (max-width: 767px) {
      .landing-page main > section:not(:first-child) { padding-block: 64px; }
    }
    .landing-page section[id], .landing-page #demo { scroll-margin-top: 110px; }
    .landing-grid-bg {
      background-image:
        linear-gradient(to right, rgba(255,255,255,.04) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255,255,255,.04) 1px, transparent 1px);
      background-size: 64px 64px;
    }
    .landing-grid-bg-light {
      background-image:
        linear-gradient(to right, rgba(2,6,23,.05) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(2,6,23,.05) 1px, transparent 1px);
      background-size: 64px 64px;
    }
    .landing-aurora {
      background:
        radial-gradient(60% 80% at 20% 20%, rgba(99,102,241,.35), transparent 60%),
        radial-gradient(50% 60% at 80% 0%, rgba(236,72,153,.25), transparent 60%),
        radial-gradient(60% 70% at 50% 100%, rgba(16,185,129,.22), transparent 60%);
      filter: blur(40px);
    }
    .landing-aurora-light {
      background:
        radial-gradient(60% 80% at 20% 20%, rgba(99,102,241,.22), transparent 60%),
        radial-gradient(50% 60% at 80% 0%, rgba(236,72,153,.15), transparent 60%),
        radial-gradient(60% 70% at 50% 100%, rgba(16,185,129,.15), transparent 60%);
      filter: blur(60px);
    }
    .landing-text-gradient {
      background: linear-gradient(120deg, #fff 0%, #c7d2fe 40%, #f9a8d4 70%, #fff 100%);
      -webkit-background-clip: text; background-clip: text; color: transparent;
      background-size: 200% 100%;
      animation: landing-shine 8s linear infinite;
    }
    .landing-text-gradient-light {
      background: linear-gradient(120deg, #0f172a 0%, #4f46e5 40%, #db2777 70%, #0f172a 100%);
      -webkit-background-clip: text; background-clip: text; color: transparent;
      background-size: 200% 100%;
      animation: landing-shine 8s linear infinite;
    }
    @keyframes landing-shine { to { background-position: 200% 0; } }
    @keyframes landing-scroll-x { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    .landing-marquee { animation: landing-scroll-x 40s linear infinite; }
    @keyframes landing-pulse-dot { 0%,100% { opacity:.3 } 50% { opacity: 1 } }
    .landing-pulse-dot { animation: landing-pulse-dot 2s ease-in-out infinite; }
    @keyframes landing-blink { 50% { opacity: 0; } }
    .landing-blink { animation: landing-blink 1s step-end infinite; }

    /* Scroll-triggered reveal — opt-in via data-reveal / data-stagger */
    [data-reveal] {
      opacity: 0;
      transform: translateY(28px);
      transition:
        opacity .9s cubic-bezier(.2,.8,.2,1),
        transform .9s cubic-bezier(.2,.8,.2,1);
      will-change: opacity, transform;
    }
    [data-reveal][data-revealed="true"] {
      opacity: 1;
      transform: none;
    }
    [data-stagger] > * {
      opacity: 0;
      transform: translateY(20px);
      transition:
        opacity .75s cubic-bezier(.2,.8,.2,1),
        transform .75s cubic-bezier(.2,.8,.2,1);
      will-change: opacity, transform;
    }
    [data-stagger][data-revealed="true"] > * { opacity: 1; transform: none; }
    [data-stagger][data-revealed="true"] > *:nth-child(1) { transition-delay: 0ms; }
    [data-stagger][data-revealed="true"] > *:nth-child(2) { transition-delay: 80ms; }
    [data-stagger][data-revealed="true"] > *:nth-child(3) { transition-delay: 160ms; }
    [data-stagger][data-revealed="true"] > *:nth-child(4) { transition-delay: 240ms; }
    [data-stagger][data-revealed="true"] > *:nth-child(5) { transition-delay: 320ms; }
    [data-stagger][data-revealed="true"] > *:nth-child(6) { transition-delay: 400ms; }
    [data-stagger][data-revealed="true"] > *:nth-child(7) { transition-delay: 480ms; }
    [data-stagger][data-revealed="true"] > *:nth-child(8) { transition-delay: 560ms; }

    /* Hero load-in (no observer needed — runs on mount) */
    @keyframes landing-rise-in {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: none; }
    }
    .landing-rise-in { animation: landing-rise-in .9s cubic-bezier(.2,.8,.2,1) both; }
    .landing-rise-d1 { animation-delay: .05s; }
    .landing-rise-d2 { animation-delay: .18s; }
    .landing-rise-d3 { animation-delay: .35s; }
    .landing-rise-d4 { animation-delay: .55s; }
    .landing-rise-d5 { animation-delay: .8s; }
    .landing-rise-d6 { animation-delay: 1.05s; }

    @keyframes landing-pop-in {
      0% { opacity: 0; transform: scale(.95) translateY(18px); }
      60% { transform: scale(1.01) translateY(-2px); }
      100% { opacity: 1; transform: none; }
    }
    .landing-pop-in { animation: landing-pop-in 1.1s cubic-bezier(.2,.8,.2,1) both; }

    /* Slow ambient aurora breathing */
    @keyframes landing-aurora-drift {
      0%, 100% { transform: translate3d(0,0,0) scale(1); }
      50% { transform: translate3d(10px,-14px,0) scale(1.06); }
    }
    .landing-aurora-anim { animation: landing-aurora-drift 16s ease-in-out infinite; }

    /* Feature card icon — gentle bounce on parent .group hover */
    .landing-icon-chip { transition: transform .35s cubic-bezier(.2,.8,.2,1); }
    .group:hover .landing-icon-chip { transform: scale(1.08) rotate(-3deg); }

    /* CTA arrow nudge — small extra travel on hover (kept very subtle) */
    .landing-cta-arrow { transition: transform .25s ease, opacity .25s ease; }
    .group:hover .landing-cta-arrow { transform: translateX(4px); opacity: .9; }

    /* Reduced motion: turn every opt-in animation off */
    @media (prefers-reduced-motion: reduce) {
      [data-reveal], [data-stagger] > * {
        opacity: 1 !important;
        transform: none !important;
        transition: none !important;
      }
      .landing-rise-in,
      .landing-pop-in,
      .landing-aurora-anim,
      .landing-marquee,
      .landing-pulse-dot,
      .landing-blink,
      .landing-text-gradient,
      .landing-text-gradient-light {
        animation: none !important;
      }
      .landing-icon-chip,
      .landing-cta-arrow { transition: none !important; }
    }
  ` }} />
);

// ───────────────────────── Logo ─────────────────────────
function Logo(_: { theme: ThemeKey }) {
  return (
    <img
      src="/logo.png"
      alt="AI就活"
      width={24}
      height={24}
      className="rounded-md"
      decoding="async"
    />
  );
}

// ───────────────────────── Nav ─────────────────────────
function Nav({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
  const [scrolled, setScrolled] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const sections = [['機能', '#features'], ['選考管理', '#views'], ['AI連携', '#ai'], ['FAQ', '#faq']];
  return (
    <header className={'fixed inset-x-0 top-0 z-40 ' + (scrolled ? 'py-2' : 'py-3')}>
      <div className="mx-auto max-w-6xl px-3 sm:px-6">
        <nav aria-label="メインナビゲーション" className={'relative flex items-center justify-between gap-2 rounded-2xl px-2 sm:px-4 ' + t.glass}>
          <a href="/" className={'flex min-h-11 shrink-0 items-center gap-1.5 font-bold ' + t.text}>
            <Logo theme={theme} /><span>AI就活</span>
          </a>
          <div className={'hidden items-center gap-6 lg:flex ' + t.textMuted}>
            {sections.map(([label, href]) => <a key={href} href={href} className="inline-flex min-h-11 items-center text-sm hover:underline">{label}</a>)}
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <a href="/magazine/" className={'inline-flex min-h-11 items-center text-xs sm:text-sm ' + t.text}>マガジン</a>
            <a href="/app/" className={'inline-flex min-h-11 items-center rounded-xl px-2.5 text-xs font-semibold sm:px-4 sm:text-sm ' + t.btn}>Web版</a>
            <details ref={menu} className="lg:hidden">
              <summary className={'flex min-h-11 cursor-pointer list-none items-center text-xs [&::-webkit-details-marker]:hidden ' + t.text}>メニュー</summary>
              <div className={'absolute right-0 top-full mt-2 grid min-w-40 rounded-xl border p-2 shadow-lg ' + t.bg2 + ' ' + t.border}>
                {[...sections, ['ダウンロード', '#download']].map(([label, href]) => (
                  <a key={href} href={href} className="flex min-h-11 items-center px-3 text-sm" onClick={() => { if (menu.current) menu.current.open = false; }}>{label}</a>
                ))}
              </div>
            </details>
          </div>
        </nav>
      </div>
    </header>
  );
}

// ───────────────────────── Hero ─────────────────────────
function Hero({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
  return (
    <section className={'relative overflow-hidden pb-12 pt-28 md:pb-20 md:pt-36 ' + t.bg}>
      <div aria-hidden="true" className={'pointer-events-none absolute inset-0 ' + t.grid} />
      <div aria-hidden="true" className={'pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[900px] -translate-x-1/2 ' + t.aurora} />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-6">
        <p className={'text-sm font-semibold ' + t.textMuted}>自己分析から内定まで使える、就活管理アプリ</p>
        <h1 className={'landing-sans-jp mt-4 max-w-4xl text-[clamp(32px,5.4vw,72px)] font-bold leading-[1.2] tracking-tight ' + t.text}>
          応募先、ES、面接日程を<br className="hidden sm:block" />ひとつにまとめる。
        </h1>
        <p className={'mt-5 max-w-2xl text-base leading-relaxed md:text-lg ' + t.textMuted}>
          企業ごとに選考の進捗とメモを整理し、次の締切を確認できます。
          保存したメモは、必要に応じてClaudeやChatGPTでのES・面接準備にも使えます。
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a href="/app/" className={'inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold ' + t.btn}>Web版を使う</a>
          <a href="#download" className={'inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold ' + t.btnGhost}>Mac・Windows版</a>
        </div>
        <p className={'mt-3 text-sm ' + t.textMuted}>無料 · Web版はPCのChrome・Edgeに対応</p>
        <div id="demo" className="relative mt-10">
          <p className={'mb-3 text-sm font-semibold ' + t.textMuted}>企業ごとの選考とメモを管理する画面例</p>
          <HeroScreen t={t} theme={theme} />
          <a href="#views" className={'mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4 ' + t.text}>表・カンバン・カレンダーを見る</a>
        </div>
      </div>
    </section>
  );
}

function HeroScreen({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[2rem] pointer-events-none">
        <div className={'absolute inset-0 landing-aurora-anim ' + t.aurora + ' opacity-70'} />
      </div>
      <div className={'relative rounded-[1.75rem] border overflow-hidden shadow-2xl ' + (theme === 'dark' ? 'border-white/10 bg-[#0a0b12]' : 'border-slate-200 bg-white')}>
        <div className={'flex items-center gap-2 px-4 py-3 border-b ' + t.border}>
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400/80" />
            <span className="h-3 w-3 rounded-full bg-amber-400/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          </div>
          <div className={'ml-4 landing-mono text-xs flex items-center gap-2 ' + t.textDim}>
            <span>~/就活2028</span>
            <span className="landing-blink">▊</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className={'landing-mono text-[10px] px-2 py-0.5 rounded ' + t.chip}>⌘K</div>
          </div>
        </div>

        <div className="grid md:grid-cols-[210px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className={'hidden border-r p-3 md:block space-y-0.5 ' + t.border + ' ' + (theme === 'dark' ? 'bg-black/20' : 'bg-slate-50/80')}>
            <div className={'px-2 py-1 text-[10px] uppercase tracking-widest ' + t.textDim}>就活2028</div>
            {[
              { type: 'folder' as const, name: '自己分析', open: true, count: 3 },
              {
                type: 'folder' as const,
                name: 'コンサル',
                open: true,
                count: 4,
                children: [
                  { type: 'company' as const, name: '株式会社サンプルA', status: '1次面接', active: true },
                  { type: 'company' as const, name: '株式会社サンプルB', status: 'ES提出済' },
                  { type: 'company' as const, name: '株式会社サンプルC', status: '最終面接' },
                ],
              },
              { type: 'folder' as const, name: 'メーカー', count: 2 },
              { type: 'folder' as const, name: '_テンプレート' },
            ].map((n, i) => (
              <FileNode key={i} node={n} t={t} />
            ))}
          </aside>

          <div className="min-w-0 p-4 sm:p-6">
            <div className={'flex flex-wrap items-center gap-2 text-xs ' + t.textDim}>
              <span>コンサル</span><span>/</span>
              <span className={t.text}>株式会社サンプルA</span><span>/</span>
              <span className={t.text}>選考状況.md</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h3 className={'text-xl sm:text-3xl font-bold ' + t.text}>株式会社サンプルA</h3>
              <span className="rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 text-xs font-medium">1次面接</span>
            </div>
            <div className={'landing-mono text-[11px] mt-3 space-y-0.5 ' + t.textMuted}>
              <div><span className="text-pink-400">status:</span> 1次面接</div>
              <div><span className="text-pink-400">next_action_date:</span> 2028-05-12</div>
              <div><span className="text-pink-400">next_action_label:</span> 一次面接（オンライン）</div>
            </div>
            <div className={'mt-6 space-y-3 text-sm leading-relaxed ' + t.textMuted}>
              <div className={'font-semibold ' + t.text}># 志望動機</div>
              <p>
                コンサルティングファームの中でも特に
                <span className={theme === 'dark' ? 'bg-yellow-400/10 text-yellow-200 px-1 rounded' : 'bg-yellow-100 text-yellow-900 px-1 rounded'}>
                  プロダクト志向
                </span>
                が強く、デザインチームが独立した部門として置かれている点に惹かれました。
              </p>
              <p>自分が学生時代に取り組んできた<span className="underline decoration-dotted underline-offset-4">プロダクト開発の経験</span>を活かせる環境であると考えています。</p>
              <div className={'font-semibold ' + t.text + ' pt-2'}># 1次面接で聞かれそうなこと</div>
              <ul className="space-y-1 pl-5 list-disc">
                <li>志望動機（3分）</li>
                <li>ガクチカ → 数字で語れるように</li>
                <li>逆質問 3つ</li>
              </ul>
            </div>
            <div className={'mt-6 flex items-center gap-2 text-[10px] ' + t.textDim}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 landing-pulse-dot" />
              <span>自動保存済み・2秒前</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type FolderNode = {
  type: 'folder';
  name: string;
  open?: boolean;
  count?: number;
  children?: CompanyNode[];
};
type CompanyNode = {
  type: 'company';
  name: string;
  status?: string;
  active?: boolean;
};
type TreeNode = FolderNode | CompanyNode;

function FileNode({ node, t, depth = 0 }: { node: TreeNode; t: ThemeTokens; depth?: number }) {
  const pad = { paddingLeft: 8 + depth * 14 };
  if (node.type === 'folder') {
    return (
      <>
        <div
          style={pad}
          className={'flex items-center gap-1.5 py-1 px-2 rounded text-xs ' + t.textMuted + ' ' + t.cardHover + ' cursor-default'}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className={node.open ? 'rotate-90 transition' : 'transition'}>
            <path d="M8 5l8 7-8 7z" />
          </svg>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="opacity-70">
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
          <span className={t.text + ' font-medium'}>{node.name}</span>
          {node.count != null && <span className={'ml-auto landing-mono text-[10px] ' + t.textDim}>{node.count}</span>}
        </div>
        {node.open && node.children && node.children.map((c, i) => (
          <FileNode key={i} node={c} t={t} depth={depth + 1} />
        ))}
      </>
    );
  }
  return (
    <div
      style={pad}
      className={'flex items-center gap-1.5 py-1 px-2 rounded text-xs cursor-default ' + (node.active ? 'bg-indigo-500/20 text-white' : t.textMuted + ' ' + t.cardHover)}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
      <span className="truncate">{node.name}</span>
      {node.status && <span className="ml-auto landing-mono text-[9px] opacity-60">{node.status}</span>}
    </div>
  );
}

// ───────────────────────── Marquee ─────────────────────────
function LogoStrip({ t }: { t: ThemeTokens }) {
  const items = [
    '28卒 エントリー1,200社以上を登録',
    'Claude Sonnet 対応',
    'Cursor 連携',
    'GitHub Copilot と併用可',
    'gray-matter + Frontmatter',
    '100% ローカル保存',
    'Firestore 自動バックアップ',
    'AES-GCM 暗号化',
  ];
  return (
    <section className={'py-10 border-y ' + t.border + ' ' + t.bg2 + ' overflow-hidden'}>
      <div className="relative">
        <div className="landing-marquee flex gap-12 whitespace-nowrap landing-mono text-xs">
          {[...items, ...items].map((s, i) => (
            <div key={i} className={'flex items-center gap-2 ' + t.textMuted}>
              <span className="h-1 w-1 rounded-full bg-indigo-400" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── Section label ─────────────────────────
function SectionLabel({
  n,
  title,
  subtitle,
  t,
  theme,
}: {
  n: string;
  title: React.ReactNode;
  subtitle: string;
  t: ThemeTokens;
  theme: ThemeKey;
}) {
  return (
    <div className="mb-14" data-reveal>
      <div className={'landing-mono text-xs flex items-center gap-2 ' + t.textDim}>
        <span>{n}</span>
        <span className={'h-px w-8 ' + (theme === 'dark' ? 'bg-white/30' : 'bg-slate-300')} />
        <span>{subtitle}</span>
      </div>
      <h2 className={'landing-sans-jp mt-4 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] ' + t.text}>{title}</h2>
    </div>
  );
}

// ───────────────────────── AI section ─────────────────────────
function AISection({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
  return (
    <section id="ai" className={'relative py-32 overflow-hidden ' + t.bg}>
      <div className={'absolute inset-0 ' + t.grid} />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionLabel
          n="01"
          subtitle="AI Native"
          theme={theme}
          title={<>ファイル構造そのものが、<br /><span className="landing-serif font-normal">AIとの共通言語</span>になる。</>}
          t={t}
        />
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <div className="order-2 lg:order-1">
            <p className={'text-lg md:text-xl leading-relaxed ' + t.textMuted}>
              DB も専用フォーマットも使わない。<span className={t.text}>企業フォルダをそのまま Claude にドラッグ</span>すれば、面接対策も ES 添削も、あなたの就活の文脈ごと一瞬で理解してくれる。
            </p>
            <div className="mt-8 space-y-3">
              {[
                { k: '1', v: '企業フォルダを丸ごと Claude Projects にアップロード' },
                { k: '2', v: 'Cursor / VSCode で .md を開き、AI アシストで下書き' },
                { k: '3', v: 'ChatGPT にコピペしても Frontmatter 付きで文脈が伝わる' },
              ].map((s) => (
                <div key={s.k} className={'flex gap-4 rounded-xl p-4 ' + t.glass}>
                  <div className={'landing-mono text-xs h-7 w-7 grid place-items-center rounded-lg shrink-0 ' + (theme === 'dark' ? 'bg-white text-black' : 'bg-slate-900 text-white')}>
                    {s.k}
                  </div>
                  <div className={'text-sm ' + t.text}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <TerminalCard />
          </div>
        </div>
      </div>
    </section>
  );
}

function TerminalCard() {
  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
      <div className="flex items-center px-4 py-3 border-b border-white/10">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <div className="mx-auto landing-mono text-[11px] text-white/40">claude.ai/projects/ai就活</div>
      </div>
      <div className="p-5 landing-mono text-[12px] leading-relaxed text-white/80">
        <div className="text-white/40">$ tree 就活2028/株式会社サンプルA</div>
        <div className="mt-2 text-white/70">
          <div>株式会社サンプルA/</div>
          <div>├── <span className="text-indigo-300">選考状況.md</span></div>
          <div>├── <span className="text-indigo-300">企業分析.md</span></div>
          <div>├── <span className="text-indigo-300">ES・面接対策.md</span></div>
          <div>├── <span className="text-indigo-300">説明会・イベントメモ.md</span></div>
          <div>└── <span className="text-indigo-300">インターン.md</span></div>
        </div>
        <div className="mt-4 text-white/40"># Claude に聞く</div>
        <div className="mt-1 text-emerald-300">&gt; 次の1次面接までに準備すべき逆質問を3つ、</div>
        <div className="text-emerald-300">&nbsp;&nbsp;この企業の分析と私のガクチカを踏まえて考えて</div>
        <div className="mt-3 text-white/60">
          <div><span className="text-pink-300">Claude:</span> 分析.mdの「デザイン部門の独立」に</div>
          <div>絡めると、あなたの強みと接続しやすいです。</div>
          <div>以下、候補を3つ提案します <span className="landing-blink">▊</span></div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-white/30">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>context: 5 files · 2,341 tokens</span>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Features ─────────────────────────
const featureSvgProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Features({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
  const items = [
    {
      icon: (
        <svg {...featureSvgProps}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        </svg>
      ),
      iconCls: 'bg-indigo-500/15 text-indigo-500',
      title: 'ローカル保存、あなたのPC内のみ',
      body: 'DBもクラウド強制もなし。File System Access API で Finder / Explorer と完全同期。',
      accent: 'from-indigo-500/20 to-indigo-500/0',
    },
    {
      icon: (
        <svg {...featureSvgProps}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
      iconCls: 'bg-pink-500/15 text-pink-500',
      title: 'Notion風 WYSIWYG エディタ',
      body: 'Milkdown ベース。スラッシュコマンドで #見出し や - チェックリストをその場で挿入。',
      accent: 'from-pink-500/20 to-pink-500/0',
    },
    {
      icon: (
        <svg {...featureSvgProps}>
          <rect x="4" y="3" width="16" height="18" rx="1.5" />
          <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
          <path d="M10 21v-3a2 2 0 0 1 4 0v3" />
        </svg>
      ),
      iconCls: 'bg-emerald-500/15 text-emerald-500',
      title: '新規企業で5ファイル自動生成',
      body: '選考状況 / 企業分析 / ES・面接対策 / 説明会メモ / インターン を業界推定で雛形展開。',
      accent: 'from-emerald-500/20 to-emerald-500/0',
    },
    {
      icon: (
        <svg {...featureSvgProps}>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      iconCls: 'bg-amber-500/15 text-amber-500',
      title: 'パスワード欄は AES-GCM 暗号化',
      body: 'マイページのID/パスワードはパスフレーズで暗号化してから Firestore に同期。',
      accent: 'from-amber-500/20 to-amber-500/0',
    },
  ];
  return (
    <section id="features" className={'relative py-32 ' + t.bg2}>
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel
          n="02"
          subtitle="Core features"
          theme={theme}
          title={<>&quot;紙で管理&quot;の限界を、<br />4つの設計で超える。</>}
          t={t}
        />
        <div className="grid md:grid-cols-2 gap-5" data-stagger>
          {items.map((f, i) => (
            <div
              key={i}
              className={'group relative rounded-2xl p-8 border overflow-hidden transition-all ' + t.border + ' ' + t.card + ' hover:-translate-y-0.5'}
            >
              <div className={'absolute -top-20 -right-20 h-60 w-60 rounded-full bg-gradient-to-br opacity-60 group-hover:opacity-100 transition ' + f.accent} />
              <div className="relative">
                <div className={'landing-icon-chip mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ' + f.iconCls}>
                  {f.icon}
                </div>
                <div className={'text-xl font-bold ' + t.text}>{f.title}</div>
                <div className={'mt-2 text-sm leading-relaxed ' + t.textMuted}>{f.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── Views preview ─────────────────────────
const STATUS = [
  { name: '未応募', color: 'bg-slate-400' },
  { name: 'エントリー済', color: 'bg-sky-400' },
  { name: 'ES提出済', color: 'bg-blue-500' },
  { name: 'GD', color: 'bg-cyan-500' },
  { name: 'Webテスト', color: 'bg-teal-500' },
  { name: '1次面接', color: 'bg-indigo-500' },
  { name: '2次面接', color: 'bg-violet-500' },
  { name: '最終面接', color: 'bg-amber-500' },
  { name: '内定', color: 'bg-emerald-500' },
  { name: 'お祈り', color: 'bg-rose-400' },
];

const COMPANIES = [
  { c: '株式会社ブルーフィン', s: '1次面接', d: '05/12', i: 'コンサル', r: 4 },
  { c: 'サンプル商事', s: '最終面接', d: '05/18', i: '商社', r: 5 },
  { c: 'Reverie Labs', s: 'ES提出済', d: '05/20', i: 'IT/SaaS', r: 3 },
  { c: 'メタリノ製作所', s: 'エントリー済', d: '—', i: 'メーカー', r: 3 },
  { c: 'HeliosBank', s: '内定', d: '04/28', i: '金融', r: 5 },
  { c: 'NovaMedia', s: '2次面接', d: '05/15', i: 'メディア', r: 4 },
  { c: 'Kiyomi Foods', s: 'お祈り', d: '—', i: '食品', r: 2 },
  { c: 'Polaris Mobility', s: 'Webテスト', d: '05/10', i: 'モビリティ', r: 4 },
];

function StatusBadge({ s }: { s: string }) {
  const found = STATUS.find((x) => x.name === s);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium bg-white/[0.04] border border-white/10 text-white/80">
      <span className={'h-1.5 w-1.5 rounded-full ' + (found?.color || 'bg-slate-400')} />
      {s}
    </span>
  );
}

function ViewsSection({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
  const [tab, setTab] = useState<'sheet' | 'kanban' | 'calendar'>('sheet');
  return (
    <section id="views" className={'relative py-32 ' + t.bg}>
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel
          n="03"
          subtitle="3 views, 1 source"
          theme={theme}
          title={<>選考を、見たい形で<br />ぜんぶ可視化。</>}
          t={t}
        />
        <div aria-label="選考管理の表示形式" role="group" className={'mb-4 flex w-fit flex-wrap rounded-2xl p-1 ' + t.chip}>
          {[
            { id: 'sheet' as const, label: 'スプレッドシート' },
            { id: 'kanban' as const, label: 'カンバン' },
            { id: 'calendar' as const, label: 'カレンダー' },
          ].map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setTab(v.id)}
              aria-pressed={tab === v.id}
              className={'min-h-11 rounded-xl px-2 py-1.5 text-xs sm:px-4 sm:text-sm transition ' + (tab === v.id ? (theme === 'dark' ? 'bg-white text-black' : 'bg-slate-900 text-white') : 'opacity-70 hover:opacity-100')}
            >
              {v.label}
            </button>
          ))}
        </div>
        <p className={'mb-3 text-sm md:hidden ' + t.textMuted}>画面例は横にスクロールできます。</p>
        <div role="region" aria-label="選考管理の画面例" tabIndex={0} className={'overflow-x-auto rounded-2xl border shadow-xl ' + t.border + ' ' + (theme === 'dark' ? 'bg-[#0a0b12]' : 'bg-white')}>
          {tab === 'sheet' && <SheetView t={t} theme={theme} />}
          {tab === 'kanban' && <KanbanView t={t} />}
          {tab === 'calendar' && <CalendarView t={t} theme={theme} />}
        </div>
      </div>
    </section>
  );
}

function SheetView({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
  const headerBg = theme === 'dark' ? 'bg-white/[0.04]' : 'bg-slate-50';
  const rowBorder = theme === 'dark' ? 'border-white/5' : 'border-slate-100';
  return (
    <div className="min-w-[740px] text-sm">
      <div className={'grid grid-cols-[36px_2fr_1.3fr_1fr_1fr_0.8fr] ' + headerBg + ' ' + (theme === 'dark' ? 'text-white/60' : 'text-slate-500') + ' text-xs landing-mono uppercase tracking-wider'}>
        {['#', '企業名', 'ステータス', '業界', '次アクション', '評価'].map((h, i) => (
          <div key={i} className="px-4 py-3 border-r border-white/5">{h}</div>
        ))}
      </div>
      {COMPANIES.map((row, i) => (
        <div
          key={i}
          className={'grid grid-cols-[36px_2fr_1.3fr_1fr_1fr_0.8fr] border-t ' + rowBorder + ' items-center ' + (i % 2 && theme === 'dark' ? 'bg-white/[0.01]' : '')}
        >
          <div className={'px-4 py-3 landing-mono text-[10px] ' + t.textDim}>{String(i + 1).padStart(2, '0')}</div>
          <div className={'px-4 py-3 font-medium ' + t.text}>{row.c}</div>
          <div className="px-4 py-3"><StatusBadge s={row.s} /></div>
          <div className={'px-4 py-3 ' + t.textMuted}>{row.i}</div>
          <div className={'px-4 py-3 landing-mono ' + t.textMuted}>{row.d}</div>
          <div className="px-4 py-3">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={'text-xs ' + (n <= row.r ? 'text-amber-400' : t.textDim)}>★</span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function KanbanView({ t }: { t: ThemeTokens }) {
  const cols = ['エントリー済', 'ES提出済', '1次面接', '最終面接', '内定'];
  return (
    <div className="p-5">
      <div className="flex gap-4 min-w-fit">
        {cols.map((col) => {
          const cards = COMPANIES.filter((c) => c.s === col);
          const accent = STATUS.find((s) => s.name === col)?.color || 'bg-slate-400';
          return (
            <div key={col} className="w-64 shrink-0">
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className={'h-1.5 w-1.5 rounded-full ' + accent} />
                <div className={'text-xs font-semibold ' + t.text}>{col}</div>
                <div className={'landing-mono text-[10px] ' + t.textDim}>{cards.length}</div>
              </div>
              <div className="space-y-2">
                {cards.length === 0 && (
                  <div className={'text-xs py-6 text-center border border-dashed rounded-xl ' + t.border + ' ' + t.textDim}>
                    ドロップで追加
                  </div>
                )}
                {cards.map((c, i) => (
                  <div
                    key={i}
                    className={'rounded-xl p-3 border ' + t.border + ' ' + t.card + ' shadow-sm hover:-translate-y-0.5 transition'}
                  >
                    <div className={'text-sm font-medium ' + t.text}>{c.c}</div>
                    <div className={'text-[11px] mt-1 ' + t.textMuted}>{c.i}</div>
                    <div className={'mt-3 flex items-center justify-between text-[10px] ' + t.textDim}>
                      <span className="landing-mono">{c.d}</span>
                      <span>{'★'.repeat(c.r)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarView({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
  const events: Record<number, { c: string; s: string; color: string }[]> = {
    5: [{ c: 'ブルーフィン', s: '1次面接', color: 'bg-indigo-500' }],
    8: [{ c: 'Reverie Labs', s: 'ES〆切', color: 'bg-blue-500' }],
    12: [{ c: 'Polaris', s: 'Webテスト', color: 'bg-teal-500' }],
    15: [{ c: 'NovaMedia', s: '2次面接', color: 'bg-violet-500' }],
    18: [{ c: 'サンプル商事', s: '最終面接', color: 'bg-amber-500' }],
    22: [{ c: 'Helios', s: '内定承諾〆', color: 'bg-emerald-500' }],
    25: [{ c: 'メタリノ', s: 'エントリー〆', color: 'bg-sky-500' }],
  };
  const days = Array.from({ length: 35 }, (_, i) => i - 2);
  const today = 12;
  return (
    <div className="min-w-[650px] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className={'text-base font-bold ' + t.text}>2028年 5月</div>
        <span className={'text-xs ' + t.textMuted}>表示例</span>
      </div>
      <div className={'grid grid-cols-7 text-[10px] landing-mono uppercase tracking-widest mb-1 ' + t.textDim}>
        {['月', '火', '水', '木', '金', '土', '日'].map((d) => (
          <div key={d} className="px-2 py-1">{d}</div>
        ))}
      </div>
      <div className={'grid grid-cols-7 border-l border-t ' + t.border}>
        {days.map((d, i) => {
          const inMonth = d >= 1 && d <= 31;
          const evs = events[d] || [];
          return (
            <div
              key={i}
              className={'min-h-[84px] border-r border-b p-1.5 ' + t.border + ' ' + (inMonth ? '' : theme === 'dark' ? 'bg-white/[0.015]' : 'bg-slate-50/60')}
            >
              <div className={'flex items-center justify-end text-[10px] ' + (d === today ? 'font-bold' : t.textDim)}>
                {inMonth && (d === today
                  ? <span className={'h-5 w-5 grid place-items-center rounded-full ' + (theme === 'dark' ? 'bg-white text-black' : 'bg-slate-900 text-white')}>{d}</span>
                  : d)}
              </div>
              <div className="mt-1 space-y-0.5">
                {evs.map((e, j) => (
                  <div key={j} className={'text-[10px] px-1.5 py-0.5 rounded text-white ' + e.color}>
                    <span className="landing-mono opacity-70">{e.s}</span> {e.c}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────── Stories ─────────────────────────
function Stories({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
  return (
    <section id="stories" className={'relative py-32 ' + t.bg2}>
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel
          n="04"
          subtitle="How to use"
          theme={theme}
          title="就活の場面に合わせた使い方"
          t={t}
        />
        <div className="grid md:grid-cols-3 gap-4" data-stagger>
          {[
            { tag: 'USE CASE 01', title: 'ES 量産期', body: 'Frontmatter に〆切・提出先をメモ。テンプレから派生させて5社並行で下書き。' },
            { tag: 'USE CASE 02', title: '面接ラッシュ', body: 'カレンダーで時系列、カンバンで進捗、詳細は Markdown。同じデータを3視点で。' },
            { tag: 'USE CASE 03', title: '内定承諾検討', body: '比較表を1つの md に。Claude に「このオファーをどう判断すべき？」と聞ける。' },
          ].map((u, i) => (
            <div key={i} className={'rounded-2xl p-6 border ' + t.border + ' ' + t.card}>
              <div className={'landing-mono text-[10px] uppercase tracking-widest ' + t.textDim}>{u.tag}</div>
              <div className={'mt-2 text-lg font-bold ' + t.text}>{u.title}</div>
              <div className={'mt-2 text-sm ' + t.textMuted}>{u.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── Download ─────────────────────────
function DownloadSection({ t }: { t: ThemeTokens }) {
  return (
    <section id="download" className={'relative py-32 overflow-hidden ' + t.bg}>
      <div className="absolute inset-0 pointer-events-none">
        <div className={'absolute inset-0 landing-aurora-anim ' + t.aurora + ' opacity-80'} />
      </div>
      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <div className={'landing-mono text-xs ' + t.textDim}>利用環境を選ぶ</div>
        <h2 className={'landing-sans-jp mt-5 text-5xl md:text-7xl font-bold tracking-tight ' + t.text}>
          さあ、<span className={t.heading}>就活</span>を始めよう。
        </h2>
        <p className={'mt-5 text-lg ' + t.textMuted}>Web版とデスクトップ版を無料で利用できます。</p>

        <div className="mt-10 grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto" data-stagger>
          <a
            href={DL_MACOS}
            className={'group flex items-center justify-center gap-3 rounded-2xl px-6 py-5 text-base font-semibold transition ' + t.btn}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <div className="text-left leading-tight">
              <div className="text-[10px] opacity-60 landing-mono">DOWNLOAD FOR</div>
              <div>macOS (Apple / Intel)</div>
            </div>
          </a>
          <a
            href={GITHUB_RELEASE}
            className={'group flex items-center justify-center gap-3 rounded-2xl px-6 py-5 text-base font-semibold transition ' + t.btnGhost}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 5.7L11 4v8H3V5.7zM3 12.3L11 12.3V20l-8-1.7v-6zM12 4v8h9V4.3L12 4zM12 12.3L21 12.3V19.7l-9-1.3v-6.1z" />
            </svg>
            <div className="text-left leading-tight">
              <div className="text-[10px] opacity-60 landing-mono">DOWNLOAD FOR</div>
              <div>Windows (x64 / ARM64)</div>
            </div>
          </a>
        </div>
        <div className={'mx-auto mt-4 max-w-2xl text-sm leading-7 ' + t.textMuted}>
          <details className="mt-3 text-left"><summary className="cursor-pointer text-center">インストール方法・対応環境</summary><p>Mac：ダウンロードしたtar.gzを展開し、AIshukatsu.appをアプリケーションへ移動してください。Apple Silicon・Intel両対応です。OSで開けない場合は、配布ページの署名状況と案内を確認してください。</p><p>Windows 10 / 11：通常はx64版、ARM搭載PCではARM64版のセットアップを実行してください。</p><p>更新前にはフォルダ全体のバックアップを作成できます。インストーラーの公開状況・変更点は<a className="underline" href={GITHUB_RELEASE}>リリースページ</a>で確認できます。</p></details>
        </div>
        <div className={'mx-auto mt-6 max-w-2xl rounded-xl border p-4 ' + t.border}>
          <p className={'mb-3 text-sm ' + t.textMuted}>Web版はPCのChrome・Edgeで利用できます。Googleログインは任意です。</p>
          <a href="/app/" className={'inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold ' + t.btnGhost}>Web版を使う</a>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── FAQ ─────────────────────────
function FAQ({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
  const items = [
    { q: '本当にデータはローカルのみ？', a: 'はい。Markdown 本体はあなたのPC内（選んだフォルダ）にしか保存されません。選考管理のシートだけは、サインインすれば Firestore にバックアップされます（パスワード欄は暗号化）。' },
    { q: 'Safari / Firefox では動きませんか？', a: '現状は File System Access API に対応した Chromium 系ブラウザ（Chrome / Edge / Arc）か、Mac/Windows のデスクトップアプリのみです。' },
    { q: 'Claude や Cursor は必須ですか？', a: 'いいえ。AI を使わなくても普通の就活管理ツールとして完結します。AI を使う場合は生成したフォルダをドラッグ&ドロップするだけです。' },
    { q: '完全無料ですか？', a: 'はい、MVP 期間中は完全無料。将来的に有料プランを検討する場合でも、既存のあなたのデータが人質になることはありません（自分のPCに全部残っています）。' },
    { q: 'データ移行は？', a: 'フォルダごとコピーするだけで別PCに移行可能。Obsidian や VSCode でそのまま開けます。' },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className={'relative py-32 ' + t.bg2}>
      <div className="mx-auto max-w-4xl px-6">
        <SectionLabel n="05" subtitle="Questions" title="よくある質問" t={t} theme={theme} />
        <div
          className={'rounded-2xl border ' + t.border + ' ' + t.card + ' divide-y ' + (theme === 'dark' ? 'divide-white/10' : 'divide-slate-200')}
          data-stagger
        >
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={it.q}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`landing-faq-${i}`}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left"
                >
                  <span className={'flex-1 font-semibold ' + t.text}>{it.q}</span>
                  <span aria-hidden="true" className={'text-xl ' + t.textMuted}>{isOpen ? '−' : '+'}</span>
                </button>
                <p id={`landing-faq-${i}`} hidden={!isOpen} className={'px-5 pb-5 text-sm leading-relaxed ' + t.textMuted}>{it.a}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── Footer ─────────────────────────
type FooterLink = { label: string; id?: string; href?: string; onClick?: () => void };

function Footer({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  useEffect(() => {
    const openFooterPanel = () => {
      if (window.location.hash === '#privacy') setLegal('privacy');
      if (window.location.hash === '#contact') setContactOpen(true);
    };
    openFooterPanel();
    window.addEventListener('hashchange', openFooterPanel);
    return () => window.removeEventListener('hashchange', openFooterPanel);
  }, []);

  const columns: { h: string; l: FooterLink[] }[] = [
    {
      h: 'プロダクト',
      l: [{ label: '機能', href: '#features' }, { label: '選考管理', href: '#views' }, { label: 'AI連携', href: '#ai' }, { label: 'ダウンロード', href: '#download' }],
    },
    {
      h: 'リソース',
      l: [{ label: '就活マガジン', href: '/magazine/' }, { label: 'リリースノート', href: GITHUB_RELEASE }, { label: 'よくある質問', href: '#faq' }],
    },
    {
      h: '法務',
      l: [
        { label: '利用規約', onClick: () => setLegal('terms') },
        { label: 'プライバシーポリシー', id: 'privacy', onClick: () => setLegal('privacy') },
        { label: 'お問い合わせ', id: 'contact', onClick: () => setContactOpen(true) },
      ],
    },
  ];

  return (
    <footer className={'relative pt-20 pb-10 border-t ' + t.border + ' ' + t.bg}>
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10">
          <div>
            <div className="flex items-center gap-2">
              <Logo theme={theme} />
              <div className={'font-bold ' + t.text}>AI就活</div>
            </div>
            <div className={'mt-4 text-sm leading-relaxed max-w-sm ' + t.textMuted}>
              あなたの就活の軌跡は、あなたのPCの中に残る。AIに渡せる形で。それが、就活管理のあたりまえを更新する。
            </div>
            <div className={'mt-6 landing-mono text-[10px] ' + t.textDim}>
              © {new Date().getFullYear()} AI就活
            </div>
          </div>
          {columns.map((col, i) => (
            <div key={i}>
              <div className={'text-xs landing-mono uppercase tracking-widest ' + t.textDim}>{col.h}</div>
              <ul className={'mt-3 space-y-2 text-sm ' + t.textMuted}>
                {col.l.map((x) => (
                  <li key={x.label}>
                    {x.onClick ? (
                      <button
                        type="button"
                        id={x.id}
                        onClick={x.onClick}
                        className="opacity-80 transition hover:opacity-100"
                      >
                        {x.label}
                      </button>
                    ) : (
                      <a
                        href={x.href ?? '#'}
                        className="opacity-80 transition hover:opacity-100"
                        {...(x.href?.startsWith('http')
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : {})}
                      >
                        {x.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={'mt-16 pt-8 border-t flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ' + t.border}>
          <div className={'text-5xl md:text-7xl font-bold tracking-tighter ' + t.textDim}>AI SHUKATSU.</div>
          <div className={'text-xs landing-mono flex items-center gap-3 ' + t.textDim}>
            <span>aishukatsu.net</span>
          </div>
        </div>
      </div>
      {legal === 'terms' && (
        <LegalModal
          title="利用規約"
          body={TERMS_OF_SERVICE}
          onClose={() => setLegal(null)}
        />
      )}
      {legal === 'privacy' && (
        <LegalModal
          title="プライバシーポリシー"
          body={PRIVACY_POLICY}
          onClose={() => setLegal(null)}
        />
      )}
      <ContactForm
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        t={t}
        theme={theme}
      />
    </footer>
  );
}

// ───────────────────────── Contact form (Firestore-backed) ─────────────────────────
function ContactForm({
  open,
  onClose,
  t,
  theme,
}: {
  open: boolean;
  onClose: () => void;
  t: ThemeTokens;
  theme: ThemeKey;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — real users never see/fill this
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      opener?.focus();
    };
  }, [open]);

  // Reset state whenever the modal closes so a future open starts fresh.
  useEffect(() => {
    if (open) return;
    setStatus('idle');
    setErrorMsg(null);
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    setWebsite('');
  }, [open]);

  if (!open) return null;

  const isDark = theme === 'dark';
  const inputCls =
    'w-full rounded-lg border px-3 py-2 text-sm outline-none transition ' +
    (isDark
      ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-white/30'
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-slate-500');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (website) return; // bot caught — silently ignore
    const last = Number(localStorage.getItem(CONTACT_RATE_LIMIT_KEY) || 0);
    if (Date.now() - last < CONTACT_RATE_LIMIT_MS) {
      setErrorMsg('連続送信は 60 秒空けてください。');
      setStatus('error');
      return;
    }
    setStatus('sending');
    setErrorMsg(null);
    try {
      const [{ addDoc, collection, serverTimestamp }, { db }] = await Promise.all([
        import('firebase/firestore'),
        import('../spreadsheet/lib/firebase'),
      ]);
      if (!db) throw new Error('Contact service unavailable');
      await addDoc(collection(db, 'contactInquiries'), {
        name: name.trim().slice(0, 100),
        email: email.trim().slice(0, 200),
        subject: subject.trim().slice(0, 200),
        message: message.trim().slice(0, 5000),
        createdAt: serverTimestamp(),
        userAgent: navigator.userAgent.slice(0, 500),
      });
      localStorage.setItem(CONTACT_RATE_LIMIT_KEY, String(Date.now()));
      setStatus('sent');
    } catch (err) {
      console.error('[contact] submit failed', err);
      setErrorMsg(`送信に失敗しました。時間を置いて再度お試しいただくか、${CONTACT_EMAIL} までメールでご連絡ください。`);
      setStatus('error');
    }
  };

  const panelCls =
    'flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl ' +
    (isDark ? 'bg-[#0a0b12] border-white/10' : 'bg-white border-slate-200');
  const headerBorder = isDark ? 'border-white/10' : 'border-slate-200';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="landing-contact-title"
      className="landing-contact m-auto w-[calc(100%-2rem)] max-w-lg overflow-visible rounded-2xl bg-transparent p-0"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className={panelCls}>
        <div className={'flex items-center justify-between border-b px-6 py-4 ' + headerBorder}>
          <h2 id="landing-contact-title" className={'text-lg font-semibold ' + t.text}>お問い合わせ</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className={t.textMuted + ' opacity-70 transition hover:opacity-100'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {status === 'sent' ? (
            <div role="status" className="space-y-4 py-6 text-center">
              <div className={'mx-auto grid h-12 w-12 place-items-center rounded-full ' + (isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-600')}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div className={'text-base font-semibold ' + t.text}>送信が完了しました</div>
              <div className={'text-sm leading-relaxed ' + t.textMuted}>
                内容を確認のうえ、可能な限り早くご返信いたします。
              </div>
              <button
                type="button"
                onClick={onClose}
                className={'mt-2 inline-flex rounded-full px-5 py-2 text-sm font-semibold transition ' + t.btn}
              >
                閉じる
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <p className={'text-sm leading-relaxed ' + t.textMuted}>
                ご質問・不具合のご報告・機能リクエストなどお気軽にどうぞ。通常 1〜2 営業日以内にご返信します。
              </p>

              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                aria-hidden="true"
                className="absolute left-[-9999px] h-0 w-0 opacity-0"
              />

              <div>
                <label htmlFor="contact-name" className={'mb-1 block text-xs font-medium ' + t.textMuted}>
                  お名前 <span className="text-rose-400">*</span>
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  autoComplete="name"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className={'mb-1 block text-xs font-medium ' + t.textMuted}>
                  メールアドレス <span className="text-rose-400">*</span>
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  maxLength={200}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="contact-subject" className={'mb-1 block text-xs font-medium ' + t.textMuted}>件名</label>
                <input
                  id="contact-subject"
                  type="text"
                  maxLength={200}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={inputCls}
                  placeholder="任意"
                />
              </div>
              <div>
                <label htmlFor="contact-message" className={'mb-1 block text-xs font-medium ' + t.textMuted}>
                  お問い合わせ内容 <span className="text-rose-400">*</span>
                </label>
                <textarea
                  id="contact-message"
                  required
                  maxLength={5000}
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={inputCls + ' resize-none'}
                />
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className={
                    'rounded-lg border px-3 py-2 text-xs leading-relaxed ' +
                    (isDark
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                      : 'border-rose-200 bg-rose-50 text-rose-700')
                  }
                >
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={status === 'sending'}
                  className={'rounded-full px-4 py-2 text-sm transition ' + t.btnGhost + ' disabled:opacity-50'}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className={'rounded-full px-5 py-2 text-sm font-semibold transition ' + t.btn + ' disabled:opacity-50'}
                >
                  {status === 'sending' ? '送信中…' : '送信する'}
                </button>
              </div>

              <div className={'pt-2 text-[10px] ' + t.textDim}>
                個人情報の取り扱いはプライバシーポリシーに準じます。
              </div>
            </form>
          )}
        </div>
      </div>
    </dialog>
  );
}

function ThemeToggle({ theme, setTheme }: { theme: ThemeKey; setTheme: (t: ThemeKey) => void }) {
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="テーマ切替"
      className={
        'fixed bottom-6 right-6 z-50 h-11 w-11 grid place-items-center rounded-full shadow-lg backdrop-blur-xl transition ' +
        (theme === 'dark'
          ? 'bg-white/10 border border-white/15 text-white hover:bg-white/20'
          : 'bg-white border border-slate-200 text-slate-900 hover:bg-slate-50')
      }
    >
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

// ───────────────────────── Entry ─────────────────────────
export function LandingPage() {
  // Match the prerendered theme during hydration, then restore the preference.
  const [theme, setThemeState] = useState<ThemeKey>('dark');
  useEffect(() => { setThemeState(readWebsiteTheme('dark', 'aishukatsu-landing-theme')); }, []);

  const setTheme = (value: ThemeKey) => {
    setThemeState(value);
    saveWebsiteTheme(value);
  };

  const t = themes[theme];

  // Scroll-triggered reveals: a single observer flips data-revealed="true"
  // on any [data-reveal] / [data-stagger] node when it crosses the viewport,
  // then disconnects per-node so each animation plays once.
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal], [data-stagger]');
    if (els.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.setAttribute('data-revealed', 'true'));
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute('data-revealed', 'true');
            obs.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const scrollToSection = () => {
      try {
        const id = decodeURIComponent(window.location.hash.slice(1));
        if (!['features', 'views', 'ai', 'stories', 'magazine', 'download', 'faq', 'demo'].includes(id)) return;
        frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'instant' }));
      } catch { /* an invalid fragment does not block the public website */ }
    };
    if (document.readyState === 'complete') scrollToSection();
    else window.addEventListener('load', scrollToSection, { once: true });
    return () => { window.removeEventListener('load', scrollToSection); cancelAnimationFrame(frame); };
  }, []);

  return (
    <div className={'landing-page min-h-screen overflow-x-hidden ' + t.bg + ' ' + t.text}>
      <LandingStyles />
      <a href="#landing-main" className={'landing-skip rounded-lg px-4 py-3 ' + t.btn}>本文に進む</a>
      <Nav t={t} theme={theme} />
      <main id="landing-main" tabIndex={-1}>
        <Hero t={t} theme={theme} />
        <LogoStrip t={t} />
        <Features t={t} theme={theme} />
        <ViewsSection t={t} theme={theme} />
        <AISection t={t} theme={theme} />
        <Stories t={t} theme={theme} />
        <LandingMagazine theme={theme} />
        <DownloadSection t={t} />
        <FAQ t={t} theme={theme} />
      </main>
      <Footer t={t} theme={theme} />
      <ThemeToggle theme={theme} setTheme={setTheme} />
    </div>
  );
}
