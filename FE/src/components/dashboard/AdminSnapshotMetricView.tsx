import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  Copy,
  MousePointer2,
  Presentation,
  Search,
  Undo2,
  UserCircle,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  doFilterPaymentHistories,
  doFilterUsers,
  doGetAdminDashboardStats,
  doGetAdminPlatformEvents,
  profileImageFetch,
  type AdminDashboardStatsData,
  type AdminPlatformEventItem,
  type AdminSnapshotMonthlyPoint,
} from '../../api/api';
import type { PaymentHistoryRow } from '../../pages/Dashboard/_AdminDashboard/payment/paymentHistoryUtils';
import SnapshotRangeControl from './SnapshotRangeControl';
import {
  isAnalyticsSnapshotType,
  isSnapshotListType,
  snapshotTabTypes,
  type SnapshotListType,
} from './adminSnapshotTypes';
import {
  alignMonthlyPoints,
  resolveSnapshotSelection,
  snapshotChartMonthKeys,
  snapshotRangeBounds,
  snapshotRangePhrase,
  snapshotRangeQuery,
  type SnapshotCustomRange,
  type SnapshotRangeKey,
} from '../../utils/adminSnapshotRange';
import {
  formatHourlyPrice,
  formatMoney,
  formatMoneyByCurrency,
  formatSnapshotDateParts,
  initialsFromName,
  isValidRecordDate,
  paymentBookingStart,
  statusLabel,
  statusPillClass,
  statusTone,
  stripRefundPrefix,
} from '../../utils/adminSnapshotDisplay';
import { formatProfileLocation } from '../../utils/profileLocation';
import { isLoginLocked } from '../../pages/Dashboard/_AdminDashboard/usermgmt/userStatus';
import { OVERLAY_Z_DIALOG } from '../../utils/overlayLayers';
import SnapshotKpiStrip, { paymentKpis, type KpiItem } from './SnapshotKpiStrip';
import SnapshotMonthlyChart from './SnapshotMonthlyChart';

const AUTH_BASE = process.env.REACT_APP_AUTH_URL || '/user/';
const PAGE_SIZE = 50;
const FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50';

const META: Record<
  SnapshotListType,
  { title: string; description: string; empty: string; search: string; chart: string; chartEmpty: string }
> = {
  experts: {
    title: 'Experts',
    description: 'Everyone offering mentoring on the platform.',
    empty: 'No experts match. Try a longer date range or clear the filters.',
    search: 'Search name, email, or title',
    chart: 'New experts per month',
    chartEmpty: 'No new experts in this range',
  },
  students: {
    title: 'Students',
    description: 'Users who book sessions and attend seminars.',
    empty: 'No students match. Try a longer date range or clear the filters.',
    search: 'Search name or email',
    chart: 'New students per month',
    chartEmpty: 'No new students in this range',
  },
  sessions: {
    title: '1:1 sessions',
    description: 'Paid one-on-one sessions between experts and students.',
    empty: 'No sessions match. Try a longer date range or clear the filters.',
    search: 'Search title or participant',
    chart: '1:1 sessions held per month',
    chartEmpty: 'No 1:1 sessions in this range',
  },
  seminars: {
    title: 'Seminars',
    description: 'Group seminars hosted by experts.',
    empty: 'No seminars match. Try a longer date range or clear the filters.',
    search: 'Search title or host',
    chart: 'Seminars held per month',
    chartEmpty: 'No seminars in this range',
  },
  payments: {
    title: 'Payments',
    description: 'Every charge collected through Stripe.',
    empty: 'No payments in this range',
    search: 'Search description or email',
    chart: 'Payments collected per month',
    chartEmpty: 'No payments in this range',
  },
  refunds: {
    title: 'Refunds',
    description: 'Money returned to students, from Stripe and admin actions.',
    empty: 'No refunds match. Try a longer date range or clear the filters.',
    search: 'Search description or email',
    chart: 'Refunds per month',
    chartEmpty: 'No refunds in this range',
  },
};

