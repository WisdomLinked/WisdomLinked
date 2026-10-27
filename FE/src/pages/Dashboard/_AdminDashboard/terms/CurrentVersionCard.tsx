import React from 'react';
import { Download, Eye, Users } from 'lucide-react';
import StatusBadge from './StatusBadge';
import {
  CARD,
  FOCUS,
  acceptanceRate,
  formatCount,
  formatTermsDate,
  termsUrls,
  type AgreementContract,
} from './termsModel';

const ACTION =
  `inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${FOCUS}`;

export default function CurrentVersionCard({ contract }: { contract: AgreementContract }) {
  const current = contract.versions[0];
  const pending = Math.max(0, contract.audience - current.accepted);
  const rate = acceptanceRate(current.accepted, contract.audience);
  const urls = termsUrls(contract.key, current.number);

  return (
    <section className={`${CARD} p-5 sm:p-6`} aria-labelledby="terms-current-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="terms-current-heading" className="text-base font-semibold text-slate-900">
              {contract.label} agreement · v{current.number}
            </h2>
            <StatusBadge tone="current-version" />
          </div>
          <p className="text-sm text-slate-500">
            Audience: {contract.audienceLabel} · Published {formatTermsDate(current.publishedAt)} by{' '}
            {current.publishedBy}
          </p>
          <p className="text-sm text-slate-700">{current.notes}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className={ACTION} href={urls.html} target="_blank" rel="noreferrer">
            <Eye className="h-4 w-4" aria-hidden />
            Preview
          </a>
          <a className={ACTION} href={urls.docx} download={`terms-${contract.key}-v${current.number}.docx`}>
            <Download className="h-4 w-4" aria-hidden />
            Download .docx
          </a>
          <a className={ACTION} href={urls.signers} target="_blank" rel="noreferrer">
            <Users className="h-4 w-4" aria-hidden />
            Signers
          </a>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Accepted" value={formatCount(current.accepted)} />
        <Stat label="Pending" value={formatCount(pending)} />
        <Stat label="Audience" value={formatCount(contract.audience)} />
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">Share of audience on the current version</p>
          <p className="text-sm font-medium tabular-nums text-slate-700">{rate}%</p>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rate}
          aria-label="Acceptance progress"
        >
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${rate}%` }} />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
