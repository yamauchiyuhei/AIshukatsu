import { useEffect, useMemo, useState } from 'react';
import { LoginScreen } from './LoginScreen';
import { DesktopSetupScreen } from './DesktopSetupScreen';
import { IndustrySelectScreen } from './IndustrySelectScreen';
import { CompanySelectScreen, type SelectedCompany } from './CompanySelectScreen';
import { GeneratingScreen, type GenerationFailure } from './GeneratingScreen';
import {
  firebaseEnabled,
  watchAuth,
  type User,
} from '../../spreadsheet/lib/firebase';
import {
  createSubdirectory,
  fileExists,
  subdirectoryExists,
  writeTextFile,
} from '../../lib/fs';
import {
  SELF_ANALYSIS_TEMPLATES,
  SELF_ANALYSIS_README,
  ENTRY_SHEET_README,
  ROOT_CLAUDE_MD,
  ROOT_README_MD,
  ROOT_USAGE_GUIDE_MD,
} from '../../lib/onboardingTemplates';
import { SELF_ANALYSIS_DIR, ENTRY_SHEET_DIR } from '../../types';
import { pullIndustryResearch } from '../../lib/industryResearchSync';
import {
  writeCompanyFolder,
  loadFallbackTemplates,
} from '../../lib/companyFolderCreator';
import type { CompanyTemplateFile } from '../../lib/templateLoader';
import { markOnboarded } from '../../lib/onboardingState';
import industryCompaniesJson from '../../data/industryCompanies.json';

const INDUSTRY_COMPANIES = industryCompaniesJson as Record<string, string[]>;

type Step = 'login' | 'desktop' | 'industry' | 'company' | 'generating';

interface Props {
  /** Firebase uid of the signed-in user. */
  uid: string;
  /** Called once the user has finished the flow (root handle adopted, files written). */
  onComplete: (handle: FileSystemDirectoryHandle) => void;
}

