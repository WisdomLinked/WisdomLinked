import { formatPrice } from '../../utils/formatPrice';

type Props = {
  label: string;
  amount: number | null | undefined;
  currency?: string;
  suffix?: string;
};

function spokenAmount(amount: number, currency: string): string {
  const fractionDigits = amount % 1 === 0 ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'name',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
    .format(amount)
    .replace(/US dollars/i, 'dollars');
}

function spokenSuffix(suffix?: string): string {
  if (!suffix) return '';
  if (suffix.trim() === '/ hr') return 'per hour';
  return suffix.replace(/^·\s*/, '').trim();
}

export default function PriceTag({ label, amount, currency = 'USD', suffix }: Props) {
  const formatted = formatPrice(amount, currency);
  if (formatted == null || amount == null || !Number.isFinite(amount)) return null;

  const isFree = amount === 0;
  const aria = isFree
    ? 'Free'
    : [label, spokenAmount(amount, currency), spokenSuffix(suffix)].filter(Boolean).join(' ');

  return (
    <div aria-label={aria}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${isFree ? 'text-emerald-700' : 'text-slate-900'}`}>
        {formatted}
        {!isFree && suffix ? (
          <span className="text-sm font-normal text-slate-500"> {suffix}</span>
        ) : null}
      </p>
    </div>
  );
}
