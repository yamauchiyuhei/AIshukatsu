import { useEffect, useState } from 'react';
import { signInWithGoogle } from '../spreadsheet/lib/firebase';

// ───────────────────────── constants ─────────────────────────
const GITHUB_RELEASE =
  'https://github.com/yamauchiyuhei/AIshukatsu/releases/latest';
const DL_MACOS = `${GITHUB_RELEASE}/download/AIshukatsu_universal.app.tar.gz`;
const DL_WINDOWS = GITHUB_RELEASE;
const APP_VERSION = 'v0.2.13';

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
    textDim: 'text-white/40',
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
    textDim: 'text-slate-400',
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
  <style>{`
    .landing-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
    .landing-serif { font-family: 'Instrument Serif', ui-serif, serif; font-style: italic; }
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
  `}</style>
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
function Nav({ t, theme, onSignIn }: { t: ThemeTokens; theme: ThemeKey; onSignIn: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={'fixed top-0 inset-x-0 z-40 transition-all ' + (scrolled ? 'py-3' : 'py-5')}>
      <div className="mx-auto max-w-6xl px-6">
        <nav className={'flex items-center justify-between rounded-full px-5 py-2.5 transition-all ' + (scrolled ? t.glass : '')}>
          <a href="#" className="flex items-center gap-2.5">
            <Logo theme={theme} />
            <span className={'font-bold tracking-tight ' + t.text}>AI就活</span>
            <span className={'landing-mono text-[10px] px-1.5 py-0.5 rounded ' + t.chip}>{APP_VERSION}</span>
          </a>
          <div className={'hidden md:flex items-center gap-7 text-sm ' + t.textMuted}>
            <a href="#features" className="hover:opacity-100 opacity-80">機能</a>
            <a href="#views" className="hover:opacity-100 opacity-80">選考管理</a>
            <a href="#ai" className="hover:opacity-100 opacity-80">AI連携</a>
            <a href="#stories" className="hover:opacity-100 opacity-80">ストーリー</a>
            <a href="#faq" className="hover:opacity-100 opacity-80">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSignIn}
              className={'hidden sm:inline-flex rounded-full px-4 py-1.5 text-sm font-medium transition ' + t.btn}
            >
              Web版を使う
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}

// ───────────────────────── Hero ─────────────────────────
function Hero({ t, theme, onSignIn }: { t: ThemeTokens; theme: ThemeKey; onSignIn: () => void }) {
  return (
    <section className={'relative overflow-hidden pt-40 pb-24 ' + t.bg}>
      <div className={'absolute inset-0 ' + t.grid} />
      <div className="absolute inset-0 pointer-events-none">
        <div className={'absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] ' + t.aurora} />
      </div>
      <div className={'absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent ' + (theme === 'dark' ? 'to-[#05060a]' : 'to-[#fafafa]')} />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="max-w-4xl">
          <div className={'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ' + t.chip}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 landing-pulse-dot" />
            <span className="landing-mono tracking-wider">28卒・29卒の就活OS</span>
            <span className={t.textDim}>・</span>
            <span>Mac / Windows 対応</span>
          </div>

          <h1 className={'mt-6 text-[clamp(44px,7.5vw,104px)] font-black leading-[0.95] tracking-tight ' + t.text}>
            就活を、<br />
            <span className={t.heading}>AIと一緒に、</span><br />
            <span className="landing-serif font-normal">ちゃんと</span>終わらせる。
          </h1>

          <p className={'mt-7 max-w-2xl text-lg md:text-xl leading-relaxed ' + t.textMuted}>
            1企業 1フォルダ、全部 Markdown。<br className="hidden md:block" />
            書いた情報はそのまま <span className={t.text + ' font-medium'}>Claude / Cursor / ChatGPT</span> に渡せる、
            ローカルファーストの就活管理アプリ。
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a
              href="#download"
              className={'group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ' + t.btn}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              無料ダウンロード
              <span className="opacity-50 group-hover:translate-x-0.5 transition">→</span>
            </a>
            <button
              type="button"
              onClick={onSignIn}
              className={'inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ' + t.btnGhost}
            >
              Web版を無料で使う
            </button>
            <a
              href="#demo"
              className={'inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ' + t.btnGhost}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              プロダクトデモ
            </a>
          </div>

          <div className={'mt-14 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs ' + t.textMuted}>
            {['ローカルファースト', 'Markdown ネイティブ', 'パスワード暗号化', 'Firestore バックアップ', 'Chrome / Edge / Desktop'].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
                {s}
              </div>
            ))}
          </div>
        </div>

        <div id="demo" className="relative mt-24">
          <HeroScreen t={t} theme={theme} />
        </div>
      </div>
    </section>
  );
}

