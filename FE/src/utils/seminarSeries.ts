import { pickLiveOrNextOccurrence, seriesKey } from './seminarSeriesOccurrence';
import { recurrenceSentence, type RecurrenceFields } from './recurrenceLabel';

export interface SeminarSeriesInfo {
  occurrenceCount: number;
  firstStartMs: number | null;
  lastEndMs: number | null;
  cadence?: string;
}

export type SeminarLike = RecurrenceFields & {
  _id?: unknown;
  seriesId?: unknown;
  start?: unknown;
  end?: unknown;
};

export interface CollapsedSeminar<T> {
  doc: T;
  series?: SeminarSeriesInfo;
}

const msOf = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const t = new Date(value as string | number | Date).getTime();
  return Number.isFinite(t) ? t : null;
};

export function collapseSeminarSeries<T extends SeminarLike>(
  seminars: T[] | null | undefined,
  now: Date = new Date(),
): CollapsedSeminar<T>[] {
  if (!Array.isArray(seminars) || seminars.length === 0) return [];

  const order: string[] = [];
  const groups = new Map<string, T[]>();
  seminars.forEach((g, index) => {
    const key = seriesKey(g as any) || `__unkeyed_${index}`;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(g);
    } else {
      groups.set(key, [g]);
      order.push(key);
    }
  });

  return order.map((key) => {
    const group = groups.get(key) as T[];
    const doc = (pickLiveOrNextOccurrence(group as any, key, now) as T) || group[0];

    if (group.length < 2) return { doc };

    let firstStartMs: number | null = null;
    let lastEndMs: number | null = null;
    for (const occurrence of group) {
      const startMs = msOf(occurrence?.start);
      if (startMs !== null && (firstStartMs === null || startMs < firstStartMs)) {
        firstStartMs = startMs;
      }
      const endMs = msOf(occurrence?.end) ?? startMs;
      if (endMs !== null && (lastEndMs === null || endMs > lastEndMs)) {
        lastEndMs = endMs;
      }
    }

    return {
      doc,
      series: {
        occurrenceCount: group.length,
        firstStartMs,
        lastEndMs,
        cadence: recurrenceSentence(doc as RecurrenceFields),
      },
    };
  });
}

export function formatSeriesRange(
  firstStartMs: number | null,
  lastEndMs: number | null,
  now: Date = new Date(),
): string | undefined {
  if (firstStartMs === null && lastEndMs === null) return undefined;
  const from = firstStartMs ?? lastEndMs;
  const to = lastEndMs ?? firstStartMs;
  if (from === null || to === null) return undefined;

  const fromDate = new Date(from);
  const toDate = new Date(to);
  const thisYear = now.getFullYear();
  const showYear =
    fromDate.getFullYear() !== thisYear || toDate.getFullYear() !== thisYear;
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    ...(showYear ? { year: 'numeric' } : {}),
  };

  const fromText = fromDate.toLocaleDateString(undefined, opts);
  const toText = toDate.toLocaleDateString(undefined, opts);
  return fromText === toText ? fromText : `${fromText} – ${toText}`;
}

export const sessionCountLabel = (count: number): string =>
  `${count} ${count === 1 ? 'session' : 'sessions'}`;
