import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import AgreementTabs from './AgreementTabs';
import CurrentVersionCard, { type VersionActions } from './CurrentVersionCard';
import PublishDrawer from './PublishDrawer';
import SignatureLookup from './SignatureLookup';
import TermsDialog from './TermsDialog';
import VersionHistoryTable from './VersionHistoryTable';
import TermsHtml from '../../../../components/terms/TermsHtml';
import {
  downloadTermsDocx,
  getAdminTermsVersion,
  getTermsOverview,
  listVersionSigners,
  publishTerms,
  type TermsAcceptanceRow,
} from '../../../../api/termsApi';
import {
  AGREEMENT_KEYS,
  API_AUDIENCE,
  FOCUS,
  contractFromOverview,
  formatTermsDate,
  initialContracts,
  type AgreementContract,
  type AgreementKey,
  type AgreementVersion,
} from './termsModel';

type Notice = { tone: 'success' | 'error'; text: string };

type Dialog =
  | { kind: 'document'; title: string; loading: boolean; error: string; html: string }
  | { kind: 'signers'; title: string; loading: boolean; error: string; rows: TermsAcceptanceRow[] };

function apiError(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof message === 'string' && message ? message : fallback;
}

export default function TermsAgreementPage() {
  const [contracts, setContracts] = useState<AgreementContract[]>(initialContracts);
  const [selected, setSelected] = useState<AgreementKey>('shared');
  const [publishOpen, setPublishOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [downloading, setDownloading] = useState<{ key: AgreementKey; number: number } | null>(null);
  const loadSeq = useRef<Partial<Record<AgreementKey, number>>>({});
  const dialogSeq = useRef(0);

  const contract = useMemo(
    () => contracts.find(item => item.key === selected) || contracts[0],
    [contracts, selected],
  );

  const loadContract = useCallback(async (key: AgreementKey) => {
    const seq = (loadSeq.current[key] || 0) + 1;
    loadSeq.current[key] = seq;
    // A refresh after publishing keeps the current numbers on screen until the new ones arrive.
    setContracts(prev =>
      prev.map(item => (item.key === key && item.status !== 'ready' ? { ...item, status: 'loading' } : item)),
    );
    try {
      const overview = await getTermsOverview(API_AUDIENCE[key]);
      if (loadSeq.current[key] !== seq) return;
      setContracts(prev => prev.map(item => (item.key === key ? contractFromOverview(item, overview) : item)));
    } catch {
      if (loadSeq.current[key] !== seq) return;
      setContracts(prev => prev.map(item => (item.key === key ? { ...item, status: 'error' } : item)));
    }
  }, []);

  useEffect(() => {
    AGREEMENT_KEYS.forEach(key => {
      void loadContract(key);
    });
  }, [loadContract]);

  const closeDialog = () => {
    dialogSeq.current += 1;
    setDialog(null);
  };

  const openDialog = async <T,>(
    initial: Dialog,
    fetcher: () => Promise<T>,
    apply: (current: Dialog, result: T) => Dialog,
    fallback: string,
  ) => {
    const seq = dialogSeq.current + 1;
    dialogSeq.current = seq;
    setDialog(initial);
    try {
      const result = await fetcher();
      if (dialogSeq.current !== seq) return;
      setDialog(current => (current ? apply(current, result) : current));
    } catch (err) {
      if (dialogSeq.current !== seq) return;
      setDialog(current => (current ? { ...current, loading: false, error: apiError(err, fallback) } : current));
    }
  };

  const actionsFor = (item: AgreementContract): VersionActions => ({
    downloadingVersion: downloading?.key === item.key ? downloading.number : null,
    onPreview: (version: AgreementVersion) => {
      void openDialog(
        { kind: 'document', title: `${item.label} agreement · v${version.number}`, loading: true, error: '', html: '' },
        () => getAdminTermsVersion(API_AUDIENCE[item.key], version.number),
        (current, doc) => (current.kind === 'document' ? { ...current, loading: false, html: doc.html || '' } : current),
        'Could not load that agreement.',
      );
    },
    onSigners: (version: AgreementVersion) => {
      void openDialog(
        { kind: 'signers', title: `Signers of ${item.label} v${version.number}`, loading: true, error: '', rows: [] },
        () => listVersionSigners(API_AUDIENCE[item.key], version.number),
        (current, rows) => (current.kind === 'signers' ? { ...current, loading: false, rows } : current),
        'Could not load who signed this version.',
      );
    },
    onDownload: async (version: AgreementVersion) => {
      if (downloading) return;
      setDownloading({ key: item.key, number: version.number });
      try {
        await downloadTermsDocx(API_AUDIENCE[item.key], version.number, version.originalFilename || undefined);
      } catch {
        setNotice({ tone: 'error', text: `Could not download ${item.label} v${version.number}. Try again.` });
      } finally {
        setDownloading(null);
      }
    },
  });

  const onPublish = async ({ file, notes }: { file: File; notes: string }) => {
    const target = contract;
    let version: number;
    try {
      const published = await publishTerms(API_AUDIENCE[target.key], file, notes);
      version = published.version;
    } catch (err) {
      throw new Error(apiError(err, 'Could not publish that document.'));
    }
    setPublishOpen(false);
    setNotice({ tone: 'success', text: `${target.label} v${version} is now the current agreement.` });
    await loadContract(target.key);
  };

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
            disabled={contract.status !== 'ready'}
            className={`${FOCUS} inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300`}
          >
            <Plus className="h-4 w-4" aria-hidden />
            New version
          </button>
        </header>

        {notice ? (
          <div
            className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
              notice.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
            role={notice.tone === 'success' ? 'status' : 'alert'}
          >
            <p>{notice.text}</p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className={`${FOCUS} rounded-lg p-1 hover:bg-white/60`}
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
          <CurrentVersionCard
            contract={contract}
            actions={actionsFor(contract)}
            onRetry={() => void loadContract(contract.key)}
          />
          <VersionHistoryTable contract={contract} actions={actionsFor(contract)} />
          <SignatureLookup contracts={contracts} />
        </div>
      </div>

      <PublishDrawer
        open={publishOpen}
        contract={contract}
        onClose={() => setPublishOpen(false)}
        onPublish={onPublish}
      />

      {dialog ? (
        <TermsDialog
          title={dialog.title}
          subtitle={
            dialog.kind === 'signers' && !dialog.loading && !dialog.error
              ? `${dialog.rows.length} ${dialog.rows.length === 1 ? 'signature' : 'signatures'}`
              : undefined
          }
          onClose={closeDialog}
        >
          {dialog.loading ? (
            <p className="text-sm text-slate-500" role="status">
              Loading…
            </p>
          ) : dialog.error ? (
            <p className="text-sm text-rose-700" role="alert">
              {dialog.error}
            </p>
          ) : dialog.kind === 'document' ? (
            <TermsHtml html={dialog.html} />
          ) : dialog.rows.length === 0 ? (
            <p className="text-sm text-slate-500">Nobody has signed this version yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dialog.rows.map(row => (
                <li key={`${row.userId}-${row.signedAt}`} className="py-3">
                  <p className="text-sm font-medium text-slate-900">
                    {row.name || row.username || row.email || row.userId}
                  </p>
                  {row.email ? <p className="text-sm text-slate-500">{row.email}</p> : null}
                  <p className="mt-1 text-sm text-slate-500">
                    Signed {formatTermsDate(row.signedAt)}
                    {row.ip ? ` · IP ${row.ip}` : ''}
                  </p>
                  {row.typedName ? (
                    <p className="text-sm text-slate-500">Typed name: {row.typedName}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </TermsDialog>
      ) : null}
    </div>
  );
}