const STATUS_OPTIONS: Record<SnapshotListType, { value: string; label: string }[]> = {
  experts: [
    { value: '', label: 'All statuses' },
    { value: 'review', label: 'In review' },
    { value: 'active', label: 'Active' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'locked', label: 'Locked' },
  ],
  students: [
    { value: '', label: 'All statuses' },
    { value: 'review', label: 'In review' },
    { value: 'active', label: 'Active' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'locked', label: 'Locked' },
  ],
  sessions: [
    { value: '', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    // Older 1:1s are "accepted" once confirmed, today's are "active".
    { value: 'accepted,active', label: 'Confirmed' },
    { value: 'cancelled,canceled,declined', label: 'Cancelled / declined' },
  ],
  seminars: [
    { value: '', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'pending', label: 'Pending' },
    { value: 'active', label: 'Active' },
    { value: 'cancelled', label: 'Cancelled' },
  ],
  payments: [
    { value: '', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'withheld', label: 'Withheld' },
    { value: 'released', label: 'Released' },
  ],
  refunds: [],
};

type WhenMode = 'all' | 'past' | 'upcoming';

type PersonRow = {
  kind: 'person';
  id: string;
  username: string;
  email?: string;
  image?: string;
  title?: string;
  status?: string;
  /** Sign-in lock running after 5 wrong passwords or codes; shown next to the status. */
  locked?: boolean;
  createdAt?: string;
  description?: string;
  price?: number[];
  phoneNumber?: string;
  country?: unknown;
  state?: unknown;
  city?: unknown;
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
  userMissing: boolean;
  amount?: number;
  currency?: string;
  createdAt?: string;
  status?: string;
  description?: string;
  paymentType?: string;
  bookingStart?: unknown;
  groupName?: string;
  groupType?: string;
  groupStatus?: string;
  eventTitle?: string;
  raw: PaymentHistoryRow;
};

type ListRow = PersonRow | EventRow | PaymentRow;

function personName(user: { username?: string; email?: string } | null | undefined) {
  return user?.username || user?.email || '';
}

function paymentUser(row: PaymentHistoryRow): { label: string; missing: boolean; email?: string } {
  const customerName = row.customer?.username || row.customer?.email;
  const expertName = row.expert?.username || row.expert?.email;
  const email = row.customer?.email || row.expert?.email || undefined;
  if (customerName && expertName) {
    return { label: `${customerName} → ${expertName}`, missing: false, email };
  }
  if (customerName || expertName) {
    return { label: customerName || expertName || '', missing: false, email };
  }
  return { label: 'Unknown user', missing: true };
}

function StatusPill({ status, locked = false }: { status?: string; locked?: boolean }) {
  if (!status) return null;
  const tone = statusTone(status);
  return (
    <span className={`inline-flex items-baseline rounded-full px-2.5 py-0.5 text-xs font-medium ${statusPillClass(tone)}`}>
      {statusLabel(status)}
      {locked ? (
        <span data-testid="snapshot-locked-tag" className="ml-1 text-[10px] font-normal text-rose-600">
          (locked)
        </span>
      ) : null}
    </span>
  );
}

function DateCell({ value }: { value: unknown }) {
  const parts = formatSnapshotDateParts(value);
  if (parts.missing) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-800">
        <AlertTriangle size={14} aria-hidden />
        No date set
      </span>
    );
  }
  return (
    <span className="block min-w-0">
      <span className="block tabular-nums text-ink">{parts.date}</span>
      <span className="block text-xs text-muted">
        {parts.time} · {parts.relative}
      </span>
    </span>
  );
}

function UserCell({ label, missing }: { label: string; missing: boolean }) {
  if (missing) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-800">
        <AlertTriangle size={14} aria-hidden />
        Unknown user
      </span>
    );
  }
  return <span className="break-words">{label}</span>;
}

function AvatarMark({
  name,
  image,
  size = 36,
}: {
  name: string;
  image?: string;
  size?: number;
}) {
  const dim = `${size}px`;
  if (image) {
    return (
      <img
        src={image}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: dim, height: dim }}
      />
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-wl-brand"
      style={{ width: dim, height: dim }}
    >
      {initialsFromName(name)}
    </span>
  );
}

function ofTotalHint(count: number | undefined): string | undefined {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return undefined;
  return `of ${count.toLocaleString()} total`;
}


function kpisFor(type: SnapshotListType, stats: AdminDashboardStatsData | null): KpiItem[] {
  const range = stats?.range;
  if (!range || !stats) return [];
  if (type === 'experts') {
    return [
      { label: 'Total', value: stats.expertCount.toLocaleString() },
      {
        label: 'Joined in range',
        value: range.expertsJoined.toLocaleString(),
        hint: ofTotalHint(stats.expertCount),
      },
      { label: 'Awaiting review', value: (stats.expertReviewCount ?? 0).toLocaleString() },
    ];
  }
  if (type === 'students') {
    return [
      { label: 'Total', value: stats.customerCount.toLocaleString() },
      {
        label: 'Joined in range',
        value: range.customersJoined.toLocaleString(),
        hint: ofTotalHint(stats.customerCount),
      },
      { label: 'Blocked', value: (stats.customerBlockedCount ?? 0).toLocaleString() },
    ];
  }
  if (type === 'sessions') {
    return [
      { label: 'Held', value: range.sessionsHeld.toLocaleString() },
      { label: 'Cancelled / declined', value: range.sessionsCancelled.toLocaleString() },
      { label: 'Upcoming', value: (stats.upcomingSessions ?? 0).toLocaleString() },
    ];
  }
  if (type === 'seminars') {
    const avg =
      range.seminarsHeld > 0 ? (range.seminarsAttendees / range.seminarsHeld).toFixed(1) : '';
    return [
      { label: 'Held', value: range.seminarsHeld.toLocaleString() },
      {
        label: 'Total attendees',
        value: range.seminarsAttendees.toLocaleString(),
        hint:
          range.seminarsHeld > 0
            ? `across ${range.seminarsHeld.toLocaleString()} seminars`
            : undefined,
      },
      ...(avg ? [{ label: 'Average attendance', value: avg }] : []),
      { label: 'Upcoming', value: (stats.upcomingSeminars ?? 0).toLocaleString() },
    ];
  }
  if (type === 'payments') return paymentKpis(range);
  const rate =
    range.paymentsCount > 0
      ? `${Math.round((range.refundsCount / range.paymentsCount) * 1000) / 10}%`
      : '';
  return [
    { label: 'Count', value: range.refundsCount.toLocaleString() },
    { label: 'Amount returned', value: formatMoneyByCurrency(range.refundsAmountByCurrency, { fractionDigits: 0 }) || '—' },
    ...(rate ? [{ label: 'Refund rate', value: rate }] : []),
    {
      label: 'No linked user',
      value: range.refundsUnlinked.toLocaleString(),
      hint: ofTotalHint(range.refundsCount),
    },
  ];
}

