import React, { useRef, useState } from 'react';
import { ChevronDown, Download, Search } from 'lucide-react';
import EmptyState from './EmptyState';
import StatusBadge from './StatusBadge';
import TermsDialog from './TermsDialog';
import UserSignatures, { audienceLabel, type UserSignaturesState } from './UserSignatures';
import TermsHtml from '../../../../components/terms/TermsHtml';
import {
  downloadTermsDocx,
  getAdminTermsVersion,
  getUserTermsAcceptances,
  searchTermsUsers,
  type TermsAcceptanceRow,
  type TermsUserHit,
} from '../../../../api/termsApi';
import {
  CARD,
  FOCUS,
  agreementStanding,
  displayName,
  formatTermsDate,
  initialsFromName,
  requiredAgreements,
  roleLabel,
  standingLabel,
  standingTone,
  type AgreementContract,
} from './termsModel';

const RESULT_LIMIT = 25;
const EMPTY_QUERY = 'Enter a name, username, or email.';

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'done'; users: TermsUserHit[] };

type OpenedSignature = {
  row: TermsAcceptanceRow;
  name: string;
  loading: boolean;
  error: string;
  html: string;
};

function apiError(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof message === 'string' && message ? message : fallback;
}

export default function SignatureLookup({ contracts }: { contracts: AgreementContract[] }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>({ status: 'idle' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, UserSignaturesState>>({});
  const [opened, setOpened] = useState<OpenedSignature | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const searchSeq = useRef(0);
  const openSeq = useRef(0);

  const contractByKey = Object.fromEntries(contracts.map(contract => [contract.key, contract]));

  const runSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    const seq = searchSeq.current + 1;
    searchSeq.current = seq;
    setExpandedId(null);
    setDetails({});
    if (!term) {
      setSearch({ status: 'error', error: EMPTY_QUERY });
      return;
    }
    setSearch({ status: 'loading' });
    try {
      const users = await searchTermsUsers(term);
      if (searchSeq.current !== seq) return;
      setSearch({ status: 'done', users });
    } catch (err) {
      if (searchSeq.current !== seq) return;
      setSearch({ status: 'error', error: apiError(err, 'Search failed. Try again.') });
    }
  };

  const loadDetails = async (userId: string) => {
    const seq = searchSeq.current;
    setDetails(prev => ({ ...prev, [userId]: { status: 'loading' } }));
    try {
      const result = await getUserTermsAcceptances(userId);
      if (searchSeq.current !== seq) return;
      setDetails(prev => ({ ...prev, [userId]: { status: 'ready', rows: result.acceptances } }));
    } catch (err) {
      if (searchSeq.current !== seq) return;
      setDetails(prev => ({
        ...prev,
        [userId]: { status: 'error', error: apiError(err, 'Could not load this account\'s signatures.') },
      }));
    }
  };

  const toggle = (userId: string) => {
    if (expandedId === userId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(userId);
    const known = details[userId];
    if (!known || known.status === 'error') void loadDetails(userId);
  };

  const openSignature = async (row: TermsAcceptanceRow, name: string) => {
    const seq = openSeq.current + 1;
    openSeq.current = seq;
    setDownloadError('');
    setOpened({ row, name, loading: true, error: '', html: '' });
    try {
      const doc = await getAdminTermsVersion(row.audience, row.version);
      if (openSeq.current !== seq) return;
      setOpened(current => (current ? { ...current, loading: false, html: doc.html || '' } : current));
    } catch (err) {
      if (openSeq.current !== seq) return;
      setOpened(current =>
        current ? { ...current, loading: false, error: apiError(err, 'Could not load the signed agreement.') } : current,
      );
    }
  };

  const closeSignature = () => {
    openSeq.current += 1;
    setOpened(null);
  };

  const downloadSigned = async (row: TermsAcceptanceRow) => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadTermsDocx(row.audience, row.version, row.originalFilename || undefined);
    } catch {
      setDownloadError('Could not download this agreement. Try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className={CARD} aria-labelledby="terms-lookup-heading">
      <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
        <h2 id="terms-lookup-heading" className="text-base font-semibold text-slate-900">
          Check a user&apos;s signatures
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Look up who is on the current version, who still needs to accept, and who has not signed.
        </p>
        <form onSubmit={runSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="terms-user-search" className="sr-only">
            Username, email or name
          </label>
          <input
            id="terms-user-search"
            type="search"
            value={query}
            maxLength={100}
            onChange={event => setQuery(event.target.value)}
            placeholder="Username, email or name"
            className={`${FOCUS} w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900`}
          />
          <button
            type="submit"
            className={`${FOCUS} inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800`}
          >
            <Search className="h-4 w-4" aria-hidden />
            Search
          </button>
        </form>
        {search.status === 'error' ? (
          <p className="mt-2 text-sm text-rose-700" role="alert">
            {search.error}
          </p>
        ) : null}
      </div>

      {search.status === 'idle' || search.status === 'error' ? (
        <EmptyState
          title="Search for a user"
          description="Enter a username, email or name to see which agreements they have signed."
        />
      ) : search.status === 'loading' ? (
        <p className="px-5 py-6 text-sm text-slate-500 sm:px-6" role="status">
          Searching…
        </p>
      ) : search.users.length === 0 ? (
        <EmptyState
          variant="results"
          title="No users found"
          description="No accounts match that search. Try a different username, email or name."
        />
      ) : (
        <>
          {search.users.length >= RESULT_LIMIT ? (
            <p className="border-b border-slate-100 px-5 py-2 text-sm text-slate-500 sm:px-6">
              Showing the first {RESULT_LIMIT} matches. Refine the search to narrow it down.
            </p>
          ) : null}
          <ul className="divide-y divide-slate-100">
            {search.users.map(user => {
              const name = displayName(user);
              const required = requiredAgreements(user.role);
              const expanded = expandedId === user.id;
              const panelId = `terms-user-signatures-${user.id}`;
              return (
                <li key={user.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700"
                        aria-hidden
                      >
                        {initialsFromName(name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-all text-sm font-medium text-slate-900">{name}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                            {roleLabel(user.role)}
                          </span>
                          {user.status === 'blocked' ? (
                            <span
                              className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800"
                              title="Blocked accounts cannot sign in, so they are not asked to sign and are not counted."
                            >
                              Blocked
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 break-all text-sm text-slate-500">
                          {user.username ? `@${user.username} · ` : ''}
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col gap-2 sm:items-end">
                      {required.length === 0 ? (
                        <StatusBadge tone="neutral">No agreements required</StatusBadge>
                      ) : (
                        required.map(key => {
                          const contract = contractByKey[key];
                          const standing = contract ? agreementStanding(user, contract) : { tone: 'unknown' as const };
                          return (
                            <StatusBadge key={key} tone={standingTone(standing)}>
                              {standingLabel(key, standing)}
                            </StatusBadge>
                          );
                        })
                      )}
                      <button
                        type="button"
                        onClick={() => toggle(user.id)}
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        className={`${FOCUS} inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100`}
                      >
                        {expanded ? 'Hide signatures' : 'View signatures'}
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                      </button>
                    </div>
                  </div>
                  {expanded ? (
                    <div className="mt-4">
                      <UserSignatures
                        id={panelId}
                        name={name}
                        state={details[user.id] || { status: 'loading' }}
                        onOpen={row => void openSignature(row, name)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {opened ? (
        <TermsDialog
          title={`${audienceLabel(opened.row.audience)} agreement · v${opened.row.version}`}
          subtitle={`Signed by ${opened.name} on ${formatTermsDate(opened.row.signedAt)}`}
          onClose={closeSignature}
        >
          {opened.loading ? (
            <p className="text-sm text-slate-500" role="status">
              Loading…
            </p>
          ) : opened.error ? (
            <p className="text-sm text-rose-700" role="alert">
              {opened.error}
            </p>
          ) : (
            <TermsHtml html={opened.html} />
          )}
          <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-700">
              <span className="text-slate-500">Typed name: </span>
              {opened.row.typedName || '—'}
            </p>
            {opened.row.signaturePng?.startsWith('data:image/png;base64,') ? (
              <img
                src={opened.row.signaturePng}
                alt="Drawn signature"
                className="max-h-40 rounded border border-slate-200 bg-white"
              />
            ) : (
              <p className="text-sm text-slate-500">No drawn signature.</p>
            )}
            <button
              type="button"
              onClick={() => void downloadSigned(opened.row)}
              disabled={downloading}
              className={`${FOCUS} inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60`}
            >
              <Download className="h-4 w-4" aria-hidden />
              {downloading ? 'Downloading…' : 'Download .docx'}
            </button>
            {downloadError ? (
              <p className="text-sm text-rose-700" role="alert">
                {downloadError}
              </p>
            ) : null}
          </div>
        </TermsDialog>
      ) : null}
    </section>
  );
}
