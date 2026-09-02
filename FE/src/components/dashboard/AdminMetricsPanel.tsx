import React from 'react';
import {
  Users,
  UserCircle,
  Presentation,
  Wallet,
  Undo2,
} from 'lucide-react';
import type { AdminDashboardStatsData } from '../../api/api';

function MetricTile({
  icon: Icon,
  iconSrc,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string; size?: number; 'aria-hidden'?: boolean }>;
  iconSrc?: string;
  label: string;
  value: number;
  accent: 'brand' | 'teal' | 'slate';
}) {
  const ring =
    accent === 'brand'
      ? 'bg-wl-brandSoft text-wl-brand'
      : accent === 'teal'
        ? 'bg-emerald-50 text-green'
        : 'bg-slate-100 text-slate-600';

  return (
    <div className="flex flex-col rounded-xl border border-wl-line/80 bg-white/90 px-4 py-4 shadow-[0_4px_14px_rgba(35,76,106,0.06)] transition hover:border-wl-brand/25">
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
    </div>
  );
}

export default function AdminMetricsPanel({ stats }: { stats: AdminDashboardStatsData }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-wl-line bg-gradient-to-br from-white via-wl-card to-wl-brandSoft/30 p-6 shadow-[0_12px_40px_rgba(35,76,106,0.1)]">
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

        <div className="mt-6 space-y-6">
          <div>
            <div className="mb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-wl-brand/80">
              People
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricTile
                icon={Users}
                label="Experts"
                value={stats.expertCount}
                accent="brand"
              />
              <MetricTile
                icon={UserCircle}
                label="Users (students)"
                value={stats.customerCount}
                accent="teal"
              />
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-wl-line to-transparent" />

          <div>
            <div className="mb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-wl-brand/80">
              Sessions
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricTile
                icon={Presentation}
                iconSrc="/icons/video-call.png"
                label="1:1 sessions"
                value={stats.oneOnOneSessions}
                accent="brand"
              />
              <MetricTile
                icon={Presentation}
                label="Seminars held"
                value={stats.seminarsHeld}
                accent="slate"
              />
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-wl-line to-transparent" />

          <div>
            <div className="mb-3 text-left text-[11px] font-semibold uppercase tracking-wider text-wl-brand/80">
              Payments
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricTile
                icon={Wallet}
                label="Total payment records"
                value={stats.totalPayments}
                accent="teal"
              />
              <MetricTile
                icon={Undo2}
                label="Refunds recorded"
                value={stats.refundCount}
                accent="slate"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
