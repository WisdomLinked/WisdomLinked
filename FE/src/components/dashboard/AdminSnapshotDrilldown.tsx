import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import ClearableInput from '../ui/ClearableInput';
import {
  doFilterPaymentHistories,
  doFilterUsers,
  doGetAdminPlatformEvents,
  profileImageFetch,
  type AdminPlatformEventItem,
} from '../../api/api';
import Avatar from '../Avatar';
import { OVERLAY_Z_DIALOG } from '../../utils/overlayLayers';

export type SnapshotListType =
  | 'experts'
  | 'students'
  | 'sessions'
  | 'seminars'
  | 'payments'
  | 'refunds';

const LIST_META: Record<
  SnapshotListType,
  { title: string; empty: string; searchPlaceholder: string }
> = {
  experts: {
    title: 'Experts',
    empty: 'No experts found',
    searchPlaceholder: 'Search by name or specialty',
  },
  students: {
    title: 'Users (students)',
    empty: 'No students found',
    searchPlaceholder: 'Search by name or email',
  },
  sessions: {
    title: '1:1 sessions',
    empty: 'No 1:1 sessions found',
    searchPlaceholder: 'Search by participant or title',
  },
  seminars: {
    title: 'Seminars held',
    empty: 'No seminars found',
    searchPlaceholder: 'Search by title or host',
  },
  payments: {
    title: 'Payment records',
    empty: 'No payment records found',
    searchPlaceholder: 'Search by user or status',
  },
  refunds: {
    title: 'Refunds recorded',
    empty: 'No refunds found',
    searchPlaceholder: 'Search by user or status',
  },
};

type PersonRow = {
  kind: 'person';
  id: string;
  username: string;
  email?: string;
  image?: string;
  title?: string;
  status?: string;
};

type EventRow = {
  kind: 'event';
  id: string;
  title: string;
  start?: string;
  end?: string;
  status?: string;
  expertName?: string;
  customerName?: string;
  participantCount?: number;
  raw: AdminPlatformEventItem;
};

type PaymentRow = {
  kind: 'payment';
  id: string;
  userLabel: string;
  amountLabel: string;
  date?: string;
  status?: string;
  reason?: string;
  currency?: string;
  description?: string;
  paymentType?: string;
  raw: Record<string, any>;
};

type ListRow = PersonRow | EventRow | PaymentRow;

function money(amount?: number, currency?: string) {
  if (typeof amount !== 'number') return '—';
  const value = (amount / 100).toFixed(2);
  return currency ? `${value} ${String(currency).toUpperCase()}` : value;
}

