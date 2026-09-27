import type { BadgeTone } from './pricingContent';

const TONES: Record<BadgeTone, string> = {
  brand: 'border-[#234C6A]/20 bg-[#E8EEF4] text-[#234C6A]',
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  inverse: 'border-white/30 bg-white/10 text-white',
};

export default function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${TONES[tone]}`}
    >
      {label}
    </span>
  );
}
