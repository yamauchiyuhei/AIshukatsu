import { useState } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CompanyListScreen } from './components/CompanyListScreen';
import { CompanyDetailScreen } from './components/CompanyDetailScreen';
import { AddCompanyModal } from './components/AddCompanyModal';
import { useRootDirectory } from './hooks/useRootDirectory';
import { useCompanies } from './hooks/useCompanies';
import { Company } from './types';
import { createCompany } from './lib/companies';

export default function App() {
  const { handle, status, pick, requestPermission, reset } = useRootDirectory();
  const { companies, loading, error, refresh } = useCompanies(
    status === 'ready' ? handle : null,
  );
  const [selected, setSelected] = useState<Company | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        読み込み中…
      </div>
    );
  }

  if (status === 'no-handle' || status === 'needs-permission') {
    return (
      <WelcomeScreen
        needsPermission={status === 'needs-permission'}
        onPick={pick}
        onRequestPermission={requestPermission}
      />
    );
  }

  // status === 'ready'
  if (!handle) return null;

  if (selected) {
    return (
      <CompanyDetailScreen
        company={selected}
        onBack={() => {
          setSelected(null);
          refresh();
        }}
      />
    );
  }

  return (
    <>
      <CompanyListScreen
        rootName={handle.name}
        companies={companies}
        loading={loading}
        error={error}
        onSelectCompany={(c) => setSelected(c)}
        onAddCompany={() => setShowAdd(true)}
        onRefresh={refresh}
        onChangeFolder={async () => {
          await reset();
        }}
      />
      {showAdd && (
        <AddCompanyModal
          onClose={() => setShowAdd(false)}
          onSubmit={async (name) => {
            await createCompany(handle, name);
            await refresh();
            setShowAdd(false);
          }}
        />
      )}
    </>
  );
}
