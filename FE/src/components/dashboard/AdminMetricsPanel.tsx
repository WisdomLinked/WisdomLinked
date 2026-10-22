import React from 'react';
import {
  Users,
  UserCircle,
  Presentation,
  Wallet,
  Undo2,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { AdminDashboardStatsData, AdminSnapshotMonthlyPoint, AmountByCurrency } from '../../api/api';
import type { SnapshotListType } from './adminSnapshotTypes';
import SnapshotRangeControl from './SnapshotRangeControl';
import {
  snapshotRangeDescription,
  type SnapshotRangeKey,
} from '../../utils/adminSnapshotRange';
import { formatMoneyByCurrency } from '../../utils/adminSnapshotDisplay';
import MetricValue from './MetricValue';

function MiniBars({
  points,
  label,
  useAmount,
}: {
  points: AdminSnapshotMonthlyPoint[] | undefined;
  label: string;
  useAmount?: boolean;
}) {
  const rows = points || [];
  const values = rows.map(p => {
    if (!useAmount) return p.count;
    const amounts = p.amountsByCurrency || {};
    return Object.values(amounts).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0);
  });
  const max = Math.max(0, ...values);
  if (!rows.length) return null;
  return (
    <div className="mt-3 flex h-8 items-end gap-0.5" aria-hidden>
      {rows.map((p, i) => {
        const v = values[i] || 0;
        const h = max > 0 ? Math.max(2, Math.round((v / max) * 100)) : 2;
        const last = i === rows.length - 1;
        return (
          <div
            key={p.month}
            title={`${p.month}: ${useAmount ? formatMoneyByCurrency(p.amountsByCurrency, { fractionDigits: 0 }) || '—' : v.toLocaleString()} ${label}`}
            className={`min-w-0 flex-1 rounded-sm ${last ? 'bg-wl-brand' : 'bg-wl-brand/25'}`}
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}

function ChangeNote({
  pct,
  invert,
}: {
  pct: number | null | undefined;
  invert?: boolean;
}) {
  if (pct == null) return null;
  const up = pct > 0;
  const down = pct < 0;
  const good = invert ? down : up;
  const Icon = up ? TrendingUp : TrendingDown;
  const color = pct === 0 ? 'text-wl-muted' : good ? 'text-green' : 'text-red';
  const signed = `${pct > 0 ? '+' : ''}${pct}%`;
  return (
    <div className={`mt-1 inline-flex items-center gap-1 text-xs font-medium tabular-nums ${color}`}>
      {pct === 0 ? null : <Icon size={12} aria-hidden />}
      <span>{signed} vs previous period</span>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  iconSrc,
  label,
  value,
  note,
  changePct,
  invertChange,
  bars,
  barLabel,
  useAmountBars,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; size?: number; 'aria-hidden'?: boolean }>;
  iconSrc?: string;
  label: string;
  value: string;
  note?: string;
  changePct?: number | null;
  invertChange?: boolean;
  bars?: AdminSnapshotMonthlyPoint[];
  barLabel: string;
  useAmountBars?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group flex w-full flex-col rounded-xl border border-wl-line bg-white p-4 text-left sm:p-5 transition hover:border-wl-brand/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50 focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wl-brandSoft text-wl-brand"
          aria-hidden
        >
          {iconSrc ? (
            <img src={iconSrc} alt="" aria-hidden className="h-[22px] w-[22px] object-contain" />
          ) : (
            <Icon size={22} strokeWidth={2} />
          )}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
            <ChevronRight
              size={16}
              className="shrink-0 text-wl-muted opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden
            />
          </div>
          <MetricValue size="lg">{value}</MetricValue>
          {note ? <div className="mt-1 text-xs text-wl-muted">{note}</div> : null}
          <ChangeNote pct={changePct} invert={invertChange} />
        </div>
      </div>
      <MiniBars points={bars} label={barLabel} useAmount={useAmountBars} />
    </button>
  );
}

function amountValue(amounts: AmountByCurrency | undefined, fallbackCount: number): string {
  return formatMoneyByCurrency(amounts, { fractionDigits: 0 }) || fallbackCount.toLocaleString();
}

export default function AdminMetricsPanel({
  stats,
  rangeKey,
  onRangeChange,
  onSelectList,
}: {
  stats: AdminDashboardStatsData;
  rangeKey: SnapshotRangeKey;
  onRangeChange: (next: SnapshotRangeKey) => void;
  onSelectList: (type: SnapshotListType) => void;
}) {
  const range = stats.range;
  const change = rangeKey === 'all' ? null : stats.change;
  const monthly = stats.monthly;
  const hideChange = rangeKey === 'all';

  return (
    <div className="rounded-xl border border-wl-line bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 text-left">
          <h3 className="font-sans text-lg font-semibold text-wl-brand">Platform snapshot</h3>
          <p className="mt-1 text-sm text-wl-muted">{snapshotRangeDescription(rangeKey)}</p>
        </div>
        <SnapshotRangeControl value={rangeKey} onChange={onRangeChange} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div>
          <div className="mb-2 text-left text-xs font-semibold uppercase tracking-wider text-wl-muted">
            People
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <MetricTile
              icon={Users}
              label="Experts"
              value={stats.expertCount.toLocaleString()}
              note={`${(range?.expertsJoined ?? 0).toLocaleString()} joined in range`}
              changePct={hideChange ? null : change?.expertsJoined}
              bars={monthly?.experts}
              barLabel="experts joined"
              onClick={() => onSelectList('experts')}
            />
            <MetricTile
              icon={UserCircle}
              label="Students"
              value={stats.customerCount.toLocaleString()}
              note={`${(range?.customersJoined ?? 0).toLocaleString()} joined in range`}
              changePct={hideChange ? null : change?.customersJoined}
              bars={monthly?.customers}
              barLabel="students joined"
              onClick={() => onSelectList('students')}
            />
          </div>
        </div>

        <div className="border-t border-wl-line/60 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="mb-2 text-left text-xs font-semibold uppercase tracking-wider text-wl-muted">
            Sessions
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <MetricTile
              icon={Presentation}
              iconSrc="/icons/video-call.png"
              label="1:1 sessions"
              value={(range?.sessionsHeld ?? 0).toLocaleString()}
              note={
                typeof stats.upcomingSessions === 'number'
                  ? `${stats.upcomingSessions.toLocaleString()} upcoming`
                  : undefined
              }
              changePct={hideChange ? null : change?.sessionsHeld}
              bars={monthly?.sessions}
              barLabel="sessions held"
              onClick={() => onSelectList('sessions')}
            />
            <MetricTile
              icon={Presentation}
              label="Seminars"
              value={(range?.seminarsHeld ?? 0).toLocaleString()}
              note={
                typeof stats.upcomingSeminars === 'number'
                  ? `${stats.upcomingSeminars.toLocaleString()} upcoming`
                  : undefined
              }
              changePct={hideChange ? null : change?.seminarsHeld}
              bars={monthly?.seminars}
              barLabel="seminars held"
              onClick={() => onSelectList('seminars')}
            />
          </div>
        </div>

        <div className="border-t border-wl-line/60 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="mb-2 text-left text-xs font-semibold uppercase tracking-wider text-wl-muted">
            Payments
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <MetricTile
              icon={Wallet}
              label="Payments"
              value={amountValue(range?.paymentsAmountByCurrency, range?.paymentsCount ?? 0)}
              note={`${(range?.paymentsCount ?? 0).toLocaleString()} records`}
              changePct={hideChange ? null : change?.paymentsCount}
              bars={monthly?.payments}
              barLabel="payments"
              onClick={() => onSelectList('payments')}
            />
            <MetricTile
              icon={Undo2}
              label="Refunds"
              value={(range?.refundsCount ?? 0).toLocaleString()}
              note={
                range?.refundsAmountByCurrency && Object.keys(range.refundsAmountByCurrency).length
                  ? `${formatMoneyByCurrency(range.refundsAmountByCurrency, { fractionDigits: 0 }) || '—'} returned`
                  : undefined
              }
              changePct={hideChange ? null : change?.refundsCount}
              invertChange
              bars={monthly?.refunds}
              barLabel="refunds"
              onClick={() => onSelectList('refunds')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
