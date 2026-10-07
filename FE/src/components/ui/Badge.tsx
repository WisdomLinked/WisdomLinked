import React, { ReactNode } from 'react';

const tagStyles = {
  'new expert': 'bg-slate-800 text-white',
  seminar: 'bg-green-100 text-green-700',
  research: 'bg-amber-100 text-amber-700',
};

type BadgeCategory = keyof typeof categoryStyles | string;

const categoryStyles = {
  Expert: 'bg-slate-100 text-slate-700',
  Seminar: 'bg-emerald-100 text-emerald-700',
  Research: 'bg-amber-100 text-amber-700',
  Opportunity: 'bg-amber-100 text-amber-700',
  default: 'bg-slate-100 text-slate-700',
};

type BadgeProps = {
  children: ReactNode;
  category?: BadgeCategory;
  /** Renders a trailing × button; `removeLabel` is its accessible name. */
  onRemove?: () => void;
  removeLabel?: string;
};

export default function Badge({ children, category, onRemove, removeLabel }: BadgeProps) {
  const labelText =
    typeof children === 'string' ? children.trim().toLowerCase() : '';

  const base =
    'inline-flex max-w-full items-center px-2.5 py-1 rounded-full text-[11px] font-semibold shadow-sm';

  const cls =
    tagStyles[labelText] ||
    categoryStyles[category || ''] ||
    categoryStyles.default;

  if (!onRemove) return <span className={`${base} ${cls}`}>{children}</span>;

  return (
    <span className={`${base} ${cls} gap-1 pr-1`}>
      <span className="min-w-0 truncate">{children}</span>
      <button
        type="button"
        aria-label={removeLabel}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full leading-none opacity-60 transition hover:bg-black/10 hover:opacity-100 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#234C6A]/60"
      >
        <span aria-hidden>×</span>
      </button>
    </span>
  );
}

