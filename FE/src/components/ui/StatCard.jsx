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
  icon: Icon,
  color = 'primary',
}) {
  const colors = colorMap[color] || colorMap.primary;

  return (
    <div className="relative flex items-center justify-between rounded-2xl border border-[#e8e6e1] bg-white px-6 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
      <div className="flex flex-col">
        <span className="font-sans text-[14px] font-semibold text-slate-800">
          {label}
        </span>
        <div
          className={`mt-2 font-serif text-[32px] font-bold leading-none ${colors.value}`}
        >
          {value}
        </div>
        {trend && (
          <div className="mt-1 font-sans text-[11px] font-medium text-emerald-600">
            {trend}
          </div>
        )}
      </div>
      <div
        className={`ml-4 flex h-11 w-11 items-center justify-center rounded-full ${colors.iconBg} ${colors.iconText}`}
      >
        <Icon size={20} aria-hidden="true" />
      </div>
    </div>
  );
}

