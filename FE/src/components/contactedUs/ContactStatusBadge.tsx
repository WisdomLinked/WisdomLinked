import React from 'react';

export type ContactStatus = 'pending' | 'responded';

export default function ContactStatusBadge({ status }: { status: ContactStatus }) {
  const isPending = status === 'pending';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        isPending ? 'bg-wl-brandSoft text-wl-brand' : 'bg-green/15 text-green'
      }`}
    >
      {isPending ? 'Pending' : 'Responded'}
    </span>
  );
}