function when(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function personName(user: { username?: string; email?: string } | null | undefined) {
  return user?.username || user?.email || '—';
}

function paymentUserLabel(row: Record<string, any>) {
  const customer = row.customer?.username || row.customer?.email;
  const expert = row.expert?.username || row.expert?.email;
  if (customer && expert) return `${customer} → ${expert}`;
  return customer || expert || '—';
}

async function loadList(type: SnapshotListType): Promise<{ rows: ListRow[]; total: number }> {
  if (type === 'experts' || type === 'students') {
    const res = await doFilterUsers({
      role: type === 'experts' ? 'expert' : 'customer',
      sortBy: 'createdAt',
      sortOrder: 'DESC',
      numPerPage: 100,
      currentPage: 0,
    });
    const users = Array.isArray(res?.result) ? res.result : [];
    const withImages = await Promise.all(
      users.map(async (u: any) => {
        if (!u?.image) return u;
        try {
          const image = await profileImageFetch(u.image, 'small');
          return { ...u, image };
        } catch {
          return u;
        }
      }),
    );
    return {
      rows: withImages.map((u: any) => ({
        kind: 'person' as const,
        id: String(u._id),
        username: u.username || u.email || 'Unknown',
        email: u.email,
        image: u.image,
        title: u.title,
        status: u.status,
      })),
      total: Number(res?.totalCount ?? withImages.length),
    };
  }

  if (type === 'sessions' || type === 'seminars') {
    const res = await doGetAdminPlatformEvents({
      scope: 'all',
      types: type === 'sessions' ? ['event'] : ['seminar'],
    });
    const items = Array.isArray(res?.items) ? res.items : [];
    return {
      rows: items.map(item => ({
        kind: 'event' as const,
        id: item.id,
        title: item.title,
        start: item.start,
        end: item.end,
        status: item.status,
        expertName: personName(item.expert),
        customerName: personName(item.customer),
        participantCount: item.participantCount,
        raw: item,
      })),
      total: items.length,
    };
  }

  const res = await doFilterPaymentHistories({
    paymentType: type === 'refunds' ? 'refund' : undefined,
    numPerPage: 100,
    currentPage: 0,
  });
  const all = Array.isArray(res?.result) ? res.result : [];
  const filtered =
    type === 'refunds'
      ? all.filter((row: any) => row.paymentType === 'refund')
      : all.filter((row: any) => row.paymentType !== 'refund');
  return {
    rows: filtered.map((row: any) => ({
      kind: 'payment' as const,
      id: String(row._id),
      userLabel: paymentUserLabel(row),
      amountLabel: money(row.amount, row.currency),
      date: row.createdAt || row.updatedAt,
      status: row.status,
      reason: row.description,
      currency: row.currency,
      description: row.description,
      paymentType: row.paymentType,
      raw: row,
    })),
      total: filtered.length,
  };
}

function matchesQuery(row: ListRow, q: string) {
  if (!q) return true;
  const hay =
    row.kind === 'person'
      ? `${row.username} ${row.email || ''} ${row.title || ''} ${row.status || ''}`
      : row.kind === 'event'
        ? `${row.title} ${row.expertName || ''} ${row.customerName || ''} ${row.status || ''}`
        : `${row.userLabel} ${row.amountLabel} ${row.status || ''} ${row.reason || ''}`;
  return hay.toLowerCase().includes(q);
}

function RecordDetailModal({
  record,
  listType,
  onClose,
}: {
  record: EventRow | PaymentRow;
  listType: SnapshotListType;
  onClose: () => void;
}) {
  const title =
    listType === 'sessions'
      ? 'Session details'
      : listType === 'seminars'
        ? 'Seminar details'
        : listType === 'refunds'
          ? 'Refund details'
          : 'Payment details';

  const fields =
    record.kind === 'event'
      ? [
          { label: 'Title', value: record.title },
          {
            label: listType === 'seminars' ? 'Host' : 'Expert',
            value: record.expertName,
          },
          ...(listType === 'sessions'
            ? [{ label: 'Student', value: record.customerName }]
            : [{ label: 'Attendees', value: String(record.participantCount ?? '—') }]),
          { label: 'Starts', value: when(record.start) },
          { label: 'Ends', value: when(record.end) },
          { label: 'Status', value: record.status || '—' },
        ]
      : [
          { label: 'User', value: record.userLabel },
          { label: 'Amount', value: record.amountLabel },
          { label: 'Date', value: when(record.date) },
          { label: 'Status', value: record.status || '—' },
          {
            label: listType === 'refunds' ? 'Reason' : 'Description',
            value: record.reason || '—',
          },
          { label: 'Type', value: record.paymentType || '—' },
        ];

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[6px]"
      style={{ zIndex: OVERLAY_Z_DIALOG + 50 }}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-2xl border border-wl-line bg-wl-card p-5 text-left shadow-[0_16px_40px_rgba(35,76,106,0.16)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-wl-brand">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-wl-muted hover:bg-wl-pageAlt hover:text-wl-ink"
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </div>
        <dl className="space-y-3">
          {fields.map(field => (
            <div key={field.label}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-wl-muted">
                {field.label}
              </dt>
              <dd className="mt-0.5 text-sm text-wl-ink">{field.value || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>,
    document.body,
  );
}

export default function AdminSnapshotDrilldown({
  listType,
  onClose,
  onPersonClick,
}: {
  listType: SnapshotListType;
  onClose: () => void;
  onPersonClick: (person: { userId: string; username?: string; image?: string | null }) => void;
}) {
  const meta = LIST_META[listType];
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [activeRecord, setActiveRecord] = useState<EventRow | PaymentRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setQuery('');
    setActiveRecord(null);
    (async () => {
      try {
        const data = await loadList(listType);
        if (!cancelled) {
          setRows(data.rows);
          setTotal(data.total);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listType]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeRecord) setActiveRecord(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeRecord, onClose]);

  const filtered = useMemo(
    () => rows.filter(row => matchesQuery(row, query.trim().toLowerCase())),
    [rows, query],
  );

  return (
    <>
      {createPortal(
        <div className="fixed inset-0" style={{ zIndex: OVERLAY_Z_DIALOG }} role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[4px]"
            aria-label="Close list"
            onClick={onClose}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={meta.title}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-wl-line bg-wl-card shadow-[0_16px_40px_rgba(35,76,106,0.18)] sm:max-w-lg"
          >
            <div className="flex items-start justify-between gap-3 border-b border-wl-line px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-wl-brand">{meta.title}</h2>
                <span className="mt-1 inline-flex rounded-full bg-wl-brandSoft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-wl-brand">
                  {loading ? '—' : filtered.length}
                  {!loading && total !== filtered.length ? ` of ${total}` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-wl-muted hover:bg-wl-pageAlt hover:text-wl-ink"
                aria-label="Close list"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-wl-line px-5 py-3">
              <label className="relative block">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-wl-muted"
                  aria-hidden
                />
                <ClearableInput
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={meta.searchPlaceholder}
                  className="pl-9"
                />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-wl-line bg-wl-card/50 text-sm text-wl-muted">
                  Loading {meta.title.toLowerCase()}…
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-wl-line bg-wl-card/60 px-6 py-16 text-center text-sm text-wl-muted">
                  {meta.empty}
                </div>
              ) : (
                <ul className="space-y-2">
                  {filtered.map(row => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (row.kind === 'person') {
                            onPersonClick({
                              userId: row.id,
                              username: row.username,
                              image: row.image || null,
                            });
                            return;
                          }
                          setActiveRecord(row);
                        }}
                        className="w-full rounded-xl border border-wl-line bg-white px-3 py-3 text-left shadow-[0_4px_14px_rgba(35,76,106,0.04)] transition hover:border-wl-brand/30 hover:bg-wl-brandSoft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50"
                      >
                        {row.kind === 'person' && (
                          <div className="flex items-center gap-3">
                            <Avatar username={row.username} image={row.image} size="small" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-wl-ink">
                                {row.username}
                              </div>
                              <div className="truncate text-[13px] text-wl-muted">
                                {listType === 'experts'
                                  ? row.title || 'No specialty listed'
                                  : row.email || 'No email'}
                              </div>
                            </div>
                            {row.status ? (
                              <span className="shrink-0 rounded-full bg-wl-pageAlt px-2 py-0.5 text-[11px] font-medium capitalize text-wl-muted">
                                {row.status}
                              </span>
                            ) : null}
                          </div>
                        )}
                        {row.kind === 'event' && (
                          <div>
                            <div className="text-sm font-semibold text-wl-ink">{row.title}</div>
                            <div className="mt-1 text-[13px] text-wl-muted">
                              {listType === 'seminars'
                                ? `${row.expertName} · ${row.participantCount ?? 0} attendees`
                                : `${row.expertName} · ${row.customerName}`}
                            </div>
                            <div className="mt-1 text-[12px] text-wl-muted">
                              {when(row.start)}
                              {row.status ? ` · ${row.status}` : ''}
                            </div>
                          </div>
                        )}
                        {row.kind === 'payment' && (
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-wl-ink">
                                {row.userLabel}
                              </div>
                              <div className="mt-1 text-[13px] text-wl-muted">
                                {when(row.date)}
                                {row.reason ? ` · ${row.reason}` : ''}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-sm font-semibold tabular-nums text-wl-ink">
                                {row.amountLabel}
                              </div>
                              <div className="text-[11px] capitalize text-wl-muted">
                                {row.status || '—'}
                              </div>
                            </div>
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>,
        document.body,
      )}
      {activeRecord ? (
        <RecordDetailModal
          record={activeRecord}
          listType={listType}
          onClose={() => setActiveRecord(null)}
        />
      ) : null}
    </>
  );
}
