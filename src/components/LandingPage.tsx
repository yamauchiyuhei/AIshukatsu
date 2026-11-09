import { useEffect, useRef, useState, type FormEvent } from 'react';
import './landing.css';
import { WebsiteHeader, useWebsiteDevice } from './website/WebsiteHeader';
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
    bg: 'bg-[var(--landing-bg-dark)]',
    bg2: 'bg-[var(--landing-panel-dark)]',
    text: 'text-[var(--landing-white)]',
    textMuted: 'text-[var(--landing-white-60)]',
    textDim: 'text-[var(--landing-white-65)]',
    border: 'border-[var(--landing-white-10)]',
    card: 'bg-[var(--landing-white-3)]',
    cardHover: 'hover:bg-[var(--landing-white-6)]',
    glass: 'bg-[var(--landing-white-4)] backdrop-blur-xl border border-[var(--landing-white-10)]',
    btn: 'bg-[var(--landing-white)] text-[var(--landing-black)] hover:bg-[var(--landing-white-90)]',
    btnGhost: 'border border-[var(--landing-white-15)] text-[var(--landing-white)] hover:bg-[var(--landing-white-5)]',
    chip: 'bg-[var(--landing-white-5)] border border-[var(--landing-white-10)] text-[var(--landing-white-70)]',
    grid: 'landing-plain',
    aurora: 'landing-plain',
    heading: 'landing-solid-heading',
  },
  light: {
    bg: 'bg-[var(--landing-bg-light)]',
    bg2: 'bg-[var(--landing-white)]',
    text: 'text-[var(--landing-slate-900)]',
    textMuted: 'text-[var(--landing-slate-600)]',
    textDim: 'text-[var(--landing-slate-600)]',
    border: 'border-[var(--landing-slate-200)]',
    card: 'bg-[var(--landing-white)]',
    cardHover: 'hover:bg-[var(--landing-slate-50)]',
    glass: 'bg-[var(--landing-white-70)] backdrop-blur-xl border border-[var(--landing-slate-200)]',
    btn: 'bg-[var(--landing-slate-900)] text-[var(--landing-white)] hover:bg-[var(--landing-slate-800)]',
    btnGhost: 'border border-[var(--landing-slate-300)] text-[var(--landing-slate-800)] hover:bg-[var(--landing-slate-100)]',
    chip: 'bg-[var(--landing-slate-100)] border border-[var(--landing-slate-200)] text-[var(--landing-slate-700)]',
    grid: 'landing-plain',
    aurora: 'landing-plain',
    heading: 'landing-solid-heading',
  },
};

