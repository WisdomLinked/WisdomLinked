import React from 'react';
import { STATUS_LABEL, type ClientStatus } from './clientModel';

export const STATUS_CLASS: Record<ClientStatus, string> = {
  upcoming: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  new: 'bg-sky-50 text-sky-700',
  idle: 'bg-slate-100 text-slate-700',
};

export default function StatusBadge({ status }: { status: ClientStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
