/** Default timezone when user preference not set. */
const DEFAULT_TZ = 'America/Chicago';

/** Parse SQLite datetime (stored as UTC) into a Date. */
function parseAsUtc(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim().replace(' ', 'T');
  return new Date(s.includes('Z') || s.includes('+') || s.includes('-') && s.lastIndexOf('-') > 10 ? s : s + 'Z');
}

/** Format a date in the given timezone. SQLite datetimes are UTC. */
export function formatDate(dateStr, timezone = DEFAULT_TZ) {
  if (!dateStr) return '';
  const tz = timezone || DEFAULT_TZ;
  try {
    const d = parseAsUtc(dateStr);
    if (!d || isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString('en-US', { timeZone: tz });
  } catch {
    return String(dateStr);
  }
}
