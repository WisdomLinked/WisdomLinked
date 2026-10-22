/** Display name from a country-state-city object or a stored string. */
export function placeName(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const doc = value as { name?: unknown; label?: unknown; value?: unknown };
    return String(doc.name ?? doc.label ?? doc.value ?? '').trim();
  }
  return '';
}

/** "City, State, Country" using whichever of those fields are filled. */
export function formatProfileLocation(person: {
  city?: unknown;
  state?: unknown;
  country?: unknown;
} | null | undefined): string {
  if (!person) return '';
  return [placeName(person.city), placeName(person.state), placeName(person.country)]
    .filter(Boolean)
    .join(', ');
}
