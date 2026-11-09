import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function useWebsiteDevice() {
  const [device, setDevice] = useState<'unknown' | 'mobile' | 'mac' | 'windows' | 'other'>('unknown');
  useEffect(() => {
    const ua = navigator.userAgent;
    setDevice(/Android|iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'mobile' : /Mac/i.test(ua) ? 'mac' : /Windows/i.test(ua) ? 'windows' : 'other');
  }, []);
  return device;
}

export function WebsiteHeader({ theme, onThemeChange, magazine = false }: { theme: 'dark' | 'light'; onThemeChange?: () => void; magazine?: boolean }) {
  const device = useWebsiteDevice();
  return <header className="website-header" data-theme={theme}><div className="website-nav">
    <a className="website-brand" href="/" aria-label="AI就活 ホーム"><img src="/logo.png" alt="" width={28} height={28} /><span>AI就活</span></a>
    <nav aria-label="メインナビゲーション"><a href="/magazine/" aria-current={magazine ? 'page' : undefined}>マガジン</a><a className="website-nav-wide" href="/magazine/?category=company-research#stories">企業を探す</a></nav>
    <div className="website-nav-actions"><button type="button" className="website-theme" onClick={onThemeChange} aria-label={theme === 'dark' ? 'ライトテーマに切り替える' : 'ダークテーマに切り替える'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
      <a className="website-start" href={device === 'mobile' ? '/#start' : '/app/'}>{device === 'mobile' ? 'PCで始める' : 'Web版'}</a>
      <details className="website-menu"><summary>メニュー</summary><nav aria-label="サイトメニュー" onClick={event => { if ((event.target as HTMLElement).closest('a')) (event.currentTarget.parentElement as HTMLDetailsElement).open = false; }}><a href="/#start">はじめ方</a><a href="/magazine/?category=company-research#stories">企業を探す</a><a href="/magazine/?collection=saved#stories">保存した記事</a><a href="/#features">機能</a><a href="/#views">選考管理</a><a href="/#download">ダウンロード</a><a href="/#faq">よくある質問</a></nav></details>
    </div>
  </div></header>;
}
