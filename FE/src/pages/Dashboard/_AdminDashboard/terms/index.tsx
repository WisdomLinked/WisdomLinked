import React, { useMemo, useState } from 'react';
import { FilePlus, X } from 'lucide-react';
import AgreementTabs from './AgreementTabs';
import CurrentVersionCard from './CurrentVersionCard';
import PublishDrawer from './PublishDrawer';
import SignatureLookup from './SignatureLookup';
import VersionHistoryTable from './VersionHistoryTable';
import {
  FOCUS,
  initialContracts,
  nextVersionNumber,
  type AgreementKey,
} from './termsModel';

export default function TermsAgreementPage() {
  const [contracts, setContracts] = useState(initialContracts);
  const [selected, setSelected] = useState<AgreementKey>('shared');
  const [publishOpen, setPublishOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const contract = useMemo(
    () => contracts.find(item => item.key === selected) || contracts[0],
    [contracts, selected],
  );
  const next = nextVersionNumber(contract);

  return (
    <div className="px-4 py-7 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900">Terms &amp; Agreement</h1>
            <p className="mt-1 text-sm text-slate-500">
              Publish signup contracts and see who has accepted the current version.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            className={`${FOCUS} inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800`}
          >
            <FilePlus className="h-4 w-4" aria-hidden />
            Publish {contract.label} v{next}
          </button>
        </header>

        {notice ? (
          <div
            className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
            role="status"
          >
            <p>{notice}</p>
            <button
              type="button"
              onClick={() => setNotice('')}
              className={`${FOCUS} rounded-lg p-1 text-emerald-800 hover:bg-emerald-100`}
              aria-label="Dismiss notice"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <AgreementTabs contracts={contracts} selected={selected} onSelect={setSelected} />

        <div
          role="tabpanel"
          id={`terms-panel-${contract.key}`}
          aria-labelledby={`terms-tab-${contract.key}`}
          className="space-y-6"
        >
          <CurrentVersionCard contract={contract} />
          <VersionHistoryTable contract={contract} />
          <SignatureLookup contracts={contracts} />
        </div>
      </div>

      <PublishDrawer
        open={publishOpen}
        contract={contract}
        onClose={() => setPublishOpen(false)}
        onPublish={({ notes }) => {
          const publishedAt = new Date().toISOString();
          setContracts(prev =>
            prev.map(item =>
              item.key !== contract.key
                ? item
                : {
                    ...item,
                    versions: [
                      {
                        number: next,
                        publishedAt,
                        publishedBy: 'You',
                        accepted: 0,
                        notes: notes || 'No change notes',
                      },
                      ...item.versions,
                    ],
                  },
            ),
          );
          setPublishOpen(false);
          setNotice(`${contract.label} v${next} is now the current agreement.`);
        }}
      />
    </div>
  );
}
