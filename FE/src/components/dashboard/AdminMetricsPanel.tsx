import React from 'react';
import {
  Users,
  UserCircle,
  Presentation,
  Wallet,
  Undo2,
} from 'lucide-react';
import type { AdminDashboardStatsData } from '../../api/api';
import type { SnapshotListType } from './AdminSnapshotDrilldown';

function MetricTile({
  icon: Icon,
  iconSrc,
  label,
  value,
  accent,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; size?: number; 'aria-hidden'?: boolean }>;
  iconSrc?: string;
  label: string;
  value: number;
  accent: 'brand' | 'teal' | 'slate';
  onClick: () => void;
}) {
  const ring =
    accent === 'brand'
      ? 'bg-wl-brandSoft text-wl-brand'
      : accent === 'teal'
        ? 'bg-emerald-50 text-green'
        : 'bg-slate-100 text-slate-600';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col rounded-xl border border-wl-line/80 bg-white/90 px-4 py-3 text-left sm:px-5 shadow-[0_4px_14px_rgba(35,76,106,0.06)] transition hover:border-wl-brand/40 hover:bg-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50 focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ring}`}
          aria-hidden
        >
          {iconSrc ? (
            <img src={iconSrc} alt="" aria-hidden className="h-[22px] w-[22px] object-contain" />
          ) : (
            <Icon size={22} strokeWidth={2} />
          )}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="text-[12px] font-medium uppercase tracking-wide text-wl-muted">
            {label}
          </div>
          <div className="mt-1 font-serif text-[28px] font-bold tabular-nums leading-none text-wl-ink">
            {value.toLocaleString()}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function AdminMetricsPanel({
  stats,
  onSelectList,
}: {
  stats: AdminDashboardStatsData;
  onSelectList: (type: SnapshotListType) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-wl-line bg-gradient-to-br from-white via-wl-card to-wl-brandSoft/30 p-5 shadow-[0_12px_40px_rgba(35,76,106,0.1)] lg:p-6">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-wl-brand/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 left-8 h-32 w-32 rounded-full bg-green/10 blur-2xl"
        aria-hidden
      />

      <div className="relative">
        <h3 className="font-sans text-lg font-semibold text-wl-brand">Platform snapshot</h3>
        <p className="mt-1 text-left text-sm text-wl-muted">
          Live counts across users, sessions, and billing.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          <div>
            <div className="mb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-wl-brand/80">
              People
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <MetricTile
                icon={Users}
                label="Experts"
                value={stats.expertCount}
                accent="brand"
                onClick={() => onSelectList('experts')}
              />
              <MetricTile
                icon={UserCircle}
                label="Users (students)"
                value={stats.customerCount}
                accent="teal"
                onClick={() => onSelectList('students')}
              />
            </div>
          </div>

          <div className="border-t border-wl-line/60 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="mb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-wl-brand/80">
              Sessions
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <MetricTile
                icon={Presentation}
                iconSrc="/icons/video-call.png"
                label="1:1 sessions"
                value={stats.oneOnOneSessions}
                accent="brand"
                onClick={() => onSelectList('sessions')}
              />
              <MetricTile
                icon={Presentation}
                label="Seminars held"
                value={stats.seminarsHeld}
                accent="slate"
                onClick={() => onSelectList('seminars')}
              />
            </div>
          </div>

          <div className="border-t border-wl-line/60 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="mb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-wl-brand/80">
              Payments
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <MetricTile
                icon={Wallet}
                label="Total payment records"
                value={stats.totalPayments}
                accent="teal"
                onClick={() => onSelectList('payments')}
              />
              <MetricTile
                icon={Undo2}
                label="Refunds recorded"
                value={stats.refundCount}
                accent="slate"
                onClick={() => onSelectList('refunds')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
