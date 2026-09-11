import { isTheEventGoingOn } from '../actions/common';

/** Stable key for a seminar series: shared seriesId, else the doc _id. */
export function seriesKey(g: { seriesId?: unknown; _id?: unknown } | null | undefined): string {
  if (!g) return '';
  if (g.seriesId != null && String(g.seriesId)) return String(g.seriesId);
  if (g._id != null && String(g._id)) return String(g._id);
  return '';
}

function startMs(g: { start?: unknown }): number {
  const t = g?.start ? new Date(g.start as string | Date).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

/**
 * Among group chats sharing the same series, prefer the live occurrence,
 * else the next upcoming by start, else the earliest chronologically.
 */
export function pickLiveOrNextOccurrence(
  groupChats: Array<{ seriesId?: unknown; _id?: unknown; start?: unknown; end?: unknown }> | null | undefined,
  seriesIdOrDoc: string | { seriesId?: unknown; _id?: unknown } | null | undefined,
  now: Date = new Date(),
): any | null {
  const target =
    typeof seriesIdOrDoc === 'string' || typeof seriesIdOrDoc === 'number'
      ? String(seriesIdOrDoc)
      : seriesKey(seriesIdOrDoc);
  if (!target || !groupChats?.length) return null;

  const siblings = groupChats.filter((g) => seriesKey(g) === target);
  if (!siblings.length) return null;

  const sorted = [...siblings].sort((a, b) => startMs(a) - startMs(b));

  const live = sorted.find((g) => isTheEventGoingOn(g.start, g.end));
  if (live) return live;

  const nowMs = now.getTime();
  const next = sorted.find((g) => startMs(g) >= nowMs);
  return next || sorted[0] || null;
}
