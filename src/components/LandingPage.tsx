import { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { signInWithGoogle } from '../spreadsheet/lib/firebase';

const GITHUB_RELEASE =
  'https://github.com/yamauchiyuhei/AIshukatsu/releases/latest';
const DL_MACOS =
  `${GITHUB_RELEASE}/download/AIshukatsu_universal.app.tar.gz`;
const DL_WINDOWS = GITHUB_RELEASE;

interface Props {
  onSignIn: () => void;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
function useCountUp(end: number, duration = 1800) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const s = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - s) / duration, 1);
          setValue(Math.round((1 - Math.pow(1 - t, 3)) * end));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [end, duration]);
  return { ref, value };
}

function useTilt() {
  const ref = useRef<HTMLDivElement | null>(null);
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale(1.03)`;
  }, []);
  const onLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = '';
  }, []);
  return { ref, onMove, onLeave };
}

// ---------------------------------------------------------------------------
// Floating particles component
// ---------------------------------------------------------------------------
function Particles() {
  return (
    <div className="lp-particles" aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => (
        <div
          key={i}
          className="lp-particle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDuration: `${6 + Math.random() * 10}s`,
            animationDelay: `${Math.random() * 5}s`,
            width: `${2 + Math.random() * 4}px`,
            height: `${2 + Math.random() * 4}px`,
            opacity: 0.15 + Math.random() * 0.25,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export function LandingPage({ onSignIn }: Props) {
  const featuresRef = useRef<HTMLDivElement | null>(null);
  const downloadRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [navSolid, setNavSolid] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Scroll-triggered fade-ins
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) e.target.classList.add('lp-visible');
    }, { threshold: 0.1 });
    document.querySelectorAll('.lp-fade-in,.lp-slide-left,.lp-slide-right').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Mouse glow orb
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const onMove = (e: MouseEvent) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', `${e.clientX - r.left}px`);
      hero.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    hero.addEventListener('mousemove', onMove);
    return () => hero.removeEventListener('mousemove', onMove);
  }, []);

  // Scroll: nav + progress bar + parallax
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setNavSolid(y > 60);
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(total > 0 ? (y / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSignIn = async () => {
    try { await signInWithGoogle(); onSignIn(); } catch (e) { console.error('Sign-in failed', e); }
  };
  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const stat1 = useCountUp(2400);
  const stat2 = useCountUp(12);
  const stat3 = useCountUp(3);

  return (
    <div className="lp">
      {/* Scroll progress bar */}
      <div className="lp-progress" style={{ width: `${scrollProgress}%` }} />
      <div className="lp-noise" aria-hidden="true" />

      {/* ── Nav ── */}
      <nav className={`lp-nav ${navSolid ? 'lp-nav--solid' : ''}`}>
        <div className="lp-nav__inner">
          <div className="lp-nav__brand">
            <img src="/logo.png" alt="AI就活" className="lp-nav__logo" />
            <span className="lp-nav__name">AI就活</span>
          </div>
          <div className="lp-nav__links">
            <button type="button" onClick={() => scrollTo(featuresRef)} className="lp-nav__link">機能</button>
            <button type="button" onClick={() => scrollTo(downloadRef)} className="lp-nav__link">ダウンロード</button>
            <button type="button" onClick={handleSignIn} className="lp-nav__cta lp-shine">
              Web版を使う <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section ref={heroRef} className="lp-hero">
        <div className="lp-hero__bg">
          <div className="lp-hero__bg-image" />
          <div className="lp-hero__dots" />
          <Particles />
          <div className="lp-hero__orb lp-hero__orb--1" />
          <div className="lp-hero__orb lp-hero__orb--2" />
          <div className="lp-hero__orb lp-hero__orb--3" />
          <div className="lp-hero__orb-mouse" />
        </div>
        <div className="lp-hero__content">
          <div className="lp-hero__badge lp-anim-word" style={{ animationDelay: '0s' }}>
            <Sparkles size={13} />
            <span>就活効率化ツール</span>
          </div>
          <h1 className="lp-hero__title">
            <span className="lp-hero__gradient lp-anim-word" style={{ animationDelay: '0.15s' }}>
              AI が就活を加速する。
            </span>
          </h1>
          <p className="lp-hero__subtitle lp-anim-word" style={{ animationDelay: '0.55s' }}>
            企業研究・ES・面接・スケジュール。
            <br className="hidden sm:inline" />
            就活のすべてをこれ一つで。
          </p>
          <div className="lp-hero__actions lp-anim-word" style={{ animationDelay: '0.7s' }}>
            <button type="button" onClick={handleSignIn} className="lp-btn lp-btn--primary lp-shine">
              Web版を無料で使う <ArrowRight size={16} className="lp-btn__arrow" />
            </button>
            <button type="button" onClick={() => scrollTo(downloadRef)} className="lp-btn lp-btn--secondary">
              <Download size={16} /> デスクトップ版をダウンロード
            </button>
          </div>
          <button type="button" onClick={() => scrollTo(featuresRef)} className="lp-hero__scroll-hint" aria-label="下にスクロール">
            <ChevronDown size={20} />
          </button>
        </div>
      </section>

      {/* ── Wave ── */}
      <div className="lp-wave" aria-hidden="true">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,50 1440,40 L1440,80 L0,80 Z" fill="#f8faff" />
        </svg>
      </div>

      {/* ── Stats ── */}
      <section className="lp-stats">
        <div className="lp-section-inner">
          <div className="lp-stats__grid">
            <div className="lp-stats__item lp-fade-in" ref={stat1.ref}>
              <Building2 size={20} className="lp-stats__icon" />
              <span className="lp-stats__number">{stat1.value.toLocaleString()}+</span>
              <span className="lp-stats__label">企業テンプレート</span>
              <div className="lp-stats__bar"><div className="lp-stats__bar-fill" style={{ width: `${(stat1.value / 2400) * 100}%` }} /></div>
            </div>
            <div className="lp-stats__item lp-fade-in" ref={stat2.ref}>
              <LayoutGrid size={20} className="lp-stats__icon" />
              <span className="lp-stats__number">{stat2.value}</span>
              <span className="lp-stats__label">業界カテゴリ</span>
              <div className="lp-stats__bar"><div className="lp-stats__bar-fill" style={{ width: `${(stat2.value / 12) * 100}%` }} /></div>
            </div>
            <div className="lp-stats__item lp-fade-in" ref={stat3.ref}>
              <Users size={20} className="lp-stats__icon" />
              <span className="lp-stats__number">{stat3.value}</span>
              <span className="lp-stats__label">ビュー (表・Kanban・カレンダー)</span>
              <div className="lp-stats__bar"><div className="lp-stats__bar-fill" style={{ width: `${(stat3.value / 3) * 100}%` }} /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section ref={featuresRef} className="lp-features">
        <div className="lp-section-inner">
          <h2 className="lp-section-title lp-fade-in">就活に必要な機能を、すべてひとつに</h2>
          <p className="lp-section-subtitle lp-fade-in">
            AI就活 は就職活動に特化した統合プラットフォームです。
            <br className="hidden sm:inline" />
            複数のツールを行き来する必要はもうありません。
          </p>
          <div className="lp-features__grid">
            <FeatureCard icon={<Kanban size={24} />} title="就活スプレッドシート" description="表・Kanban・カレンダーの 3 ビューで選考状況を一覧管理。ES 締切・面接日程も一目瞭然。" delay={0} dir="left" />
            <FeatureCard icon={<FileText size={24} />} title="WYSIWYG エディタ" description="Markdown ベースのリッチエディタで企業分析・ES 下書き・面接メモを作成。色・装飾・見出しも自由自在。" delay={1} dir="right" />
            <FeatureCard icon={<Sparkles size={24} />} title="AI 企業分析" description="Gemini + Google 検索で企業情報を自動生成。オンボーディング時に選択した企業の資料が即座に揃います。" delay={2} dir="left" />
            <FeatureCard icon={<Shield size={24} />} title="ローカルファースト" description="データはあなたの PC に保存。クラウド同期は任意の暗号化バックアップとして使えます。" delay={3} dir="right" />
            <FeatureCard icon={<CalendarDays size={24} />} title="カレンダー & Kanban" description="ES 提出・面接・Web テストのスケジュールをカレンダーで俯瞰。Kanban でステータス管理も。" delay={4} dir="left" />
            <FeatureCard icon={<Monitor size={24} />} title="マルチフォーマット対応" description="Markdown だけでなく、PDF・画像・Word・Excel もアプリ内で閲覧。企業フォルダを丸ごと管理。" delay={5} dir="right" />
          </div>
        </div>
      </section>

      {/* ── Download ── */}
      <section ref={downloadRef} className="lp-download">
        <div className="lp-section-inner">
          <h2 className="lp-section-title lp-fade-in">デスクトップでも、ブラウザでも</h2>
          <p className="lp-section-subtitle lp-fade-in">
            Web 版はアカウント登録だけで即座に使えます。
            <br className="hidden sm:inline" />
            デスクトップ版はネイティブアプリとして快適に動作します。
          </p>
          <div className="lp-download__cards lp-fade-in">
            <div className="lp-download__card lp-slide-left">
              <div className="lp-download__card-icon"><Apple size={32} /></div>
              <h3 className="lp-download__card-title">macOS</h3>
              <p className="lp-download__card-desc">Apple Silicon (M1/M2/M3)<br />Intel Mac は Rosetta 2 で動作</p>
              <a href={DL_MACOS} className="lp-btn lp-btn--outline lp-shine">
                <Download size={16} />ダウンロード (.app)
              </a>
            </div>
            <div className="lp-download__card lp-fade-in">
              <div className="lp-download__card-icon"><Monitor size={32} /></div>
              <h3 className="lp-download__card-title">Windows</h3>
              <p className="lp-download__card-desc">Windows 10 / 11 (x64)<br />NSIS インストーラ</p>
              <a href={DL_WINDOWS} className="lp-btn lp-btn--outline lp-shine">
                <Download size={16} />ダウンロード (.exe)
              </a>
            </div>
            <div className="lp-download__card lp-download__card--highlight lp-slide-right">
              <div className="lp-download__card-icon"><Sparkles size={32} /></div>
              <h3 className="lp-download__card-title">Web版</h3>
              <p className="lp-download__card-desc">インストール不要<br />Google アカウントで即座に開始</p>
              <button type="button" onClick={handleSignIn} className="lp-btn lp-btn--primary lp-btn--sm lp-shine">
                無料で始める <ArrowRight size={16} className="lp-btn__arrow" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-cta">
        <div className="lp-cta__glow" />
        <div className="lp-section-inner">
          <h2 className="lp-cta__title lp-fade-in">今すぐ、就活をアップグレードしよう</h2>
          <button type="button" onClick={handleSignIn} className="lp-btn lp-btn--primary lp-btn--lg lp-fade-in lp-shine">
            Web版を無料で使う <ArrowRight size={18} className="lp-btn__arrow" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <div className="lp-footer__brand">
            <img src="/logo.png" alt="AI就活" className="lp-footer__logo" />
            <span>AI就活</span>
          </div>
          <div className="lp-footer__links">
            <a href="https://github.com/yamauchiyuhei/AIshukatsu" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
          <p className="lp-footer__copy">&copy; {new Date().getFullYear()} AI就活. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay, dir }: {
  icon: React.ReactNode; title: string; description: string; delay: number; dir: 'left' | 'right';
}) {
  const tilt = useTilt();
  return (
    <div
      ref={tilt.ref}
      className={`lp-feature-card ${dir === 'left' ? 'lp-slide-left' : 'lp-slide-right'}`}
      style={{ transitionDelay: `${delay * 100}ms` }}
      onMouseMove={tilt.onMove}
      onMouseLeave={tilt.onLeave}
    >
      <div className="lp-feature-card__icon">{icon}</div>
      <h3 className="lp-feature-card__title">{title}</h3>
      <p className="lp-feature-card__desc">{description}</p>
    </div>
  );
}
