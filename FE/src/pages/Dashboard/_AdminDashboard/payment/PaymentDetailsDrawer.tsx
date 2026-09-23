import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { OVERLAY_Z_DIALOG } from '../../../../utils/overlayLayers';
import PaymentStatusBadge from './PaymentStatusBadge';
import {
  eventTypeLabel,
  formatAmount,
  formatDateTime,
  partyEmails,
  typePill,
  type PaymentHistoryRow,
} from './paymentHistoryUtils';

export default function PaymentDetailsDrawer({
  item,
  onClose,
}: {
  item: PaymentHistoryRow;
  onClose: () => void;
}) {
  const parties = partyEmails(item);
  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: OVERLAY_Z_DIALOG }} role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[4px]"
        aria-label="Close details"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Payment details"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-wl-line bg-wl-card p-5 shadow-[0_16px_40px_rgba(35,76,106,0.18)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-wl-brand">Payment details</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-wl-muted hover:bg-wl-pageAlt hover:text-wl-ink"
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-wl-muted">Amount</dt>
            <dd className="mt-0.5 text-wl-ink">{formatAmount(item.amount, item.currency)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-wl-muted">Status</dt>
            <dd className="mt-0.5">
              <PaymentStatusBadge status={item.status} />
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-wl-muted">Date</dt>
            <dd className="mt-0.5 text-wl-ink">{formatDateTime(item.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-wl-muted">Type</dt>
            <dd className="mt-0.5 text-wl-ink">{typePill(item)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-wl-muted">Event</dt>
            <dd className="mt-0.5 text-wl-ink">{eventTypeLabel(item)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-wl-muted">Party</dt>
            <dd className="mt-0.5 text-wl-ink">{parties.join(' · ') || '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-wl-muted">Description</dt>
            <dd className="mt-0.5 text-wl-ink">{item.description || '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-wl-muted">Payment intent</dt>
            <dd className="mt-0.5 break-all font-mono text-xs text-wl-ink">{item.paymentIntent || 'N/A'}</dd>
          </div>
        </dl>
      </aside>
    </div>,
    document.body,
  );
}