export function OnboardingFlow({ uid, onComplete }: Props) {
  // App.tsx provides a top-level auth gate that guarantees the user is
  // already signed in (when firebaseEnabled) before this flow mounts, so we
  // can always start at 'desktop'. The 'login' step is kept in the state
  // machine as a safety fallback but is no longer the default entry.
  const [step, setStep] = useState<Step>('desktop');
  const [user, setUser] = useState<User | null>(null);
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(
    null,
  );
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<SelectedCompany[]>(
    [],
  );

  const [genProgress, setGenProgress] = useState(0);
  const [genCurrent, setGenCurrent] = useState<string | null>(null);
  const [genFailures, setGenFailures] = useState<GenerationFailure[]>([]);
  const [genDone, setGenDone] = useState(false);

  // Watch auth so the login step can auto-advance once the popup resolves.
  useEffect(() => {
    if (!firebaseEnabled) return;
    const unsub = watchAuth((u) => setUser(u));
    return () => unsub();
  }, []);

  // Auto-advance from login → desktop when the user becomes signed-in.
  useEffect(() => {
    if (step === 'login' && user) setStep('desktop');
  }, [step, user]);

  const toggleIndustry = (industry: string) => {
    setSelectedIndustries((prev) => {
      if (prev.includes(industry)) {
        // Unchecking — drop its company picks as well.
        setSelectedCompanies((cs) => cs.filter((c) => c.industry !== industry));
        return prev.filter((i) => i !== industry);
      }
      return [...prev, industry];
    });
  };

  const toggleCompany = (pick: SelectedCompany) => {
    setSelectedCompanies((prev) => {
      const exists = prev.some(
        (c) => c.industry === pick.industry && c.name === pick.name,
      );
      return exists
        ? prev.filter(
            (c) => !(c.industry === pick.industry && c.name === pick.name),
          )
        : [...prev, pick];
    });
  };

  const selectAllFor = (industry: string) => {
    const all = INDUSTRY_COMPANIES[industry] ?? [];
    setSelectedCompanies((prev) => {
      const others = prev.filter((c) => c.industry !== industry);
      return [...others, ...all.map((name) => ({ industry, name }))];
    });
  };

  const clearAllFor = (industry: string) => {
    setSelectedCompanies((prev) =>
      prev.filter((c) => c.industry !== industry),
    );
  };

  const handleDesktopReady = (handle: FileSystemDirectoryHandle) => {
    setRootHandle(handle);
    setStep('industry');
  };

  const startGeneration = async () => {
    if (!rootHandle) return;
    setStep('generating');
    setGenProgress(0);
    setGenFailures([]);
    setGenDone(false);

    // Preload empty-template fallbacks once so that companies without a
    // Firestore document don't re-read the _テンプレート folder every time.
    let fallbackTemplates: CompanyTemplateFile[] = [];
    try {
      fallbackTemplates = await loadFallbackTemplates(rootHandle);
    } catch (e) {
      console.warn('[onboarding] fallback template load failed', e);
    }

    // Group picks by industry so we only create each category folder once.
    const grouped = new Map<string, string[]>();
    for (const pick of selectedCompanies) {
      const arr = grouped.get(pick.industry) ?? [];
      arr.push(pick.name);
      grouped.set(pick.industry, arr);
    }

    const failures: GenerationFailure[] = [];
    let done = 0;

    for (const [industry, companies] of grouped) {
      let categoryDir: FileSystemDirectoryHandle;
      try {
        categoryDir = await createSubdirectory(rootHandle, industry);
      } catch (e) {
        // If we can't create the category, fail all of its companies.
        for (const name of companies) {
          failures.push({
            industry,
            name,
            reason: e instanceof Error ? e.message : String(e),
          });
          done += 1;
          setGenProgress(done);
        }
        continue;
      }

      // Write 業界研究.md from Firestore if available
      try {
        if (!(await fileExists(categoryDir, '業界研究.md'))) {
          const researchContent = await pullIndustryResearch(industry);
          if (researchContent) {
            await writeTextFile(categoryDir, '業界研究.md', researchContent);
          }
        }
      } catch (e) {
        console.warn(`[onboarding] industry research failed for ${industry}:`, e);
      }

      for (const name of companies) {
        setGenCurrent(name);
        try {
          if (await subdirectoryExists(categoryDir, name)) {
            // Already present → treat as success, skip writing.
            done += 1;
            setGenProgress(done);
            continue;
          }
          // writeCompanyFolder tries Firestore first, falls back to the
          // preloaded empty templates on miss/error.
          await writeCompanyFolder(
            rootHandle,
            categoryDir,
            name,
            fallbackTemplates,
          );
        } catch (e) {
          failures.push({
            industry,
            name,
            reason: e instanceof Error ? e.message : String(e),
          });
        }
        done += 1;
        setGenProgress(done);
      }
    }

    // ── Generate 自己分析/ folder + templates ───────────────────
    setGenCurrent('自己分析フォルダ');
    try {
      const saDir = await createSubdirectory(rootHandle, SELF_ANALYSIS_DIR);
      // Write README
      if (!(await fileExists(saDir, 'README.md'))) {
        await writeTextFile(saDir, 'README.md', SELF_ANALYSIS_README);
      }
      // Write each template
      for (const tpl of SELF_ANALYSIS_TEMPLATES) {
        if (!(await fileExists(saDir, tpl.name))) {
          await writeTextFile(saDir, tpl.name, tpl.content);
        }
      }
    } catch (e) {
      console.warn('[onboarding] self-analysis folder creation failed', e);
    }

    // ── Generate エントリーシート/ folder ──────────────────────
    setGenCurrent('エントリーシートフォルダ');
    try {
      const esDir = await createSubdirectory(rootHandle, ENTRY_SHEET_DIR);
      if (!(await fileExists(esDir, 'README.md'))) {
        await writeTextFile(esDir, 'README.md', ENTRY_SHEET_README);
      }
    } catch (e) {
      console.warn('[onboarding] entry-sheet folder creation failed', e);
    }

    // ── Generate root CLAUDE.md + README.md + 使い方ガイド ─────
    setGenCurrent('CLAUDE.md / README.md');
    try {
      if (!(await fileExists(rootHandle, 'CLAUDE.md'))) {
        await writeTextFile(rootHandle, 'CLAUDE.md', ROOT_CLAUDE_MD);
      }
      if (!(await fileExists(rootHandle, 'README.md'))) {
        await writeTextFile(rootHandle, 'README.md', ROOT_README_MD);
      }
      if (!(await fileExists(rootHandle, 'AI就活の使い方.md'))) {
        await writeTextFile(rootHandle, 'AI就活の使い方.md', ROOT_USAGE_GUIDE_MD);
      }
    } catch (e) {
      console.warn('[onboarding] root file creation failed', e);
    }

    setGenCurrent(null);
    setGenFailures(failures);
    setGenDone(true);
  };

  const handleFinish = () => {
    if (!rootHandle) return;
    markOnboarded(uid);
    onComplete(rootHandle);
  };

  const totalCompanies = useMemo(
    () => selectedCompanies.length,
    [selectedCompanies],
  );

  if (step === 'login') {
    return <LoginScreen user={user} onNext={() => setStep('desktop')} />;
  }
  if (step === 'desktop') {
    return <DesktopSetupScreen onReady={handleDesktopReady} />;
  }
  if (step === 'industry') {
    return (
      <IndustrySelectScreen
        selected={selectedIndustries}
        onToggle={toggleIndustry}
        onNext={() => setStep('company')}
      />
    );
  }
  if (step === 'company') {
    return (
      <CompanySelectScreen
        industries={selectedIndustries}
        selected={selectedCompanies}
        onToggle={toggleCompany}
        onSelectAllFor={selectAllFor}
        onClearAllFor={clearAllFor}
        onBack={() => setStep('industry')}
        onSubmit={startGeneration}
      />
    );
  }
  return (
    <GeneratingScreen
      progress={genProgress}
      total={totalCompanies}
      currentName={genCurrent}
      failures={genFailures}
      done={genDone}
      onFinish={handleFinish}
    />
  );
}