// ───────────────────────── inline CSS (scoped to landing) ─────────────────────────
const LandingStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    .landing-mono { font-family: var(--font-body); }
    .landing-serif { font-family: var(--font-body); font-style: normal; }
    [data-reveal], [data-stagger] > * { opacity: 1; transform: none; }
    [data-stagger][data-revealed="true"] > * { opacity: 1; transform: none; }
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
// ───────────────────────── Hero ─────────────────────────
function Hero({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
  const mobile = useWebsiteDevice() === 'mobile';
  return (
    <section className={'landing-hero relative pb-10 pt-10 md:pt-16 ' + t.bg}>
      <div aria-hidden="true" className={'pointer-events-none absolute inset-0 ' + t.grid} />
      <div aria-hidden="true" className={'pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[900px] -translate-x-1/2 ' + t.aurora} />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-6">

        <h1 className={'landing-sans-jp mt-4 max-w-4xl text-[clamp(32px,4.5vw,56px)] font-bold leading-[1.2] tracking-tight ' + t.text}>
          応募先、ES、面接日程を<br className="hidden sm:block" />ひとつにまとめる。
        </h1>
        <p className={'mt-5 max-w-2xl text-base leading-relaxed md:text-lg ' + t.textMuted}>
          企業ごとに選考の進捗とメモを整理し、次の締切を確認できます。
          保存したメモは、必要に応じてClaudeやChatGPTでのES・面接準備にも使えます。
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a href={mobile ? "/magazine/" : "/app/"} className={'inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold ' + t.btn}>{mobile ? "就活の記事を読む" : "Web版を使う"}</a>
          <a href={mobile ? "#start" : "#download"} className={'inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold ' + t.btnGhost}>{mobile ? "PCでのはじめ方" : "Mac・Windows版"}</a>
        </div>
        <p className={'mt-3 text-sm ' + t.textMuted}>無料。Web版はPCのChrome・Edgeに対応</p>
        <div id="demo" className="relative mt-10">

          <HeroScreen t={t} theme={theme} />
          <a href="#views" className={'mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4 ' + t.text}>表・カンバン・カレンダーを見る</a>
        </div>
      </div>
    </section>
  );
}

function HeroScreen(_: { t: ThemeTokens; theme: ThemeKey }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <figure className="landing-product-capture">
    <button type="button" className="landing-capture-open" onClick={() => dialog.current?.showModal()} aria-label="アプリの画面例を拡大する">
      <img src="/site/workspace-sample-app.png" width={1440} height={440} alt="AI就活で企業研究メモを編集する画面。架空の企業のサンプルです。" loading="eager" fetchPriority="high" decoding="async" />
    </button>
    <figcaption>企業研究メモの画面例。タップで拡大できます。表示内容は架空のサンプルです。</figcaption>
    <dialog ref={dialog} className="landing-image-dialog" aria-label="アプリの画面例" onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <form method="dialog"><button autoFocus>閉じる</button></form>
      <div><img src="/site/workspace-sample-app.png" alt="AI就活の画面全体。横にスクロールして確認できます。" width={1440} height={440} /></div>
      <p>横にスクロールして画面全体を確認できます。</p>
    </dialog>
  </figure>;
}

function GettingStarted({ t }: { t: ThemeTokens }) {
  const mobile = useWebsiteDevice() === 'mobile';
  const [message, setMessage] = useState('');
  return <section id="start" className={'py-16 ' + t.bg2}><div className="mx-auto max-w-6xl px-6">
    <h2 className="text-3xl font-bold">最初の1社から、始めよう。</h2>
    <p className={'mt-4 leading-7 ' + t.textMuted}>PCのChrome・Edge、またはMac・Windows版で使えます。Googleログインは任意です。</p>
    <ol className="landing-start-steps">{[
      ['保存先を選ぶ', 'PC内に就活用フォルダを作ります。以前のフォルダもそのまま使えます。'],
      ['気になる企業を追加', '企業研究やESのメモを用意します。企業選びは後からでも大丈夫です。'],
      ['次の締切を登録', '選考管理の表に締切と次の行動を記入。表・カンバン・カレンダーで確認できます。'],
    ].map(([title, body], i) => <li key={title}><span>{i + 1}</span><h3>{title}</h3><p className={t.textMuted}>{body}</p></li>)}</ol>
    <div className="mt-6 flex flex-wrap items-center gap-4">{mobile ? <><p className={'text-sm ' + t.textMuted}>スマートフォンでは記事を閲覧できます。アプリの操作はPCで続けてください。</p><button type="button" className={'min-h-11 rounded-xl px-5 text-sm font-semibold ' + t.btn} onClick={async () => { try { await navigator.clipboard.writeText('https://aishukatsu.net/#start'); setMessage('URLをコピーしました。PCに送って開いてください。'); } catch { setMessage('PCで https://aishukatsu.net/#start を開いてください。'); } }}>PCで開くURLをコピー</button></> : <a href="/app/" className={'inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold ' + t.btn}>Web版で始める</a>}<a className="underline" href="#download">Mac・Windows版の案内</a></div>
    <p role="status" className="mt-3 text-sm">{message}</p>
  </div></section>;
}

// ───────────────────────── Marquee ─────────────────────────
function LogoStrip({ t }: { t: ThemeTokens }) {
  const items = [
    '企業名を検索して追加',
    '締切と選考の進捗をまとめる',
    '企業ごとにメモを残す',
    'PC内のフォルダに保存',
    'バックアップは任意',
  ];
  return (
    <section className={'py-10 border-y ' + t.border + ' ' + t.bg2 + ' overflow-hidden'}>
      <div className="relative">
        <div className="landing-capabilities">
          {items.map((s, i) => (
            <div key={i} className={'flex items-center gap-2 ' + t.textMuted}>

              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── Section label ─────────────────────────
function SectionLabel({ title, t }: {
  n: string; title: React.ReactNode; subtitle: string; t: ThemeTokens; theme: ThemeKey;
}) {
  return <div className="mb-10" data-reveal>
    <h2 className={'landing-sans-jp text-3xl font-bold leading-snug md:text-5xl ' + t.text}>{title}</h2>
  </div>;
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
          title={<>研究メモを活かして、<br /><span className="landing-serif font-normal">ES・面接の準備</span>を進める。</>}
          t={t}
        />
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <div className="order-2 lg:order-1">
            <p className={'text-lg md:text-xl leading-relaxed ' + t.textMuted}>
              <span className={t.text}>企業研究と自分の経験をまとめたメモ</span>を、お使いのAIに渡して相談できます。AIの回答は参考にしながら、自分の言葉でESや面接の回答を仕上げましょう。
            </p>
            <div className="mt-8 space-y-3">
              {[
                { k: '1', v: '企業の特徴と自分の経験をメモする' },
                { k: '2', v: '必要なメモを選び、ChatGPTやClaudeに渡す' },
                { k: '3', v: '回答を確かめ、自分の言葉で書き直す' },
              ].map((s) => (
                <div key={s.k} className={'flex gap-4 rounded-xl p-4 ' + t.glass}>
                  <div className={'landing-mono text-xs h-7 w-7 grid place-items-center rounded-lg shrink-0 ' + (theme === 'dark' ? 'bg-[var(--landing-white)] text-[var(--landing-black)]' : 'bg-[var(--landing-slate-900)] text-[var(--landing-white)]')}>
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
    <div className="relative rounded-2xl overflow-hidden border border-[var(--landing-white-10)] bg-[var(--landing-black)]">
      <div className="p-5 landing-mono text-[12px] leading-relaxed text-[var(--landing-white-80)]">
        <div className="text-[var(--landing-white-40)]">$ tree 就活2028/株式会社サンプルA</div>
        <div className="mt-2 text-[var(--landing-white-70)]">
          <div>株式会社サンプルA/</div>
          <div>├── <span className="text-[var(--landing-indigo-300)]">選考状況.md</span></div>
          <div>├── <span className="text-[var(--landing-indigo-300)]">企業分析.md</span></div>
          <div>├── <span className="text-[var(--landing-indigo-300)]">ES・面接対策.md</span></div>
          <div>├── <span className="text-[var(--landing-indigo-300)]">説明会・イベントメモ.md</span></div>
          <div>└── <span className="text-[var(--landing-indigo-300)]">インターン.md</span></div>
        </div>
        <div className="mt-4 text-[var(--landing-white-40)]"># Claude に聞く</div>
        <div className="mt-1 text-[var(--landing-emerald-300)]">&gt; 次の1次面接までに準備すべき逆質問を3つ、</div>
        <div className="text-[var(--landing-emerald-300)]">&nbsp;&nbsp;この企業の分析と私のガクチカを踏まえて考えて</div>
        <div className="mt-3 text-[var(--landing-white-60)]">
          <div><span className="text-[var(--landing-pink-300)]">Claude:</span> 分析.mdの「デザイン部門の独立」に</div>
          <div>絡めると、あなたの強みと接続しやすいです。</div>
          <div>以下、候補を3つ提案します <span className="landing-blink">▊</span></div>
        </div>
        <p className="mt-4 text-sm">AIへの質問と回答の例です。</p>
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
        <svg aria-hidden="true" {...featureSvgProps}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        </svg>
      ),
      title: 'メモは、自分のPCに保存',
      body: '選んだフォルダにメモを保存します。別のPCへの移行も、フォルダをコピーするだけです。',
    },
    {
      icon: (
        <svg aria-hidden="true" {...featureSvgProps}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
      title: '見出しや箇条書きで、考えを整理',
      body: '普段のノートのように入力できます。見出し・箇条書き・チェックリストを使って読みやすくまとめましょう。',
    },
    {
      icon: (
        <svg aria-hidden="true" {...featureSvgProps}>
          <rect x="4" y="3" width="16" height="18" rx="1.5" />
          <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
          <path d="M10 21v-3a2 2 0 0 1 4 0v3" />
        </svg>
      ),
      title: '企業ごとに、準備用のメモを用意',
      body: '企業を追加すると、選考状況・企業研究・ESや面接対策など、5種類のひな形を用意します。',
    },
    {
      icon: (
        <svg aria-hidden="true" {...featureSvgProps}>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      title: 'バックアップは、必要なときに',
      body: 'Googleでログインすると、選考管理の表をクラウドにバックアップできます。パスワード欄は暗号化して保存します。',
    },
  ];
  return (
    <section id="features" className={'relative py-32 ' + t.bg2}>
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel
          n="02"
          subtitle="Core features"
          theme={theme}
          title={<>企業研究も、選考管理も。<br />準備を進める4つの機能。</>}
          t={t}
        />
        <div className="grid md:grid-cols-2 gap-5" data-stagger>
          {items.map((f, i) => (
            <div
              key={i}
              className={'group relative rounded-2xl p-8 border overflow-hidden transition-colors ' + t.border + ' ' + t.card + ' hover:-translate-y-0.5'}
            >
              <div className="relative">
                <div className="mb-4 inline-flex items-center">
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
  { name: '未応募', color: 'bg-[var(--landing-slate-400)]' },
  { name: 'エントリー済', color: 'bg-[var(--landing-sky-400)]' },
  { name: 'ES提出済', color: 'bg-[var(--landing-blue-500)]' },
  { name: 'GD', color: 'bg-[var(--landing-cyan-500)]' },
  { name: 'Webテスト', color: 'bg-[var(--landing-teal-500)]' },
  { name: '1次面接', color: 'bg-[var(--landing-indigo-500)]' },
  { name: '2次面接', color: 'bg-[var(--landing-violet-500)]' },
  { name: '最終面接', color: 'bg-[var(--landing-amber-500)]' },
  { name: '内定', color: 'bg-[var(--landing-emerald-500)]' },
  { name: 'お祈り', color: 'bg-[var(--landing-rose-400)]' },
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
    <span className="landing-status">
      <span className={'h-1.5 w-1.5 rounded-full ' + (found?.color || 'bg-[var(--landing-slate-400)]')} />
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
              className={'min-h-11 rounded-xl px-2 py-1.5 text-xs sm:px-4 sm:text-sm transition ' + (tab === v.id ? (theme === 'dark' ? 'bg-[var(--landing-white)] text-[var(--landing-black)]' : 'bg-[var(--landing-slate-900)] text-[var(--landing-white)]') : 'opacity-70 hover:opacity-100')}
            >
              {v.label}
            </button>
          ))}
        </div>
        <p className={'mb-3 text-sm md:hidden ' + t.textMuted}>画面例は横にスクロールできます。</p>
        <div role="region" aria-label="選考管理の画面例" tabIndex={0} className={'overflow-x-auto rounded-2xl border ' + t.border + ' ' + (theme === 'dark' ? 'bg-[var(--landing-panel-dark)]' : 'bg-[var(--landing-white)]')}>
          {tab === 'sheet' && <SheetView t={t} theme={theme} />}
          {tab === 'kanban' && <KanbanView t={t} />}
          {tab === 'calendar' && <CalendarView t={t} theme={theme} />}
        </div>
      </div>
    </section>
  );
}

function SheetView({ t, theme }: { t: ThemeTokens; theme: ThemeKey }) {
  const headerBg = theme === 'dark' ? 'bg-[var(--landing-white-4)]' : 'bg-[var(--landing-slate-50)]';
  const rowBorder = theme === 'dark' ? 'border-[var(--landing-white-5)]' : 'border-[var(--landing-slate-100)]';
  return (
    <div className="min-w-[740px] text-sm">
      <div className={'grid grid-cols-[36px_2fr_1.3fr_1fr_1fr_0.8fr] ' + headerBg + ' ' + (theme === 'dark' ? 'text-[var(--landing-white-60)]' : 'text-[var(--landing-slate-500)]') + ' text-xs landing-mono '}>
        {['#', '企業名', 'ステータス', '業界', '次アクション', '評価'].map((h, i) => (
          <div key={i} className="px-4 py-3 border-r border-[var(--landing-white-5)]">{h}</div>
        ))}
      </div>
      {COMPANIES.map((row, i) => (
        <div
          key={i}
          className={'grid grid-cols-[36px_2fr_1.3fr_1fr_1fr_0.8fr] border-t ' + rowBorder + ' items-center ' + (i % 2 && theme === 'dark' ? 'bg-[var(--landing-white-1)]' : '')}
        >
          <div className={'px-4 py-3 landing-mono text-xs ' + t.textDim}>{String(i + 1).padStart(2, '0')}</div>
          <div className={'px-4 py-3 font-medium ' + t.text}>{row.c}</div>
          <div className="px-4 py-3"><StatusBadge s={row.s} /></div>
          <div className={'px-4 py-3 ' + t.textMuted}>{row.i}</div>
          <div className={'px-4 py-3 landing-mono ' + t.textMuted}>{row.d}</div>
          <div className="px-4 py-3">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <svg key={n} aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill={n <= row.r ? 'currentColor' : 'none'} className="landing-rating" stroke="currentColor"><path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" /></svg>
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
          const accent = STATUS.find((s) => s.name === col)?.color || 'bg-[var(--landing-slate-400)]';
          return (
            <div key={col} className="w-64 shrink-0">
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className={'h-1.5 w-1.5 rounded-full ' + accent} />
                <div className={'text-xs font-semibold ' + t.text}>{col}</div>
                <div className={'landing-mono text-xs ' + t.textDim}>{cards.length}</div>
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
                    <div className={'text-xs mt-1 ' + t.textMuted}>{c.i}</div>
                    <div className={'mt-3 flex items-center justify-between text-xs ' + t.textDim}>
                      <span className="landing-mono">{c.d}</span>
                      <span>評価 {c.r}/5</span>
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
    5: [{ c: 'ブルーフィン', s: '1次面接', color: 'bg-[var(--landing-indigo-500)]' }],
    8: [{ c: 'Reverie Labs', s: 'ES〆切', color: 'bg-[var(--landing-blue-500)]' }],
    12: [{ c: 'Polaris', s: 'Webテスト', color: 'bg-[var(--landing-teal-500)]' }],
    15: [{ c: 'NovaMedia', s: '2次面接', color: 'bg-[var(--landing-violet-500)]' }],
    18: [{ c: 'サンプル商事', s: '最終面接', color: 'bg-[var(--landing-amber-500)]' }],
    22: [{ c: 'Helios', s: '内定承諾〆', color: 'bg-[var(--landing-emerald-500)]' }],
    25: [{ c: 'メタリノ', s: 'エントリー〆', color: 'bg-[var(--landing-sky-500)]' }],
  };
  const days = Array.from({ length: 35 }, (_, i) => i - 2);
  const today = 12;
  return (
    <div className="min-w-[650px] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className={'text-base font-bold ' + t.text}>2028年 5月</div>
        <span className={'text-xs ' + t.textMuted}>表示例</span>
      </div>
      <div className={'grid grid-cols-7 text-xs landing-mono mb-1 ' + t.textDim}>
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
              className={'min-h-[84px] border-r border-b p-1.5 ' + t.border + ' ' + (inMonth ? '' : theme === 'dark' ? 'bg-[var(--landing-white-1)]' : 'bg-[var(--landing-slate-50-60)]')}
            >
              <div className={'flex items-center justify-end text-xs ' + (d === today ? 'font-bold' : t.textDim)}>
                {inMonth && (d === today
                  ? <span className={'h-5 w-5 grid place-items-center rounded-full ' + (theme === 'dark' ? 'bg-[var(--landing-white)] text-[var(--landing-black)]' : 'bg-[var(--landing-slate-900)] text-[var(--landing-white)]')}>{d}</span>
                  : d)}
              </div>
              <div className="mt-1 space-y-0.5">
                {evs.map((e, j) => (
                  <div key={j} className={'text-xs px-1.5 py-0.5 rounded text-[var(--landing-white)] ' + e.color}>
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
            { tag: 'ESの下書き', title: 'ES 量産期', body: '企業ごとに締切と提出先を記録。ひな形を使って、ESの下書きを残せます。' },
            { tag: '面接の準備', title: '面接ラッシュ', body: 'カレンダーで日程、カンバンで進捗、企業ごとのメモで準備内容を確認できます。' },
            { tag: '内定後の比較', title: '内定承諾検討', body: '企業ごとの条件と自分が大切にしたいことを並べて、選ぶ理由を整理できます。' },
          ].map((u, i) => (
            <div key={i} className={'rounded-2xl p-6 border ' + t.border + ' ' + t.card}>
              <div className={'landing-mono text-xs ' + t.textDim}>{u.tag}</div>
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
  const device = useWebsiteDevice();
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
        <p className={'mt-3 text-sm ' + t.textMuted}>{device === 'mac' ? 'この端末にはMac版がおすすめです。Web版も選べます。' : device === 'windows' ? 'この端末にはWindows版がおすすめです。Web版も選べます。' : device === 'mobile' ? 'ダウンロードとインストールはPCで行ってください。' : 'お使いのPCに合う版を選んでください。'}</p>

        <div className="mt-10 grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto" data-stagger>
          <a
            href={DL_MACOS}
            className={'group flex items-center justify-center gap-3 rounded-2xl px-6 py-5 text-base font-semibold transition ' + t.btn}
          >
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <div className="text-left leading-tight">
              <div className="text-xs opacity-60 landing-mono">対応OS</div>
              <div>Mac版をダウンロード</div><small>Apple Silicon / Intel 両対応</small>
            </div>
          </a>
          <a
            href={GITHUB_RELEASE}
            className={'group flex items-center justify-center gap-3 rounded-2xl px-6 py-5 text-base font-semibold transition ' + t.btnGhost}
          >
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 5.7L11 4v8H3V5.7zM3 12.3L11 12.3V20l-8-1.7v-6zM12 4v8h9V4.3L12 4zM12 12.3L21 12.3V19.7l-9-1.3v-6.1z" />
            </svg>
            <div className="text-left leading-tight">
              <div className="text-xs opacity-60 landing-mono">対応OS</div>
              <div>Windows版の配布ページ</div><small>x64 / ARM64 を選択できます</small>
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
    { q: '本当にデータはローカルのみ？', a: 'メモの本文は、選んだPC内のフォルダに保存されます。選考管理の表は、Googleログイン後にクラウドへバックアップできます。パスワード欄は暗号化します。' },
    { q: 'Safari / Firefox では動きませんか？', a: 'アプリの操作はPCのChrome・Edge、またはMac・Windows版をご利用ください。記事はスマートフォンやSafari・Firefoxでも閲覧できます。' },
    { q: 'Claude や Cursor は必須ですか？', a: 'いいえ。AI を使わなくても普通の就活管理ツールとして完結します。AI を使う場合は生成したフォルダをドラッグ&ドロップするだけです。' },
    { q: '完全無料ですか？', a: 'はい、MVP 期間中は完全無料。将来的に有料プランを検討する場合でも、既存のあなたのデータが人質になることはありません（自分のPCに全部残っています）。' },
    { q: 'データ移行は？', a: 'フォルダごとコピーして別のPCで開けます。メモは一般的なMarkdown形式なので、対応する他のアプリでも読めます。' },
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
                  className="flex w-full items-center gap-4 px-5 py-3 text-left"
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
            <div className={'mt-6 landing-mono text-xs ' + t.textDim}>
              © {new Date().getFullYear()} AI就活
            </div>
          </div>
          {columns.map((col, i) => (
            <div key={i}>
              <div className={'text-xs landing-mono ' + t.textDim}>{col.h}</div>
              <ul className={'mt-3 space-y-2 text-sm ' + t.textMuted}>
                {col.l.map((x) => (
                  <li key={x.label}>
                    {x.onClick ? (
                      <button
                        type="button"
                        id={x.id}
                        onClick={x.onClick}
                        className="min-h-11 whitespace-nowrap opacity-80 transition-colors hover:opacity-100"
                      >
                        {x.label}
                      </button>
                    ) : (
                      <a
                        href={x.href ?? '#'}
                        className="min-h-11 whitespace-nowrap opacity-80 transition-colors hover:opacity-100"
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
      ? 'bg-[var(--landing-white-5)] border-[var(--landing-white-10)] text-[var(--landing-white)] placeholder-white/30 focus:border-[var(--landing-white-30)]'
      : 'bg-[var(--landing-white)] border-[var(--landing-slate-300)] text-[var(--landing-slate-900)] placeholder-slate-400 focus:border-[var(--landing-slate-500)]');

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
    (isDark ? 'bg-[var(--landing-panel-dark)] border-[var(--landing-white-10)]' : 'bg-[var(--landing-white)] border-[var(--landing-slate-200)]');
  const headerBorder = isDark ? 'border-[var(--landing-white-10)]' : 'border-[var(--landing-slate-200)]';

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
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {status === 'sent' ? (
            <div role="status" className="space-y-4 py-6 text-center">
              <div className={'mx-auto grid h-12 w-12 place-items-center rounded-full ' + (isDark ? 'bg-[var(--landing-emerald-500-15)] text-[var(--landing-emerald-300)]' : 'bg-[var(--landing-emerald-50)] text-[var(--landing-emerald-600)]')}>
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
                  お名前 <span className="text-[var(--landing-rose-400)]">*</span>
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
                  メールアドレス <span className="text-[var(--landing-rose-400)]">*</span>
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
                  お問い合わせ内容 <span className="text-[var(--landing-rose-400)]">*</span>
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
                      ? 'border-[var(--landing-rose-500-30)] bg-[var(--landing-rose-500-10)] text-[var(--landing-rose-200)]'
                      : 'border-[var(--landing-rose-200)] bg-[var(--landing-rose-50)] text-[var(--landing-rose-700)]')
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

              <div className={'pt-2 text-xs ' + t.textDim}>
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
          ? 'bg-[var(--landing-white-10)] border border-[var(--landing-white-15)] text-[var(--landing-white)] hover:bg-[var(--landing-white-20)]'
          : 'bg-[var(--landing-white)] border border-[var(--landing-slate-200)] text-[var(--landing-slate-900)] hover:bg-[var(--landing-slate-50)]')
      }
    >
      {theme === 'dark' ? (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
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
        if (!['start', 'features', 'views', 'ai', 'stories', 'magazine', 'download', 'faq', 'demo'].includes(id)) return;
        frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'instant' }));
      } catch { /* an invalid fragment does not block the public website */ }
    };
    if (document.readyState === 'complete') scrollToSection();
    else window.addEventListener('load', scrollToSection, { once: true });
    return () => { window.removeEventListener('load', scrollToSection); cancelAnimationFrame(frame); };
  }, []);

  return (
    <div data-theme={theme} className={'landing-page min-h-screen ' + t.bg + ' ' + t.text}>
      <LandingStyles />
      <a href="#landing-main" className={'landing-skip rounded-lg px-4 py-3 ' + t.btn}>本文に進む</a>
      <WebsiteHeader theme={theme} onThemeChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
      <main id="landing-main" tabIndex={-1}>
        <Hero t={t} theme={theme} />
        <LogoStrip t={t} />
        <GettingStarted t={t} />
        <Features t={t} theme={theme} />
        <ViewsSection t={t} theme={theme} />
        <AISection t={t} theme={theme} />
        <Stories t={t} theme={theme} />
        <LandingMagazine theme={theme} />
        <DownloadSection t={t} />
        <FAQ t={t} theme={theme} />
      </main>
      <Footer t={t} theme={theme} />

    </div>
  );
}
