import React from 'react';
import MetricValue from '../dashboard/MetricValue';

const colorMap = {
  primary: {
    value: 'text-wl-ink',
    iconBg: 'bg-wl-brandSoft',
    iconText: 'text-wl-brand',
  },
  success: {
    value: 'text-wl-ink',
    iconBg: 'bg-emerald-50',
    iconText: 'text-green',
  },
  warning: {
    value: 'text-wl-ink',
    iconBg: 'bg-amber-50',
    iconText: 'text-brownyellow',
  },
  neutral: {
    value: 'text-wl-ink',
    iconBg: 'bg-slate-100',
    iconText: 'text-wl-muted',
  },
};

export default function StatCard({
  label,
  value,
  trend,
  subline,
  tooltip,
  icon: Icon,
  color = 'primary',
  onClick,
  className,
  alignStart,
  labelClassName,
  compact,
}: {
  label: string;
  value: string | number;
  trend?: string;
  subline?: string;
  tooltip?: string;
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  color?: keyof typeof colorMap;
  onClick?: () => void;
  className?: string;
  /** Left-align label and value (icon stays on the right). */
  alignStart?: boolean;
  /** Overrides the default label font size. */
  labelClassName?: string;
  /** Student dashboard tiles: short card, icon in the top-right. */
  compact?: boolean;
}) {
  const colors = colorMap[color] || colorMap.primary;
  const focusRing =
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand focus-visible:ring-offset-2';

  if (compact) {
    return (
      <div
        className={`relative rounded-xl border border-slate-200 bg-white p-5 text-left ${
          onClick ? `cursor-pointer hover:border-slate-300 hover:bg-slate-50 ${focusRing}` : ''
        } ${className || ''}`}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={e => {
          if (!onClick) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label={onClick ? `Open ${label}` : undefined}
        title={tooltip}
      >
        <div
          className={`absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-lg ${colors.iconBg} ${colors.iconText}`}
        >
          <Icon size={20} aria-hidden="true" />
        </div>
        <p className="pr-12 text-sm text-slate-600">{label}</p>
        <p className="mt-2 font-sans text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
        {subline ? <p className="mt-1 text-sm text-slate-500">{subline}</p> : null}
        {trend ? <p className="mt-1 text-xs font-medium text-emerald-600">{trend}</p> : null}
      </div>
    );
  }

  return (
    <div
      className={`group relative flex items-center justify-between rounded-2xl border border-wl-line bg-wl-card px-6 py-6 sm:px-8 sm:py-8 min-h-[132px] shadow-[0_10px_30px_rgba(35,76,106,0.08)] transition-transform duration-150 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(35,76,106,0.12)] text-left ${
        onClick ? 'cursor-pointer' : ''
      } ${className || ''}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={e => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={onClick ? `Open ${label}` : undefined}
    >
      <div className={`flex min-w-0 flex-1 flex-col ${alignStart ? 'items-start' : ''}`}>
        <span className={labelClassName || 'font-sans font-semibold text-[14px] text-wl-ink'}>
          {label}
        </span>
        <MetricValue size="lg">{value}</MetricValue>
        {subline && (
          <div className="mt-1 font-sans text-[13px] font-medium text-wl-muted">
            {subline}
          </div>
        )}
      </div>
      <div className="ml-3 flex flex-col items-end gap-1">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${colors.iconBg} ${colors.iconText}`}
        >
          <Icon size={22} aria-hidden="true" />
        </div>
        {trend && (
          <div className="text-[11px] font-medium text-emerald-600">
            {trend}
          </div>
        )}
      </div>
      {tooltip && (
        <div className="pointer-events-none absolute left-1/2 bottom-1 -translate-x-1/2 translate-y-full rounded-md bg-wl-brand px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 whitespace-nowrap z-20">
          {tooltip}
        </div>
      )}
    </div>
  );
}

