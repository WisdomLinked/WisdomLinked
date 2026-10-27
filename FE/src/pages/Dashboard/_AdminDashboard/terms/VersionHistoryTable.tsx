import React from 'react';
import { Download, Eye, Users } from 'lucide-react';
import StatusBadge from './StatusBadge';
import {
  CARD,
  FOCUS,
  formatCount,
  formatTermsDate,
  termsUrls,
  type AgreementContract,
} from './termsModel';

export default function VersionHistoryTable({ contract }: { contract: AgreementContract }) {
  const latest = contract.versions[0]?.number;
  return (
    <section className={CARD} aria-labelledby="terms-history-heading">
      <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
        <h2 id="terms-history-heading" className="text-base font-semibold text-slate-900">
          Version history
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Older versions stay on record with the signatures collected while they were current.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-5 py-3 sm:px-6">
                Version
              </th>
              <th scope="col" className="px-5 py-3 sm:px-6">
                Published
              </th>
              <th scope="col" className="hidden px-5 py-3 md:table-cell sm:px-6">
                Change notes
              </th>
              <th scope="col" className="px-5 py-3 text-right sm:px-6">
                Accepted
              </th>
              <th scope="col" className="px-5 py-3 text-right sm:px-6">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {contract.versions.map(version => {
              const isCurrent = version.number === latest;
              const urls = termsUrls(contract.key, version.number);
              return (
                <tr key={version.number} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">v{version.number}</span>
                      {isCurrent ? <StatusBadge tone="current-version" /> : null}
                    </div>
                  </td>
                  <td className="px-5 py-4 sm:px-6">
                    <p className="text-slate-700">{formatTermsDate(version.publishedAt)}</p>
                    <p className="mt-1 text-sm text-slate-500 md:hidden">{version.notes}</p>
                  </td>
                  <td className="hidden px-5 py-4 text-slate-700 md:table-cell sm:px-6">{version.notes}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-slate-900 sm:px-6">
                    {formatCount(version.accepted)}
                  </td>
                  <td className="px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap justify-end gap-1">
                      <IconAction href={urls.html} label="Preview" external>
                        <Eye className="h-4 w-4" />
                      </IconAction>
                      <IconAction
                        href={urls.docx}
                        label="Download .docx"
                        download={`terms-${contract.key}-v${version.number}.docx`}
                      >
                        <Download className="h-4 w-4" />
                      </IconAction>
                      <IconAction href={urls.signers} label="Signers" external>
                        <Users className="h-4 w-4" />
                      </IconAction>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function IconAction({
  href,
  label,
  children,
  download,
  external,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  download?: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      download={download}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className={`${FOCUS} inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900`}
    >
      {children}
    </a>
  );
}
