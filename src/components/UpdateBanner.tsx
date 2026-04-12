import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, X, CheckCircle2 } from 'lucide-react';
import { isTauri } from '../lib/tauriFsaShim';

type Phase = 'idle' | 'available' | 'downloading' | 'ready' | 'dismissed';

/**
 * Slim banner shown at the top of the main layout when a new desktop app
 * version is available. Uses `@tauri-apps/plugin-updater` to check, download,
 * and install the update.
 *
 * After download + install, the user is prompted to restart the app manually.
 * Only renders in Tauri desktop environments.
 */
export function UpdateBanner() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [version, setVersion] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const updateRef = useRef<any>(null);

  useEffect(() => {
    if (!isTauri()) return;

    const timer = window.setTimeout(async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (update) {
          updateRef.current = update;
          setVersion(update.version);
          setPhase('available');
        }
      } catch (e) {
        console.warn('[updater] check failed:', e);
      }
    }, 5000);

    return () => window.clearTimeout(timer);
  }, []);

  const handleUpdate = async () => {
    const update = updateRef.current;
    if (!update) return;

    try {
      setPhase('downloading');
      setProgress(0);
      setError(null);

      let totalBytes = 0;
      let downloadedBytes = 0;

      await update.downloadAndInstall((event: any) => {
        if (event.event === 'Started' && event.data?.contentLength) {
          totalBytes = event.data.contentLength;
        } else if (event.event === 'Progress' && event.data?.chunkLength) {
          downloadedBytes += event.data.chunkLength;
          if (totalBytes > 0) {
            setProgress(Math.round((downloadedBytes / totalBytes) * 100));
          }
        } else if (event.event === 'Finished') {
          setProgress(100);
        }
      });

      setPhase('ready');
    } catch (e) {
      console.error('[updater] download failed:', e);
      setError('ダウンロードに失敗しました。後でもう一度お試しください。');
      setPhase('available');
    }
  };

  if (phase === 'idle' || phase === 'dismissed') return null;

  return (
    <div className="update-banner">
      {phase === 'available' && (
        <>
          <div className="update-banner__text">
            <RefreshCw size={14} className="update-banner__icon" />
            <span>
              新しいバージョン <strong>v{version}</strong> が利用可能です
            </span>
          </div>
          <div className="update-banner__actions">
            <button
              type="button"
              onClick={() => setPhase('dismissed')}
              className="update-banner__btn update-banner__btn--secondary"
            >
              後で
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              className="update-banner__btn update-banner__btn--primary"
            >
              <Download size={13} />
              更新する
            </button>
          </div>
        </>
      )}

      {phase === 'downloading' && (
        <div className="update-banner__dl">
          <div className="update-banner__text">
            <span>ダウンロード中... {progress}%</span>
          </div>
          <div className="update-banner__progress">
            <div
              className="update-banner__progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {phase === 'ready' && (
        <div className="update-banner__text">
          <CheckCircle2 size={14} className="text-emerald-600" />
          <span>
            <strong>v{version}</strong> のインストールが完了しました。アプリを再起動すると更新が適用されます。
          </span>
        </div>
      )}

      {error && (
        <div className="update-banner__text update-banner__text--error">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="update-banner__close"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
