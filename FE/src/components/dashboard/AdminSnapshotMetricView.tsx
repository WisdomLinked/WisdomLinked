import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  Presentation,
  Search,
  Undo2,
  UserCircle,
  Users,
  Wallet,
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
  isValidRecordDate,
  stripRefundPrefix,
} from '../../utils/adminSnapshotDisplay';
import { formatProfileLocation } from '../../utils/profileLocation';
import { isLoginLocked } from '../../pages/Dashboard/_AdminDashboard/usermgmt/userStatus';
import SnapshotKpiStrip, { paymentKpis, type KpiItem } from './SnapshotKpiStrip';
import SnapshotMonthlyChart from './SnapshotMonthlyChart';
import { AvatarMark, DateCell, Field, FOCUS, Section, StatusPill, UserCell } from './records/RecordAtoms';
import RecordDetailPanel from './records/RecordDetailPanel';
import { PaymentDetailFields, paymentHeader, toPaymentRow, type PaymentRow } from './records/paymentRecord';

const AUTH_BASE = process.env.REACT_APP_AUTH_URL || '/user/';
const PAGE_SIZE = 50;

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

type ListRow = PersonRow | EventRow | PaymentRow;

function personName(user: { username?: string; email?: string } | null | undefined) {
  return user?.username || user?.email || '';
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
    rows: filtered.map(toPaymentRow),
    total: Number(res?.totalCount ?? filtered.length),
  };
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
  return paymentHeader(row);
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

  return <PaymentDetailFields row={row} variant={listType === 'refunds' ? 'refund' : 'payment'} />;
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
  const header = row ? headerCopy(row, listType) : null;
  const status =
    row && header && listType !== 'refunds' && !header.unknownUser ? (
      <StatusPill status={row.status} locked={row.kind === 'person' && row.locked} />
    ) : undefined;
  return (
    <RecordDetailPanel header={header} status={status} onClose={onClose} variant={variant}>
      {row ? <DetailFields row={row} listType={listType} /> : null}
    </RecordDetailPanel>
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

/**
 * Cards, chart, list and details for one metric. Shared by the Overview drill-down and the
 * Payments page's Refunds tab, so both read the same numbers from the same requests.
 * Renders the in-flow content plus the phone details sheet; mount it in a plain wrapper,
 * not directly inside a `space-y-*` parent, or the fixed sheet picks up a top margin.
 */
export function SnapshotMetricBody({
  listType,
  rangeKey,
  customRange,
}: {
  listType: SnapshotListType;
  rangeKey: SnapshotRangeKey;
  customRange: SnapshotCustomRange | null;
}) {
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

  const people = listType === 'experts' || listType === 'students';

  return (
    <>
      <div className="space-y-6">
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
    </>
  );
}

export default function AdminSnapshotMetricView() {
  const { listType: listTypeParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const listType: SnapshotListType = isSnapshotListType(listTypeParam) ? listTypeParam : 'experts';
  const { rangeKey, customRange } = resolveSnapshotSelection(searchParams);
  const meta = META[listType];

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

  const goMetric = (type: SnapshotListType) => {
    navigate(`${AUTH_BASE}admindashboard/snapshot/${type}${snapshotRangeQuery(rangeKey, customRange)}`);
  };

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

        <div>
          <SnapshotMetricBody listType={listType} rangeKey={rangeKey} customRange={customRange} />
        </div>
      </div>
    </div>
  );
}
