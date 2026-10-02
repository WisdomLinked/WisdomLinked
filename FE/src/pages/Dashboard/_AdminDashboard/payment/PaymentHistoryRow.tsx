import React, { useEffect, useRef, useState } from 'react';
import { Copy, MoreVertical } from 'lucide-react';
import PaymentStatusBadge from './PaymentStatusBadge';
import {
  canRefundPayment,
  canRetryPayment,
  formatAmount,
  formatDateOnly,
  formatDateTime,
  eventTypeLabel,
  partyEmails,
  shortPaymentIntent,
  typePill,
  type PaymentHistoryRow,
} from './paymentHistoryUtils';

export function PaymentKebabMenu({
  item,
  onDetails,
  onRetry,
  onRefund,
}: {
  item: PaymentHistoryRow;
  onDetails: () => void;
  onRetry: () => void;
  onRefund: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Payment actions"
        onClick={e => {
          e.stopPropagation();
          setOpen(v => !v);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-wl-muted hover:bg-wl-brandSoft hover:text-wl-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50"
      >
        <MoreVertical size={16} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[160px] rounded-xl border border-wl-line bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-wl-ink hover:bg-wl-pageAlt"
            onClick={() => {
              setOpen(false);
              onDetails();
            }}
          >
            View details
          </button>
          {item.receiptUrl ? (
            <a
              role="menuitem"
              href={item.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="block w-full px-3 py-2 text-left text-sm text-wl-ink hover:bg-wl-pageAlt"
            >
              View receipt
            </a>
          ) : null}
          {canRetryPayment(item) ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-wl-ink hover:bg-wl-pageAlt"
              onClick={() => {
                setOpen(false);
                onRetry();
              }}
            >
              Retry
            </button>
          ) : null}
          {canRefundPayment(item) ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-wl-ink hover:bg-wl-pageAlt"
              onClick={() => {
                setOpen(false);
                onRefund();
              }}
            >
              Refund
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PaymentIntentCell({ intent }: { intent?: string | null }) {
  const full = String(intent || '').trim();
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!full || !navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(full);
  };
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <span className="truncate font-mono text-xs" title={full || 'N/A'}>
        {shortPaymentIntent(full)}
      </span>
      {full ? (
        <button
          type="button"
          onClick={copy}
          aria-label="Copy payment intent"
          className="rounded p-0.5 text-wl-muted hover:text-wl-brand"
        >
          <Copy size={12} />
        </button>
      ) : null}
    </span>
  );
}

export function PaymentHistoryRow({
  item,
  index,
  showParty,
  onDetails,
  onRetry,
  onRefund,
}: {
  item: PaymentHistoryRow;
  index: number;
  showParty: boolean;
  onDetails: () => void;
  onRetry: () => void;
  onRefund: () => void;
}) {
  const parties = partyEmails(item);
  return (
    <tr
      className="cursor-pointer border-b border-wl-line text-wl-ink hover:bg-wl-pageAlt"
      onClick={onDetails}
    >
      <td className="px-3 py-3 text-center tabular-nums">{index}</td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span className="lg:hidden">{formatDateOnly(item.createdAt)}</span>
        <span className="hidden lg:inline">{formatDateTime(item.createdAt)}</span>
      </td>
      <td className="px-3 py-3 whitespace-nowrap tabular-nums">
        {formatAmount(item.amount, item.currency)}
      </td>
      {showParty ? (
        <td className="px-3 py-3">
          <span className="block max-w-[140px] truncate" title={parties.join(' · ')}>
            {parties.join(' · ') || '—'}
          </span>
        </td>
      ) : null}
      <td className="px-3 py-3">{eventTypeLabel(item)}</td>
      <td className="hidden px-3 py-3 lg:table-cell">
        <span className="block max-w-[160px] truncate" title={item.description || ''}>
          {item.description || '—'}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className="rounded-full bg-wl-brandSoft px-2 py-0.5 text-[11px] font-medium text-wl-brand">
          {typePill(item)}
        </span>
      </td>
      <td className="px-3 py-3">
        <PaymentStatusBadge status={item.status} />
      </td>
      <td className="hidden px-3 py-3 lg:table-cell">
        <PaymentIntentCell intent={item.paymentIntent} />
      </td>
      <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
        <PaymentKebabMenu item={item} onDetails={onDetails} onRetry={onRetry} onRefund={onRefund} />
      </td>
    </tr>
  );
}

export function PaymentHistoryCard({
  item,
  onDetails,
  onRetry,
  onRefund,
}: {
  item: PaymentHistoryRow;
  onDetails: () => void;
  onRetry: () => void;
  onRefund: () => void;
}) {
  return (
    <article className="rounded-xl border border-wl-line bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold tabular-nums text-wl-ink">
            {formatAmount(item.amount, item.currency)}
          </div>
          <div className="mt-1 text-[13px] text-wl-muted">{formatDateOnly(item.createdAt)}</div>
          <div className="mt-2">
            <span className="rounded-full bg-wl-brandSoft px-2 py-0.5 text-[11px] font-medium text-wl-brand">
              {typePill(item)}
            </span>
          </div>
        </div>
        <PaymentStatusBadge status={item.status} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onDetails}
          className="text-sm font-medium text-wl-brand hover:underline"
        >
          Details
        </button>
        <PaymentKebabMenu item={item} onDetails={onDetails} onRetry={onRetry} onRefund={onRefund} />
      </div>
    </article>
  );
}
