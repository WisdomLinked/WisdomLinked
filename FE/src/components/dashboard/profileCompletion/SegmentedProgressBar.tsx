type Segment = {
  /** Fill ratio from 0 to 1. */
  ratio: number;
};

type Props = {
  /** Expert setup: one part per step. Omit when `percent` is set. */
  segments?: Segment[];
  /** Student profile: a single 0–100 fill. Takes precedence over `segments`. */
  percent?: number;
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

function Labels({ valueText, percentText }: { valueText?: string; percentText?: string }) {
  if (!valueText && !percentText) return null;
  return (
    <div className="mt-2 flex items-center justify-between text-xs" aria-hidden>
      <span className="font-medium text-slate-700">{valueText}</span>
      <span className="text-slate-500">{percentText}</span>
    </div>
  );
}

/**
 * Expert setup uses equal-width segments. Student profile uses `percent` for
 * one continuous 0–100% navy fill over a slate track.
 */
export default function SegmentedProgressBar({
  segments = [],
  percent,
  label,
  valueText,
  percentText,
  ariaValueNow,
  ariaValueMax = 100,
  ariaValueText,
}: Props) {
  const continuous = percent != null;
  const clampedPercent = Math.max(0, Math.min(100, percent ?? 0));
  const ratios = segments.map(segment => Math.max(0, Math.min(1, segment.ratio)));
  const average = ratios.length ? ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length : 0;
  const now = ariaValueNow ?? (continuous ? Math.round(clampedPercent) : Math.round(average * 100));
  const valuetext =
    ariaValueText ??
    valueText ??
    (percentText ? percentText : `${now}% complete`);

  return (
    <div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={ariaValueMax}
        aria-valuenow={now}
        aria-valuetext={valuetext}
        className={continuous ? 'relative h-1.5 overflow-hidden rounded-full bg-slate-200' : 'flex gap-1.5'}
      >
        {continuous ? (
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-wl-brand"
            style={{ width: `${clampedPercent}%` }}
            data-testid="progress-fill"
          />
        ) : (
          segments.map((_, index) => (
            <span key={index} className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-wl-brand"
                style={{ width: `${ratios[index] * 100}%` }}
              />
            </span>
          ))
        )}
      </div>
      <Labels valueText={valueText} percentText={percentText} />
    </div>
  );
}