function monthlySeriesFor(
  type: SnapshotListType,
  stats: AdminDashboardStatsData | null,
  rangeKey: SnapshotRangeKey,
  customRange?: SnapshotCustomRange | null,
) {
  const monthly = stats?.monthly;
  if (!monthly) return { points: undefined as AdminSnapshotMonthlyPoint[] | undefined, useAmount: false };
  const raw =
    type === 'experts'
      ? monthly.experts
      : type === 'students'
        ? monthly.customers
        : type === 'sessions'
          ? monthly.sessions
          : type === 'seminars'
            ? monthly.seminars
            : type === 'payments'
              ? monthly.payments
              : monthly.refunds;
  const useAmount = type === 'payments';
  const dataMonths = [
    ...(monthly.experts || []),
    ...(monthly.customers || []),
    ...(monthly.sessions || []),
    ...(monthly.seminars || []),
    ...(monthly.payments || []),
    ...(monthly.refunds || []),
  ].map(p => p.month);
  const keys = snapshotChartMonthKeys(rangeKey, customRange, dataMonths);
  return {
    points: alignMonthlyPoints(keys, raw) as AdminSnapshotMonthlyPoint[],
    useAmount,
  };
}

function countLabel(n: number, singular: string, plural: string) {
  return `${n.toLocaleString()} ${n === 1 ? singular : plural}`;
}

function hasWhenToggle(type: SnapshotListType) {
  return type === 'sessions' || type === 'seminars' || type === 'payments';
}

function listSummary(
  type: SnapshotListType,
  total: number,
  whenMode: WhenMode,
  rangeKey: SnapshotRangeKey,
  customRange?: SnapshotCustomRange | null,
): string {
  const range = snapshotRangePhrase(rangeKey, customRange);
  const upcoming = whenMode === 'upcoming';
  if (type === 'experts') {
    return `${countLabel(total, 'expert', 'experts')} · all accounts, activity counted for ${range}`;
  }
  if (type === 'students') {
    return `${countLabel(total, 'student', 'students')} · all accounts, activity counted for ${range}`;
  }
  if (upcoming) {
    if (type === 'sessions') return `${countLabel(total, 'upcoming session', 'upcoming sessions')} · not limited by the date range`;
    if (type === 'seminars') return `${countLabel(total, 'upcoming seminar', 'upcoming seminars')} · not limited by the date range`;
    if (type === 'payments') return `${countLabel(total, 'upcoming payment', 'upcoming payments')} · not limited by the date range`;
  }
  if (type === 'sessions') return `${countLabel(total, 'session', 'sessions')} · ${range}`;
  if (type === 'seminars') return `${countLabel(total, 'seminar', 'seminars')} · ${range}`;
  if (type === 'payments') return `${countLabel(total, 'payment', 'payments')} · ${range}`;
  return `${countLabel(total, 'refund', 'refunds')} · ${range}`;
}