function HeroScreen({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[2rem] pointer-events-none">
        <div className={'absolute inset-0 ' + t.aurora + ' opacity-70'} />
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

        <div className="grid grid-cols-[240px_1fr]">
          <aside className={'border-r p-3 space-y-0.5 ' + t.border + ' ' + (theme === 'dark' ? 'bg-black/20' : 'bg-slate-50/80')}>
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

          <div className="p-6">
            <div className={'flex items-center gap-2 text-xs ' + t.textDim}>
              <span>コンサル</span><span>/</span>
              <span className={t.text}>株式会社サンプルA</span><span>/</span>
              <span className={t.text}>選考状況.md</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <h3 className={'text-3xl font-bold ' + t.text}>株式会社サンプルA</h3>
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
    <div className="mb-14">
      <div className={'landing-mono text-xs flex items-center gap-2 ' + t.textDim}>
        <span>{n}</span>
        <span className={'h-px w-8 ' + (theme === 'dark' ? 'bg-white/30' : 'bg-slate-300')} />
        <span>{subtitle}</span>
      </div>
      <h2 className={'mt-4 text-4xl md:text-6xl font-black tracking-tight leading-[1.05] ' + t.text}>{title}</h2>
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
function Features({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
  const items = [
    { icon: '📂', title: 'ローカル保存、あなたのPC内のみ', body: 'DBもクラウド強制もなし。File System Access API で Finder / Explorer と完全同期。', accent: 'from-indigo-500/20 to-indigo-500/0' },
    { icon: '✍', title: 'Notion風 WYSIWYG エディタ', body: 'Milkdown ベース。スラッシュコマンドで #見出し や - チェックリストをその場で挿入。', accent: 'from-pink-500/20 to-pink-500/0' },
    { icon: '🏢', title: '新規企業で5ファイル自動生成', body: '選考状況 / 企業分析 / ES・面接対策 / 説明会メモ / インターン を業界推定で雛形展開。', accent: 'from-emerald-500/20 to-emerald-500/0' },
    { icon: '🔐', title: 'パスワード欄は AES-GCM 暗号化', body: 'マイページのID/パスワードはパスフレーズで暗号化してから Firestore に同期。', accent: 'from-amber-500/20 to-amber-500/0' },
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
        <div className="grid md:grid-cols-2 gap-5">
          {items.map((f, i) => (
            <div
              key={i}
              className={'group relative rounded-2xl p-8 border overflow-hidden transition-all ' + t.border + ' ' + t.card + ' hover:-translate-y-0.5'}
            >
              <div className={'absolute -top-20 -right-20 h-60 w-60 rounded-full bg-gradient-to-br opacity-60 group-hover:opacity-100 transition ' + f.accent} />
              <div className="relative">
                <div className="text-3xl mb-4">{f.icon}</div>
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
        <div className={'inline-flex rounded-full p-1 mb-8 ' + t.chip}>
          {[
            { id: 'sheet' as const, label: 'スプレッドシート' },
            { id: 'kanban' as const, label: 'カンバン' },
            { id: 'calendar' as const, label: 'カレンダー' },
          ].map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setTab(v.id)}
              className={'px-4 py-1.5 text-sm rounded-full transition ' + (tab === v.id ? (theme === 'dark' ? 'bg-white text-black' : 'bg-slate-900 text-white') : 'opacity-70 hover:opacity-100')}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className={'rounded-2xl border overflow-hidden shadow-2xl ' + t.border + ' ' + (theme === 'dark' ? 'bg-[#0a0b12]' : 'bg-white')}>
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
    <div className="text-sm overflow-hidden">
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
    <div className="p-5 overflow-x-auto">
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
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className={'text-base font-bold ' + t.text}>2028年 5月</div>
        <div className="flex gap-1">
          {['今日', '‹', '›'].map((x, i) => (
            <button key={i} type="button" className={'px-2 py-1 text-xs rounded-md ' + t.btnGhost}>{x}</button>
          ))}
        </div>
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
  const testimonials = [
    { name: 'K.T.', grade: '28卒・慶應', role: '戦略コンサル内定', avatar: 'bg-gradient-to-br from-indigo-400 to-pink-400', body: 'ES修正のたびに ChatGPT に状況を説明し直すのが苦痛だった。フォルダを渡せばそれで済むのが本当にラク。' },
    { name: 'A.M.', grade: '28卒・早稲田', role: 'メガバンク内定', avatar: 'bg-gradient-to-br from-emerald-400 to-sky-400', body: 'スプレッドシートとカンバンを行き来しながら、並列で50社を回した。カレンダーの〆切管理が命綱。' },
    { name: 'R.S.', grade: '27卒・東大院', role: 'SaaS PdM 内定', avatar: 'bg-gradient-to-br from-amber-400 to-rose-400', body: 'Cursor で志望動機を下書きするのが定番になった。Markdown でバージョン管理もできて最高。' },
    { name: 'Y.H.', grade: '28卒・京大', role: '外資メーカー内定', avatar: 'bg-gradient-to-br from-violet-400 to-fuchsia-400', body: 'どの企業にも使い回せる「自己分析.md」を1つ育てていくと、面接準備が半分の時間で終わる。' },
  ];
  return (
    <section id="stories" className={'relative py-32 ' + t.bg2}>
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel
          n="04"
          subtitle="Real stories"
          theme={theme}
          title={<>先輩たちが、<br />どう使って内定を取ったか。</>}
          t={t}
        />
        <div className="grid md:grid-cols-2 gap-5">
          {testimonials.map((x, i) => (
            <figure key={i} className={'rounded-2xl p-7 border ' + t.border + ' ' + t.card}>
              <div className={'text-lg leading-relaxed ' + t.text}>&quot;{x.body}&quot;</div>
              <figcaption className="mt-6 flex items-center gap-3">
                <div className={'h-10 w-10 rounded-full ' + x.avatar} />
                <div>
                  <div className={'text-sm font-semibold ' + t.text}>
                    {x.name} <span className={'landing-mono text-[10px] ml-1 ' + t.textDim}>{x.grade}</span>
                  </div>
                  <div className={'text-xs ' + t.textMuted}>{x.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-4">
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
function DownloadSection({ t, theme, onSignIn }: { t: ThemeTokens; theme: ThemeKey; onSignIn: () => void }) {
  return (
    <section id="download" className={'relative py-32 overflow-hidden ' + t.bg}>
      <div className="absolute inset-0 pointer-events-none">
        <div className={'absolute inset-0 ' + t.aurora + ' opacity-80'} />
      </div>
      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <div className={'landing-mono text-xs ' + t.textDim}>— Start in 30 seconds —</div>
        <h2 className={'mt-5 text-5xl md:text-7xl font-black tracking-tight ' + t.text}>
          さあ、<span className={t.heading}>就活</span>を始めよう。
        </h2>
        <p className={'mt-5 text-lg ' + t.textMuted}>ダウンロード即無料。アカウント作成はワンクリックで完了。</p>

        <div className="mt-10 grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
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
            href={DL_WINDOWS}
            className={'group flex items-center justify-center gap-3 rounded-2xl px-6 py-5 text-base font-semibold transition ' + t.btnGhost}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 5.7L11 4v8H3V5.7zM3 12.3L11 12.3V20l-8-1.7v-6zM12 4v8h9V4.3L12 4zM12 12.3L21 12.3V19.7l-9-1.3v-6.1z" />
            </svg>
            <div className="text-left leading-tight">
              <div className="text-[10px] opacity-60 landing-mono">DOWNLOAD FOR</div>
              <div>Windows (x64)</div>
            </div>
          </a>
        </div>
        <div className={'mt-4 text-xs ' + t.textDim}>
          ブラウザ版は Chrome / Edge で{' '}
          <button type="button" onClick={onSignIn} className="underline">こちら</button>
        </div>

        <div className={'mt-12 inline-flex items-center gap-2 landing-mono text-[11px] ' + t.textDim}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 landing-pulse-dot" />
          <span>{APP_VERSION} · 自動アップデート対応</span>
          <span className={theme === 'dark' ? 'text-white/20' : 'text-slate-300'}>·</span>
          <span>Tauri 2 / Universal Binary</span>
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
        <div className={'rounded-2xl border ' + t.border + ' ' + t.card + ' divide-y ' + (theme === 'dark' ? 'divide-white/10' : 'divide-slate-200')}>
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="w-full text-left px-6 py-5 block"
              >
                <div className="flex items-center gap-4">
                  <div className={'landing-mono text-[10px] ' + t.textDim}>{String(i + 1).padStart(2, '0')}</div>
                  <div className={'flex-1 font-semibold ' + t.text}>{it.q}</div>
                  <div className={'text-xl transition-transform ' + t.textMuted + ' ' + (isOpen ? 'rotate-45' : '')}>+</div>
                </div>
                {isOpen && <div className={'mt-3 pl-10 text-sm leading-relaxed ' + t.textMuted}>{it.a}</div>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── Footer ─────────────────────────
function Footer({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
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
              © {new Date().getFullYear()} AIshukatsu. Made with ♡ for 28卒.
            </div>
          </div>
          {[
            { h: 'プロダクト', l: ['機能', '選考管理', 'AI連携', 'ダウンロード', 'ロードマップ'] },
            { h: 'リソース', l: ['ドキュメント', 'テンプレート', 'GitHub', 'リリースノート', '変更履歴'] },
            { h: '法務', l: ['利用規約', 'プライバシーポリシー', '特定商取引法', 'お問い合わせ'] },
          ].map((col, i) => (
            <div key={i}>
              <div className={'text-xs landing-mono uppercase tracking-widest ' + t.textDim}>{col.h}</div>
              <ul className={'mt-3 space-y-2 text-sm ' + t.textMuted}>
                {col.l.map((x) => (
                  <li key={x}><a href="#" className="hover:opacity-100 opacity-80">{x}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={'mt-16 pt-8 border-t flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ' + t.border}>
          <div className={'text-5xl md:text-7xl font-black tracking-tighter ' + t.textDim}>AI SHUKATSU.</div>
          <div className={'text-xs landing-mono flex items-center gap-3 ' + t.textDim}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 landing-pulse-dot" />
            <span>all systems operational</span>
            <span>·</span>
            <span>aisyuukatsu-30fdd.web.app</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ───────────────────────── Theme toggle ─────────────────────────
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
interface Props {
  onSignIn: () => void;
}

const THEME_STORAGE_KEY = 'aishukatsu-landing-theme';

export function LandingPage({ onSignIn }: Props) {
  const [theme, setThemeState] = useState<ThemeKey>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  const setTheme = (v: ThemeKey) => {
    setThemeState(v);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const t = themes[theme];

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      onSignIn();
    } catch (e) {
      console.error('Sign-in failed', e);
    }
  };

  return (
    <div className={'min-h-screen overflow-x-hidden ' + t.bg + ' ' + t.text}>
      <LandingStyles />
      <Nav t={t} theme={theme} onSignIn={handleSignIn} />
      <Hero t={t} theme={theme} onSignIn={handleSignIn} />
      <LogoStrip t={t} />
      <AISection t={t} theme={theme} />
      <Features t={t} theme={theme} />
      <ViewsSection t={t} theme={theme} />
      <Stories t={t} theme={theme} />
      <DownloadSection t={t} theme={theme} onSignIn={handleSignIn} />
      <FAQ t={t} theme={theme} />
      <Footer t={t} theme={theme} />
      <ThemeToggle theme={theme} setTheme={setTheme} />
    </div>
  );
}
