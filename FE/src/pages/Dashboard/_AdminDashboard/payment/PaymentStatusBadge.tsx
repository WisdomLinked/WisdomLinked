import React from 'react';

const STATUS_LABELS: Record<string, string> = {
  withheld: 'Withheld',
  pending: 'In Flight',
  completed: 'Paid',
  released: 'Released',
  failed: 'Failed',
  refunded: 'Refunded',
};

const STATUS_STYLES: Record<string, string> = {
  withheld: 'bg-red-500/20 text-red-700',
  pending: 'bg-amber-500/20 text-amber-700',
  completed: 'bg-green/20 text-green',
  released: 'bg-slate-500/20 text-slate-600',
  failed: 'bg-red-500/20 text-red-600',
  refunded: 'bg-slate-500/20 text-slate-600',
};

const STATUS_HINTS: Record<string, string> = {
  withheld: 'Card authorized, not charged — waiting on the host or expert to decide.',
  pending: 'A capture is in flight, or the row needs manual reconciliation.',
  completed: 'Money captured and settled.',
  released: 'Authorization released. The card was never charged.',
  failed: 'The payment did not go through.',
  refunded: 'Money was captured, then returned to the customer.',
};

export default function PaymentStatusBadge({ status }: { status?: string }) {
  const key = status || 'completed';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[key] || 'bg-slate-100 text-slate-600'}`}
      title={STATUS_HINTS[key] || ''}
    >
      {STATUS_LABELS[key] || status || 'Paid'}
    </span>
  );
}
