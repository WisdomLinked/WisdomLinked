import React from 'react';

const tagStyles = {
  'new expert': 'bg-slate-800 text-white',
  seminar: 'bg-green-100 text-green-700',
  research: 'bg-amber-100 text-amber-700',
};

const categoryStyles = {
  Expert: 'bg-slate-100 text-slate-700',
  Seminar: 'bg-emerald-100 text-emerald-700',
  Research: 'bg-amber-100 text-amber-700',
  Opportunity: 'bg-amber-100 text-amber-700',
  default: 'bg-slate-100 text-slate-700',
};

export default function Badge({ children, category }) {
  const base =
    'inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold shadow-sm';

  const label = typeof children === 'string' ? children.trim().toLowerCase() : '';

  const cls =
    tagStyles[label] ||
    categoryStyles[category || ''] ||
    categoryStyles.default;

  return <span className={`${base} ${cls}`}>{children}</span>;
}

