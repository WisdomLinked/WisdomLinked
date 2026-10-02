import type { ReactNode } from 'react';
import Badge from './Badge';
import type { BadgeTone } from './pricingContent';

export const CARD_BODY_TEXT = 'text-[15px] md:text-base leading-relaxed';

type Props = {
  title: string;
  badge?: { label: string; tone: BadgeTone };
  variant?: 'default' | 'highlight';
  compact?: boolean;
  className?: string;
  children: ReactNode;
};

export default function PricingCard({
  title,
  badge,
  variant = 'default',
  compact = false,
  className = '',
  children,
}: Props) {
  const highlight = variant === 'highlight';
  return (
    <article
      className={`flex h-full flex-col rounded-2xl border ${compact ? 'p-5 md:p-6' : 'p-6 md:p-8'} transition-shadow duration-200 hover:shadow-[0_12px_32px_rgba(35,76,106,0.10)] ${
        highlight ? 'border-[#234C6A] bg-[#234C6A] text-white' : 'border-slate-200 bg-white text-slate-900'
      } ${className}`}
    >
      <header className={`${compact ? 'mb-2' : 'mb-4'} flex items-baseline justify-between gap-4`}>
        <h3 className="min-w-0 font-display text-xl font-bold md:text-2xl">{title}</h3>
        {badge ? <Badge label={badge.label} tone={badge.tone} /> : null}
      </header>
      <div className={`flex flex-1 flex-col ${highlight ? 'text-[#E5EDF5]' : 'text-slate-600'}`}>{children}</div>
    </article>
  );
}