async function fetchPage(
  type: SnapshotListType,
  args: {
    page: number;
    rangeKey: SnapshotRangeKey;
    customRange?: SnapshotCustomRange | null;
    whenMode: WhenMode;
    status: string;
    q: string;
  },
): Promise<{ rows: ListRow[]; total: number }> {
  const bounds = snapshotRangeBounds(args.rangeKey, new Date(), args.customRange);
  const sendRange = args.whenMode !== 'upcoming' && args.rangeKey !== 'all';

  if (type === 'experts' || type === 'students') {
    const res = await doFilterUsers({
      role: type === 'experts' ? 'expert' : 'customer',
      sortBy: 'createdAt',
      sortOrder: 'DESC',
      numPerPage: PAGE_SIZE,
      currentPage: args.page,
      status: args.status || undefined,
      q: args.q || undefined,
      ...(sendRange ? bounds : {}),
    });
    type ApiUser = PersonRow & { _id?: string; loginLock?: { lockedUntil?: string | null } | null };
    const users = Array.isArray(res?.result) ? (res.result as ApiUser[]) : [];
    const withImages = await Promise.all(
      users.map(async u => {
        if (!u?.image) return u;
        try {
          const image = await profileImageFetch(u.image, 'small');
          return { ...u, image: typeof image === 'string' ? image : u.image };
        } catch {
          return u;
        }
      }),
    );
    return {
      rows: withImages.map(u => ({
        kind: 'person' as const,
        id: String(u._id || u.id || ''),
        username: u.username || u.email || 'Unknown',
        email: u.email,
        image: u.image,
        title: u.title,
        status: u.status,
        locked: isLoginLocked(u.loginLock),
        createdAt: u.createdAt,
        description: u.description,
        price: u.price,
        phoneNumber: u.phoneNumber,
        country: u.country,
        state: u.state,
        city: u.city,
      })),
      total: Number(res?.totalCount ?? withImages.length),
    };
  }

  if (type === 'sessions' || type === 'seminars') {
    const scope = args.whenMode === 'upcoming' ? 'upcoming' : 'past';
    const res = await doGetAdminPlatformEvents({
      scope,
      types: type === 'sessions' ? ['event', 'oneToOne'] : ['seminar'],
      page: args.page,
      limit: PAGE_SIZE,
      q: args.q || undefined,
      status: args.status || undefined,
      ...(sendRange ? bounds : {}),
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
      total: Number(res?.totalCount ?? items.length),
    };
  }

  const looksLikeEmail = (args.q || '').includes('@');
  const res = await doFilterPaymentHistories({
    paymentType: type === 'refunds' ? 'refund' : undefined,
    excludeRefunds: type === 'payments' ? true : undefined,
    numPerPage: PAGE_SIZE,
    currentPage: args.page,
    status: args.status || undefined,
    q: looksLikeEmail ? undefined : args.q || undefined,
    email: looksLikeEmail ? args.q : undefined,
    bookingScope: args.whenMode === 'all' ? undefined : args.whenMode,
    // Stripe mode is enforced server-side via PAYMENTS_VISIBLE_MODE.
    ...(args.whenMode === 'upcoming' || args.rangeKey === 'all' ? {} : bounds),
  });
  if (res === false) {
    throw new Error('Could not load payments');
  }
  const all = Array.isArray(res?.result) ? (res.result as PaymentHistoryRow[]) : [];
  const filtered =
    type === 'refunds'
      ? all.filter(row => row.paymentType === 'refund')
      : all.filter(row => row.paymentType !== 'refund' && row.status !== 'refunded');
  return {
    rows: filtered.map(row => {
      const user = paymentUser(row);
      const event = row.event && typeof row.event === 'object' ? row.event : null;
      return {
        kind: 'payment' as const,
        id: String(row._id || ''),
        userLabel: user.label,
        userMissing: user.missing,
        amount: row.amount,
        currency: row.currency,
        createdAt: row.createdAt,
        status: row.status,
        description: row.description,
        paymentType: row.paymentType,
        bookingStart: paymentBookingStart(row),
        groupName: row.groupChat?.name,
        groupType: row.groupChat?.type,
        groupStatus: row.groupChat?.status,
        eventTitle: event?.title,
        raw: row,
      };
    }),
    total: Number(res?.totalCount ?? filtered.length),
  };
}

function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  if (value == null || value === false || value === '') return null;
  if (wide) {
    return (
      <div className="min-w-0 bg-surface px-3 py-2.5">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="mt-1 whitespace-pre-line break-words text-sm font-medium text-ink">{value}</dd>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 bg-surface px-3 py-2.5">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function CopyIntent({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <code className="min-w-0 truncate font-mono text-xs text-ink">{value}</code>
      <button
        type="button"
        aria-label={copied ? 'Copied' : 'Copy payment intent'}
        className={`shrink-0 rounded p-0.5 text-muted hover:text-ink ${FOCUS}`}
        onClick={async e => {
          e.stopPropagation();
          if (!navigator.clipboard?.writeText) return;
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  if (!items.length) return null;
  return (
    <section className="min-w-0">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h4>
      <dl className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">{items}</dl>
    </section>
  );
}

function headerCopy(row: ListRow, listType: SnapshotListType) {
  if (row.kind === 'person') {
    return {
      title: row.username,
      subtitle: row.title || (listType === 'students' ? row.email : undefined),
      image: row.image,
      unknownUser: false,
    };
  }
  if (row.kind === 'event') {
    return { title: row.title, subtitle: row.expertName, image: undefined, unknownUser: false };
  }
  if (row.userMissing) {
    return {
      title: 'Unknown user',
      subtitle: formatMoney(row.amount, row.currency) || undefined,
      image: undefined,
      unknownUser: true,
    };
  }
  return {
    title: row.userLabel,
    subtitle: formatMoney(row.amount, row.currency) || undefined,
    image: undefined,
    unknownUser: false,
  };
}

function DetailFields({ row, listType }: { row: ListRow; listType: SnapshotListType }) {
  if (row.kind === 'person') {
    const header = headerCopy(row, listType);
    const location = formatProfileLocation(row);
    const joined = formatSnapshotDateParts(row.createdAt);
    const price = formatHourlyPrice(row.price);
    const showEmail = Boolean(row.email && row.email !== header.subtitle);
    return (
      <div className="space-y-5">
        <Section title="Profile">
          {showEmail ? <Field label="Email" value={row.email} /> : null}
          {row.phoneNumber ? <Field label="Phone" value={row.phoneNumber} /> : null}
          {location ? <Field label="Location" value={location} /> : null}
          <Field
            label="Joined"
            value={
              joined.missing ? (
                <span className="inline-flex items-center gap-1 text-amber-800">
                  <AlertTriangle size={14} aria-hidden />
                  No date set
                </span>
              ) : (
                <span className="tabular-nums">
                  {joined.date}
                  <span className="mt-0.5 block text-xs font-normal text-muted">
                    {joined.time} · {joined.relative}
                  </span>
                </span>
              )
            }
          />
        </Section>
        {joined.missing ? (
          <p className="text-xs text-amber-800">No account date is linked for this record.</p>
        ) : null}
        {listType === 'experts' ? (
          <Section title="Offering">
            {row.description ? <Field label="Description" value={row.description} wide /> : null}
            {price ? <Field label="Price" value={price} /> : null}
          </Section>
        ) : null}
      </div>
    );
  }

  if (row.kind === 'event') {
    const start = formatSnapshotDateParts(row.start);
    const expertEmail = row.raw.expert?.email;
    const studentEmail = row.raw.customer?.email;
    return (
      <div className="space-y-5">
        <Section title="Booking">
          {row.customerName ? <Field label="Student" value={row.customerName} /> : null}
          {studentEmail && studentEmail !== row.customerName ? (
            <Field label="Student email" value={studentEmail} />
          ) : null}
          {expertEmail && expertEmail !== row.expertName ? (
            <Field label={listType === 'seminars' ? 'Host email' : 'Expert email'} value={expertEmail} />
          ) : null}
          {listType === 'seminars' && row.participantCount != null ? (
            <Field label="Attendees" value={String(row.participantCount)} />
          ) : null}
          <Field label="Starts" value={<DateCell value={row.start} />} />
          {row.end ? <Field label="Ends" value={<DateCell value={row.end} />} /> : null}
        </Section>
        {start.missing ? (
          <p className="text-xs text-amber-800">No start date is set for this booking.</p>
        ) : null}
      </div>
    );
  }

  const reason = stripRefundPrefix(row.description);
  const hasBooking =
    listType !== 'refunds' && Boolean(row.groupName || row.eventTitle || row.bookingStart);
  const intent = String(row.raw.paymentIntent || '').trim();
  const receiptUrl = String(row.raw.receiptUrl || '').trim();
  const partyEmail = row.raw.customer?.email || row.raw.expert?.email || '';
  const stripeMode = String(row.raw.stripeMode || '').toLowerCase();
  return (
    <div className="space-y-5">
      {listType === 'refunds' && row.userMissing ? (
        <div className="flex gap-2 rounded-lg bg-warn-soft p-3 text-sm text-warn">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            No account is linked to this refund. It was recorded from Stripe without a matching user.
            Check the charge in Stripe using the payment intent below.
          </p>
        </div>
      ) : row.userMissing ? (
        <p className="text-xs text-amber-800">No account is linked to this record.</p>
      ) : null}
      <Section title={listType === 'refunds' ? 'Refund' : 'Charge'}>
        {!row.userMissing ? <Field label="User" value={row.userLabel} /> : null}
        {partyEmail ? <Field label="Email" value={partyEmail} /> : null}
        {row.paymentType ? (
          <Field
            label="Type"
            value={
              <span className="inline-flex items-center gap-2">
                {statusLabel(row.paymentType)}
                {stripeMode === 'test' ? (
                  <span className="rounded-full bg-wl-brandSoft px-2 py-0.5 text-[11px] font-medium text-wl-brand">
                    test · {row.paymentType || 'charge'}
                  </span>
                ) : null}
              </span>
            }
          />
        ) : null}
        {row.status ? <Field label="Status" value={<StatusPill status={row.status} />} /> : null}
        <Field label="Amount" value={formatMoney(row.amount, row.currency) || '—'} />
        {reason ? (
          <Field label={listType === 'refunds' ? 'Reason' : 'Description'} value={reason} wide />
        ) : null}
        <Field
          label={listType === 'refunds' ? 'Refunded' : 'Date'}
          value={<DateCell value={row.createdAt} />}
        />
        {intent ? <Field label="Payment intent" value={<CopyIntent value={intent} />} /> : null}
        {receiptUrl ? (
          <Field
            label="Receipt"
            value={
              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-wl-brand hover:underline"
              >
                Open receipt
              </a>
            }
          />
        ) : null}
      </Section>
      {!isValidRecordDate(row.createdAt) ? (
        <p className="text-xs text-amber-800">No date is set for this record.</p>
      ) : null}
      {hasBooking ? (
        <Section title="Booking">
          {row.groupName ? <Field label="Session" value={row.groupName} /> : null}
          {row.groupType ? <Field label="Kind" value={statusLabel(row.groupType)} /> : null}
          {row.groupStatus ? (
            <Field label="Session status" value={<StatusPill status={row.groupStatus} />} />
          ) : null}
          {row.eventTitle ? <Field label="Event" value={row.eventTitle} /> : null}
          {row.bookingStart ? <Field label="Booking start" value={<DateCell value={row.bookingStart} />} /> : null}
        </Section>
      ) : null}
    </div>
  );
}

function DetailPanel({
  row,
  listType,
  onClose,
  variant,
}: {
  row: ListRow | null;
  listType: SnapshotListType;
  onClose: () => void;
  variant: 'column' | 'sheet';
}) {
  useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [row, onClose]);

  const header = row ? headerCopy(row, listType) : null;
  const body = (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      {row && header ? (
        <>
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line p-4">
            <div className="flex min-w-0 items-start gap-3">
              {header.unknownUser ? (
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn">
                  <AlertTriangle size={22} aria-hidden />
                </span>
              ) : (
                <AvatarMark name={header.title} image={header.image} size={48} />
              )}
              <div className="min-w-0">
                <div className="break-words text-lg font-semibold text-ink">{header.title}</div>
                {header.subtitle ? (
                  <div className="mt-0.5 break-words text-sm text-muted">{header.subtitle}</div>
                ) : null}
                {listType !== 'refunds' && !header.unknownUser ? (
                  <div className="mt-1.5">
                    <StatusPill status={row.status} locked={row.kind === 'person' && row.locked} />
                  </div>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-md p-1 text-muted hover:bg-sunken hover:text-ink ${FOCUS}`}
              aria-label="Close details"
            >
              <X size={18} />
            </button>
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
            <DetailFields row={row} listType={listType} />
          </div>
        </>
      ) : (
        <div className="flex h-full min-w-0 flex-col items-center justify-center px-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sunken text-muted">
            <MousePointer2 size={20} aria-hidden />
          </div>
          <p className="font-medium text-ink">Nothing selected</p>
          <p className="mt-1 text-sm text-muted">Select a row to see details.</p>
        </div>
      )}
    </div>
  );

  if (variant === 'column') {
    return (
      <aside className="hidden min-h-0 min-w-0 flex-col border-l border-line bg-surface lg:flex">
        {body}
      </aside>
    );
  }

  if (!row) return null;
  return (
    <div
      className="fixed inset-0 lg:hidden"
      style={{ zIndex: OVERLAY_Z_DIALOG }}
      role="dialog"
      aria-modal="true"
      aria-label="Record details"
    >
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close details" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-xl bg-surface shadow-[0_-8px_32px_rgba(35,76,106,0.16)]">
        <div className="h-[min(85vh,640px)]">{body}</div>
      </div>
    </div>
  );
}

function MetricIcon({ type }: { type: SnapshotListType }) {
  if (type === 'experts') return <Users size={22} />;
  if (type === 'students') return <UserCircle size={22} />;
  if (type === 'refunds') return <Undo2 size={22} />;
  if (type === 'payments') return <Wallet size={22} />;
  return <Presentation size={22} />;
}

function whenTabs(listType: SnapshotListType): { id: WhenMode; label: string }[] {
  if (listType === 'payments') {
    return [
      { id: 'all', label: 'All' },
      { id: 'past', label: 'Past bookings' },
      { id: 'upcoming', label: 'Upcoming bookings' },
    ];
  }
  return [
    { id: 'past', label: 'Past' },
    { id: 'upcoming', label: 'Upcoming' },
  ];
}

export default function AdminSnapshotMetricView() {
  const { listType: listTypeParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const listType: SnapshotListType = isSnapshotListType(listTypeParam) ? listTypeParam : 'experts';
  const { rangeKey, customRange } = resolveSnapshotSelection(searchParams);
  const meta = META[listType];

  const [stats, setStats] = useState<AdminDashboardStatsData | null>(null);
  const [whenMode, setWhenMode] = useState<WhenMode>(
    listType === 'payments' || listType === 'refunds' ? 'all' : 'past',
  );
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [rows, setRows] = useState<ListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ListRow | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);

  const setRangeKey = (next: SnapshotRangeKey, custom?: SnapshotCustomRange) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('range', next);
    if (next === 'custom' && custom) {
      nextParams.set('startDate', custom.startDate);
      nextParams.set('endDate', custom.endDate);
    } else {
      nextParams.delete('startDate');
      nextParams.delete('endDate');
    }
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setWhenMode(listType === 'payments' || listType === 'refunds' ? 'all' : 'past');
    setStatus('');
    setQuery('');
    setDebouncedQuery('');
    setSelected(null);
  }, [listType]);

  useEffect(() => {
    let cancelled = false;
    const bounds = snapshotRangeBounds(rangeKey, new Date(), customRange);
    (async () => {
      const res = await doGetAdminDashboardStats(bounds);
      if (!cancelled && res?.status === 'SUCCESS' && res.data) setStats(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [rangeKey, customRange?.startDate, customRange?.endDate]);

  const loadArgs = useMemo(
    () => ({ page: 0, rangeKey, customRange, whenMode, status, q: debouncedQuery }),
    [rangeKey, customRange?.startDate, customRange?.endDate, whenMode, status, debouncedQuery],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setListError(null);
    setPage(0);
    (async () => {
      try {
        const result = await fetchPage(listType, loadArgs);
        if (cancelled) return;
        setRows(result.rows);
        setTotal(result.total);
        setLoading(false);
        const desktop = Boolean(window.matchMedia?.('(min-width: 1024px)')?.matches);
        setSelected(desktop && result.rows.length ? result.rows[0] : null);
      } catch {
        if (cancelled) return;
        setRows([]);
        setTotal(0);
        setSelected(null);
        setListError('Could not load this list. Try again.');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listType, loadArgs]);

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const result = await fetchPage(listType, { ...loadArgs, page: nextPage });
      setRows(prev => [...prev, ...result.rows]);
      setTotal(result.total);
      setPage(nextPage);
    } catch {
      setListError('Could not load more rows. Try again.');
    } finally {
      setLoadingMore(false);
    }
  }, [listType, loadArgs, page]);

  useEffect(() => {
    if (!selected) return;
    const nodes = listScrollRef.current?.querySelectorAll(`[data-row-id="${selected.id}"]`);
    const visible = Array.from(nodes || []).find(node => (node as HTMLElement).offsetParent !== null);
    (visible as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const chart = monthlySeriesFor(listType, stats, rangeKey, customRange);
  const kpis = kpisFor(listType, stats);
  const showWhen = hasWhenToggle(listType);
  const showStatusFilter = STATUS_OPTIONS[listType].length > 0;
  const paymentsHaveBooking = rows.some(
    row => row.kind === 'payment' && isValidRecordDate(row.bookingStart),
  );

  const goMetric = (type: SnapshotListType) => {
    navigate(`${AUTH_BASE}admindashboard/snapshot/${type}${snapshotRangeQuery(rangeKey, customRange)}`);
  };

  const people = listType === 'experts' || listType === 'students';

  return (
    <div className="px-4 py-7 sm:px-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Link
              to={
                isAnalyticsSnapshotType(listType)
                  ? `${AUTH_BASE}admindashboard/analytics${snapshotRangeQuery(rangeKey, customRange)}`
                  : `${AUTH_BASE}admindashboard${snapshotRangeQuery(rangeKey, customRange)}`
              }
              className={`text-sm text-wl-brand hover:underline ${FOCUS}`}
            >
              {isAnalyticsSnapshotType(listType) ? '← Analytics' : '← Overview'}
            </Link>
            <div className="mt-2 flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-wl-brand" aria-hidden>
                <MetricIcon type={listType} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-ink">{meta.title}</h2>
                <p className="text-sm text-muted">{meta.description}</p>
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <SnapshotRangeControl value={rangeKey} customRange={customRange} onChange={setRangeKey} />
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap gap-2">
          {snapshotTabTypes(listType).map(type => (
            <button
              key={type}
              type="button"
              aria-current={type === listType ? 'page' : undefined}
              onClick={() => goMetric(type)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${FOCUS} ${
                type === listType ? 'bg-wl-brand text-white' : 'bg-surface text-muted ring-1 ring-line'
              }`}
            >
              {META[type].title}
            </button>
          ))}
        </div>

        <SnapshotKpiStrip kpis={kpis} />

        <SnapshotMonthlyChart
          points={chart.points}
          useAmount={chart.useAmount}
          title={meta.chart}
          emptyLabel={meta.chartEmpty}
        />

        <div className="grid min-w-0 overflow-hidden rounded-xl border border-line bg-surface lg:h-[640px] lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="flex shrink-0 min-w-0 flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center">
              {showWhen ? (
                <div className="shrink-0" role="tablist" aria-label="Past or upcoming">
                  {whenTabs(listType).map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={whenMode === tab.id}
                      onClick={() => setWhenMode(tab.id)}
                      className={`mr-1 rounded-full px-3 py-1.5 text-xs font-medium ${FOCUS} ${
                        whenMode === tab.id ? 'bg-wl-brand text-white' : 'bg-sunken text-muted'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="relative min-w-0 flex-1">
                <label htmlFor="snapshot-search" className="sr-only">
                  Search
                </label>
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  id="snapshot-search"
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={meta.search}
                  className={`h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted ${FOCUS}`}
                />
              </div>
              {showStatusFilter ? (
                <div className="shrink-0">
                  <label htmlFor="snapshot-status" className="sr-only">
                    Status
                  </label>
                  <select
                    id="snapshot-status"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className={`h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink ${FOCUS}`}
                  >
                    {STATUS_OPTIONS[listType].map(opt => (
                      <option key={opt.value || 'all'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2 bg-sunken px-4 py-2 text-xs text-muted">
              <Calendar size={14} aria-hidden className="shrink-0" />
              <span>{listSummary(listType, total, whenMode, rangeKey, customRange)}</span>
            </div>

            <div ref={listScrollRef} className="min-h-0 min-w-0 flex-1 overflow-auto">
              {loading ? (
                <p className="p-4 text-sm text-muted">Loading…</p>
              ) : listError ? (
                <p className="p-4 text-sm text-warn">{listError}</p>
              ) : rows.length === 0 ? (
                <p className="p-4 text-sm text-muted">{meta.empty}</p>
              ) : (
                <>
                  <div className="hidden md:block">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-surface">
                        <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                          {people ? (
                            <>
                              <th className="px-4 py-2.5 font-semibold">Name</th>
                              <th className="px-4 py-2.5 font-semibold">Status</th>
                              <th className="px-4 py-2.5 font-semibold">Joined</th>
                            </>
                          ) : listType === 'sessions' || listType === 'seminars' ? (
                            <>
                              <th className="px-4 py-2.5 font-semibold">Title</th>
                              <th className="px-4 py-2.5 font-semibold">Host</th>
                              <th className={`px-4 py-2.5 font-semibold ${listType === 'seminars' ? 'text-right' : ''}`}>
                                {listType === 'sessions' ? 'Student' : 'Attendees'}
                              </th>
                              <th className="px-4 py-2.5 font-semibold">Starts</th>
                              <th className="px-4 py-2.5 font-semibold">Status</th>
                            </>
                          ) : listType === 'refunds' ? (
                            <>
                              <th className="px-4 py-2.5 font-semibold">Refunded</th>
                              <th className="px-4 py-2.5 font-semibold">User</th>
                              <th className="px-4 py-2.5 font-semibold">Reason</th>
                              <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                            </>
                          ) : (
                            <>
                              <th className="px-4 py-2.5 font-semibold">User</th>
                              <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                              <th className="px-4 py-2.5 font-semibold">Date</th>
                              {paymentsHaveBooking ? (
                                <th className="px-4 py-2.5 font-semibold">Booking</th>
                              ) : null}
                              <th className="px-4 py-2.5 font-semibold">Status</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(row => {
                          const isSelected = selected?.id === row.id;
                          return (
                            <tr
                              key={row.id}
                              data-row-id={row.id}
                              tabIndex={0}
                              onClick={() => setSelected(row)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelected(row);
                                }
                              }}
                              className={`cursor-pointer border-b border-line ${FOCUS} ${
                                isSelected ? 'bg-brand-soft' : 'hover:bg-sunken'
                              }`}
                            >
                              {row.kind === 'person' ? (
                                <>
                                  <td className="px-4 py-2.5">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <AvatarMark name={row.username} image={row.image} />
                                      <span className="min-w-0">
                                        <span className="block truncate font-medium text-ink">{row.username}</span>
                                        {listType === 'experts' && row.title ? (
                                          <span className="block truncate text-xs text-muted">{row.title}</span>
                                        ) : null}
                                        {listType === 'students' && row.email ? (
                                          <span className="block truncate text-xs text-muted">{row.email}</span>
                                        ) : null}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <StatusPill status={row.status} locked={row.locked} />
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <DateCell value={row.createdAt} />
                                  </td>
                                </>
                              ) : row.kind === 'event' ? (
                                <>
                                  <td className="min-w-0 px-4 py-2.5 break-words">{row.title}</td>
                                  <td className="min-w-0 px-4 py-2.5 break-words">{row.expertName || ''}</td>
                                  <td className={`px-4 py-2.5 ${listType === 'seminars' ? 'text-right tabular-nums' : 'min-w-0 break-words'}`}>
                                    {listType === 'sessions' ? row.customerName || '' : String(row.participantCount ?? '')}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <DateCell value={row.start} />
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <StatusPill status={row.status} />
                                  </td>
                                </>
                              ) : listType === 'refunds' ? (
                                <>
                                  <td className="px-4 py-2.5">
                                    <DateCell value={row.createdAt} />
                                  </td>
                                  <td className="min-w-0 px-4 py-2.5">
                                    <UserCell label={row.userLabel} missing={row.userMissing} />
                                  </td>
                                  <td className="min-w-0 px-4 py-2.5 break-words">
                                    {stripRefundPrefix(row.description)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">
                                    {formatMoney(row.amount, row.currency)}
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="min-w-0 px-4 py-2.5">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                      <UserCell label={row.userLabel} missing={row.userMissing} />
                                      {String(row.raw.stripeMode || '').toLowerCase() === 'test' ? (
                                        <span className="shrink-0 rounded-full bg-wl-brandSoft px-2 py-0.5 text-[11px] font-medium text-wl-brand">
                                          test · {row.paymentType || 'charge'}
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">
                                    {formatMoney(row.amount, row.currency) || '—'}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <DateCell value={row.createdAt} />
                                  </td>
                                  {paymentsHaveBooking ? (
                                    <td className="px-4 py-2.5">
                                      <DateCell value={row.bookingStart} />
                                    </td>
                                  ) : null}
                                  <td className="px-4 py-2.5">
                                    <StatusPill status={row.status} />
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <ul className="space-y-0 md:hidden">
                    {rows.map(row => {
                      const title =
                        row.kind === 'person'
                          ? row.username
                          : row.kind === 'event'
                            ? row.title
                            : row.userMissing
                              ? 'Unknown user'
                              : row.userLabel;
                      const secondary =
                        row.kind === 'person'
                          ? listType === 'experts'
                            ? row.title
                            : row.email
                          : row.kind === 'event'
                            ? row.expertName
                            : listType === 'refunds'
                              ? stripRefundPrefix(row.description) || formatMoney(row.amount, row.currency)
                              : formatMoney(row.amount, row.currency);
                      const isSelected = selected?.id === row.id;
                      return (
                        <li key={row.id} className="border-b border-line">
                          <button
                            type="button"
                            data-row-id={row.id}
                            onClick={() => setSelected(row)}
                            className={`flex w-full items-center justify-between gap-3 p-4 text-left ${FOCUS} ${
                              isSelected ? 'bg-brand-soft' : 'hover:bg-sunken'
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              {row.kind === 'person' ? (
                                <AvatarMark name={row.username} image={row.image} />
                              ) : null}
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-ink">{title}</div>
                                {secondary ? (
                                  <div className="truncate text-xs text-muted">{secondary}</div>
                                ) : null}
                                {row.kind === 'payment' &&
                                listType === 'payments' &&
                                String(row.raw.stripeMode || '').toLowerCase() === 'test' ? (
                                  <span className="mt-1 inline-block rounded-full bg-wl-brandSoft px-2 py-0.5 text-[11px] font-medium text-wl-brand">
                                    test · {row.paymentType || 'charge'}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {listType === 'refunds' ? (
                                <span className="tabular-nums text-sm text-ink">
                                  {row.kind === 'payment' ? formatMoney(row.amount, row.currency) : ''}
                                </span>
                              ) : (
                                <StatusPill status={row.status} locked={row.kind === 'person' && row.locked} />
                              )}
                              <ChevronRight size={16} className="text-muted" aria-hidden />
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {total > 0 ? (
                    <div className="border-t border-line p-4 text-center">
                      <p className="text-xs text-muted">
                        Showing {rows.length.toLocaleString()} of {total.toLocaleString()}
                      </p>
                      {rows.length < total ? (
                        <button
                          type="button"
                          onClick={() => void loadMore()}
                          disabled={loadingMore}
                          className={`mt-2 w-full rounded-xl border border-line py-2.5 text-sm text-wl-brand hover:bg-sunken ${FOCUS} disabled:text-muted`}
                        >
                          {loadingMore ? 'Loading…' : 'Load more'}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <DetailPanel
            row={selected}
            listType={listType}
            onClose={() => setSelected(null)}
            variant="column"
          />
        </div>
      </div>

      <DetailPanel
        row={selected}
        listType={listType}
        onClose={() => setSelected(null)}
        variant="sheet"
      />
    </div>
  );
}
