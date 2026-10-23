import { useEffect, useRef, useState } from 'react';

// Lightweight typing shim: older TS DOM lib may not include WakeLockSentinel.
type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', cb: () => void) => void;
};

export type WakeLockStatus = 'idle' | 'active' | 'unsupported' | 'error';

/**
 * Keep the screen awake while `active` is true.
 *
 * Notes:
 *  - Requires HTTPS (Firebase Hosting is HTTPS).
 *  - Browsers release the lock when the tab goes to background; we reacquire
 *    automatically on visibilitychange.
 *  - Supported on Chrome 84+, Safari 16.4+ (iOS 16.4+), Firefox 126+.
 */
export function useWakeLock(active: boolean): WakeLockStatus {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const [status, setStatus] = useState<WakeLockStatus>('idle');

  useEffect(() => {
    if (!active) {
      // Release if currently held.
      const s = sentinelRef.current;
      sentinelRef.current = null;
      setStatus('idle');
      if (s && !s.released) void s.release().catch(() => {});
      return;
    }

    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) {
      setStatus('unsupported');
      return;
    }

    let disposed = false;

    const acquire = async () => {
      if (disposed) return;
      if (document.visibilityState !== 'visible') return;
      try {
        const sentinel = await nav.wakeLock!.request('screen');
        if (disposed) {
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        setStatus('active');
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) {
            sentinelRef.current = null;
            if (!disposed) setStatus('idle');
          }
        });
      } catch {
        setStatus('error');
      }
    };

    void acquire();

    const onVis = () => {
      if (document.visibilityState === 'visible' && !sentinelRef.current) {
        void acquire();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVis);
      const s = sentinelRef.current;
      sentinelRef.current = null;
      setStatus('idle');
      if (s && !s.released) void s.release().catch(() => {});
    };
  }, [active]);

  return status;
}
