type Segment = {
  /** Fill ratio from 0 to 1. */
  ratio: number;
  /** Optional flex weight so segments can mirror section weights. */
  weight?: number;
};

type Props = {
  segments: Segment[];
  label: string;
  /** Shown under the bar on the left when provided. */
  valueText?: string;
  /** Shown under the bar on the right when provided. */
  percentText?: string;
  /** Override aria-valuenow (defaults to average percent 0–100). */
  ariaValueNow?: number;
  /** Override aria-valuemax (defaults to 100). */
  ariaValueMax?: number;
  ariaValueText?: string;
};

/**
 * Multi-segment progress bar. Expert setup uses fully filled/empty segments;
 * student profile completion fills each segment by its own ratio.
 */
export default function SegmentedProgressBar({
  segments,
  label,
  valueText,
  percentText,
  ariaValueNow,
  ariaValueMax = 100,
  ariaValueText,
}: Props) {
  const ratios = segments.map((s) => Math.max(0, Math.min(1, s.ratio)));
  const average = ratios.length ? ratios.reduce((sum, r) => sum + r, 0) / ratios.length : 0;
  const valuetext =
    ariaValueText ??
    valueText ??
    (percentText ? percentText : `${Math.round(average * 100)}% complete`);

  return (
    <div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={ariaValueMax}
        aria-valuenow={ariaValueNow ?? Math.round(average * 100)}
        aria-valuetext={valuetext}
        className="flex gap-1.5"
      >
        {segments.map((segment, i) => (
          <span
            key={i}
            className="relative h-1.5 overflow-hidden rounded-full bg-gray-200"
            style={{ flex: `${segment.weight ?? 1} 1 0%` }}
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-[#234C6A] transition-[width]"
              style={{ width: `${ratios[i] * 100}%` }}
            />
          </span>
        ))}
      </div>
      {valueText || percentText ? (
        <div className="mt-2 flex items-center justify-between text-xs" aria-hidden>
          <span className="font-medium text-gray-700">{valueText}</span>
          <span className="text-gray-500">{percentText}</span>
        </div>
      ) : null}
    </div>
  );
}
