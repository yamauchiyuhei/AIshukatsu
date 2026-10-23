import { useEffect, useState } from 'react';
import { McKinseyGate } from './McKinseyGate';
import { McKinseyPage } from './McKinseyPage';
import { clearInterviewCache } from './lib/loader';

const PASS_KEY = 'mckinsey-pass';

export function McKinseyApp() {
  const [password, setPassword] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(PASS_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const prev = document.title;
    document.title = 'マッキンゼー 面接Q&A';
    return () => {
      document.title = prev;
    };
  }, []);

  const unlock = (pass: string) => {
    try {
      sessionStorage.setItem(PASS_KEY, pass);
    } catch {
      /* ignore */
    }
    setPassword(pass);
  };

  const lock = () => {
    try {
      sessionStorage.removeItem(PASS_KEY);
    } catch {
      /* ignore */
    }
    clearInterviewCache();
    setPassword(null);
  };

  if (!password) return <McKinseyGate onUnlock={unlock} />;
  return <McKinseyPage password={password} onLock={lock} />;
}
