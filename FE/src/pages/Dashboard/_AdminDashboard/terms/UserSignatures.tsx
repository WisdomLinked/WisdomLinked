import React from 'react';
import type { TermsAcceptanceRow } from '../../../../api/termsApi';
import { AGREEMENT_LABEL, FOCUS, agreementKeyFromAudience, formatTermsDate } from './termsModel';

export type UserSignaturesState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; rows: TermsAcceptanceRow[] };

export function audienceLabel(audience: string): string {
  const key = agreementKeyFromAudience(audience);
  return key ? AGREEMENT_LABEL[key] : audience;
}

export default function UserSignatures({
  id,
  name,
  state,
  onOpen,
}: {
  id: string;
  name: string;
  state: UserSignaturesState;
  onOpen: (row: TermsAcceptanceRow) => void;
}) {
  return (
    <div id={id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <h3 className="text-sm font-semibold text-slate-900">Signatures for {name}</h3>
      {state.status === 'loading' ? (
        <p className="mt-2 text-sm text-slate-500" role="status">
          Loading signatures…
        </p>
      ) : state.status === 'error' ? (
        <p className="mt-2 text-sm text-rose-700" role="alert">
          {state.error}
        </p>
      ) : state.rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No signatures stored.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3">Audience</th>
                <th scope="col" className="py-2 pr-3">Version</th>
                <th scope="col" className="py-2 pr-3">Time</th>
                <th scope="col" className="py-2 pr-3">IP</th>
                <th scope="col" className="py-2 pr-3">User agent</th>
                <th scope="col" className="py-2 pr-3">Account</th>
                <th scope="col" className="py-2 pr-3">Content hash</th>
                <th scope="col" className="py-2 pr-3">Typed name</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map(row => (
                <tr key={`${row.audience}-${row.version}-${row.signedAt}`} className="border-t border-slate-200 align-top">
                  <td className="py-2 pr-3 text-slate-900">{audienceLabel(row.audience)}</td>
                  <td className="py-2 pr-3 text-slate-900">v{row.version}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-slate-700">{formatTermsDate(row.signedAt)}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.ip || '—'}</td>
                  <td className="max-w-[220px] break-words py-2 pr-3 text-slate-700">{row.userAgent || '—'}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-slate-700">{row.userId}</td>
                  <td className="max-w-[180px] break-all py-2 pr-3 font-mono text-xs text-slate-700">{row.contentHash}</td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => onOpen(row)}
                      className={`${FOCUS} rounded text-left text-slate-900 underline underline-offset-2 hover:text-slate-600`}
                    >
                      {row.typedName || 'Open signature'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
