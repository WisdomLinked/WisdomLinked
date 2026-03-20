import React from 'react';

const colorMap = {
  primary: {
    value: 'text-slate-900',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-700',
  },
  success: {
    value: 'text-slate-900',
    iconBg: 'bg-green-100',
    iconText: 'text-green-700',
  },
  warning: {
    value: 'text-slate-900',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-700',
  },
  neutral: {
    value: 'text-slate-900',
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-500',
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
}: {
  label: string;
  value: string | number;
  trend?: string;
  subline?: string;
  tooltip?: string;
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  color?: keyof typeof colorMap;
  onClick?: () => void;
}) {
  const colors = colorMap[color] || colorMap.primary;

  return (
    <div
      className={`group relative flex items-center justify-between rounded-2xl border border-[#e8e6e1] bg-white px-8 py-8 min-h-[148px] shadow-[0_10px_30px_rgba(0,0,0,0.06)] transition-transform duration-150 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.10)] ${
        onClick ? 'cursor-pointer' : ''
      }`}
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
      <div className="flex flex-col">
        <span className="font-sans text-[14px] font-semibold text-slate-800">
          {label}
        </span>
        <div
          className={`mt-2 font-serif text-[36px] font-bold leading-none ${colors.value}`}
        >
          {value}
        </div>
        {subline && (
          <div className="mt-1 font-sans text-[13px] font-semibold text-[#234C6A]">
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
        <div className="pointer-events-none absolute left-1/2 bottom-1 -translate-x-1/2 translate-y-full rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 whitespace-nowrap z-20">
          {tooltip}
        </div>
      )}
    </div>
  );
}

