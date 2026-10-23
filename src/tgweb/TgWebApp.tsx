import { useEffect, useState } from 'react';
import { TgWebGate } from './TgWebGate';
import { TestSelectScreen } from './TestSelectScreen';
import { TgWebSearchPage } from './TgWebSearchPage';
import { clearCache } from './lib/loader';
import { findTest, type TestType } from './types';

const PASS_KEY = 'tgweb-pass';
const TEST_KEY = 'tgweb-test';

const VALID_TESTS: ReadonlySet<string> = new Set([
  'tgweb',
  'spi',
  'tamatebako',
  'gab',
  'cgab',
  'webtesting',
  'testcenter',
]);

function readSession<T>(key: string, validate: (v: string) => v is string): T | null {
  try {
    const v = sessionStorage.getItem(key);
    if (v == null) return null;
    return validate(v) ? (v as unknown as T) : null;
  } catch {
    return null;
  }
}

const isTestType = (v: string): v is TestType => VALID_TESTS.has(v);

export function TgWebApp() {
  const [password, setPassword] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(PASS_KEY);
    } catch {
      return null;
    }
  });
  const [testType, setTestType] = useState<TestType | null>(() =>
    readSession<TestType>(TEST_KEY, isTestType),
  );

  useEffect(() => {
    const prev = document.title;
    document.title = testType
      ? `${findTest(testType).label} 回答検索`
      : 'Webテスト 回答検索';
    return () => {
      document.title = prev;
    };
  }, [testType]);

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
      sessionStorage.removeItem(TEST_KEY);
    } catch {
      /* ignore */
    }
    clearCache();
    setPassword(null);
    setTestType(null);
  };

  const selectTest = (t: TestType) => {
    try {
      sessionStorage.setItem(TEST_KEY, t);
    } catch {
      /* ignore */
    }
    setTestType(t);
  };

  const backToSelect = () => {
    try {
      sessionStorage.removeItem(TEST_KEY);
    } catch {
      /* ignore */
    }
    setTestType(null);
  };

  if (!password) return <TgWebGate onUnlock={unlock} />;
  if (!testType) return <TestSelectScreen onSelect={selectTest} onLock={lock} />;
  return (
    <TgWebSearchPage
      testType={testType}
      password={password}
      onBack={backToSelect}
      onLock={lock}
    />
  );
}
