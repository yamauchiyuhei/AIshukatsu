import { useState } from 'react';
import { researchDeepLink, RESEARCH_MIN_VERSION } from '../lib/researchLinks.mjs';
import { useWebsiteDevice } from '../components/website/WebsiteHeader';
import type { ArticleSummary } from './types';
import { companyName } from './discovery.mjs';
export function DesktopResearchLink({ article, primary = false }: {article: ArticleSummary; primary?: boolean}) {
  const mobile = useWebsiteDevice() === 'mobile';
  const [requested,setRequested] = useState(false);
  const label = companyName(article) ? 'アプリで企業研究メモを作る' : 'アプリでこの記事のメモを作る';
  return <div className="mag-desktop-research"><a data-product-action={mobile ? "download_guide" : "desktop_open_request"} data-product-placement="article_next_step" className={primary ? 'mag-button' : 'mag-text-link'} href={mobile ? '/#download' : researchDeepLink(article.slug)} onClick={mobile ? undefined : () => setRequested(true)}>{mobile ? 'PC用アプリの入手方法を見る' : label}</a>
    {!mobile && <a className="mag-text-link" href="/#download" data-product-action="download_guide" data-product-placement="article_next_step">まだアプリをお持ちでない方：無料で入手</a>}
    <small>Mac・Windows版 v{RESEARCH_MIN_VERSION}以降に対応。既存のメモは保持して開きます。</small>
    {requested && <p role="status">ブラウザに確認が表示されたら、アプリを開いてください。開かない場合は<a href="/#download">最新版をインストール</a>してから、もう一度お試しください。</p>}
  </div>;
}
