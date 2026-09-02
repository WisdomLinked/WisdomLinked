/**
 * True while an event or session has not yet finished.
 *
 * `event.end` arrives from the API as an ISO string. Comparing it directly to a
 * Date object (`event.end > new Date()`) stringifies the Date to "Mon Aug 10 …";
 * an ISO string starts with a digit, which sorts below every weekday letter, so
 * that comparison is false for every event no matter how far in the future.
 */
export const eventIsUpcoming = (event: any, now: number = Date.now()): boolean => {
  const end = new Date(event?.end).getTime();
  return Number.isFinite(end) && end > now;
};
