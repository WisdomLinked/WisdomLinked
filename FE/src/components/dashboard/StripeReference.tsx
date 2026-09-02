type Props = {
  value?: string | null;
};

/**
 * One Stripe id, shown in full. These get pasted into Stripe, so the whole value is
 * selectable; it wraps inside its column rather than widening the row, so every row
 * fits the table without horizontal scrolling.
 */
export default function StripeReference({ value }: Props) {
  if (!value) return <span className="text-slate-400">—</span>;

  return (
    <span
      className="block select-all break-all font-mono text-[11px] leading-4 text-slate-600"
      title={value}
    >
      {value}
    </span>
  );
}
