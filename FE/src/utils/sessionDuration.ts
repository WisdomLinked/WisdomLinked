export function sessionDurationMinutes(session: any): number | null {
  const stated = Number(session?.duration);
  if (Number.isFinite(stated) && stated > 0) return Math.round(stated);

  const start = new Date(session?.start).getTime();
  const end = new Date(session?.end).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;

  const derived = Math.round((end - start) / 60000);
  return derived > 0 ? derived : null;
}

export function formatSessionDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

export function sessionDurationLabel(session: any): string {
  return formatSessionDuration(sessionDurationMinutes(session));
}
