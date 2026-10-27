import React, { useState } from 'react';
import { Search } from 'lucide-react';
import EmptyState from './EmptyState';
import StatusBadge from './StatusBadge';
import {
  CARD,
  FOCUS,
  formatTermsDate,
  initialsFromName,
  requiredAgreements,
  searchUsers,
  signatureFor,
  signatureTone,
  type AgreementContract,
  type AgreementKey,
} from './termsModel';

export default function SignatureLookup({ contracts }: { contracts: AgreementContract[] }) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const results = submitted ? searchUsers(submitted) : null;
  const currentByKey = Object.fromEntries(
    contracts.map(contract => [contract.key, contract.versions[0].number]),
  ) as Record<AgreementKey, number>;

  const runSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(query.trim());
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
      </div>

      {!results ? (
        <EmptyState
          title="Search for a user"
          description="Enter a username, email or name to see which agreements they have signed."
        />
      ) : results.length === 0 ? (
        <EmptyState
          variant="results"
          title="No users found"
          description="No accounts match that search. Try a different username, email or name."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {results.map(user => (
            <li key={user.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700"
                  aria-hidden
                >
                  {initialsFromName(user.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">{user.name}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                      {user.role}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    @{user.username} · {user.email}
                  </p>
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:items-end">
                {requiredAgreements(user.role).map(key => {
                  const current = currentByKey[key];
                  const tone = signatureTone(user, key, current);
                  const signed = signatureFor(user, key);
                  const label = key[0].toUpperCase() + key.slice(1);
                  let copy = `${label}: not signed`;
                  if (tone === 'current' && signed) {
                    copy = `${label}: signed v${signed.version} on ${formatTermsDate(signed.signedAt)}`;
                  } else if (tone === 'outdated' && signed) {
                    copy = `${label}: signed v${signed.version}, needs v${current}`;
                  }
                  return (
                    <StatusBadge key={key} tone={tone}>
                      {copy}
                    </StatusBadge>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
