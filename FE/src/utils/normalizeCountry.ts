/**
 * Country display names for admin demographics.
 * Keep aliases in sync with BE/utils/normalizeCountry.ts.
 */

const PLACEHOLDER = new Set([
  '',
  '-',
  '--',
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
  'unknown',
  'select',
  'select country',
  'country',
  'not set',
  'not specified',
  'tbd',
]);

/** Lowercased raw → canonical display name. */
export const COUNTRY_ALIASES: Record<string, string> = {
  us: 'United States',
  usa: 'United States',
  'u.s.': 'United States',
  'u.s.a.': 'United States',
  'u.s': 'United States',
  'u.s.a': 'United States',
  'united states': 'United States',
  'united states of america': 'United States',
  america: 'United States',
  uk: 'United Kingdom',
  'u.k.': 'United Kingdom',
  'u.k': 'United Kingdom',
  'united kingdom': 'United Kingdom',
  'great britain': 'United Kingdom',
  britain: 'United Kingdom',
  england: 'United Kingdom',
  gb: 'United Kingdom',
  uae: 'United Arab Emirates',
  'u.a.e.': 'United Arab Emirates',
  'united arab emirates': 'United Arab Emirates',
  korea: 'South Korea',
  'south korea': 'South Korea',
  'republic of korea': 'South Korea',
  'north korea': 'North Korea',
  russia: 'Russia',
  'russian federation': 'Russia',
  vietnam: 'Vietnam',
  'viet nam': 'Vietnam',
  taiwan: 'Taiwan',
  'taiwan, province of china': 'Taiwan',
  holland: 'Netherlands',
  'the netherlands': 'Netherlands',
  netherlands: 'Netherlands',
  iran: 'Iran',
  'islamic republic of iran': 'Iran',
  syria: 'Syria',
  'syrian arab republic': 'Syria',
};

function collapseKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ');
}

export function extractCountryRaw(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const name = obj.name ?? obj.label ?? obj.country;
    if (typeof name === 'string' && name.trim()) return name.trim();
    const iso = obj.isoCode ?? obj.code ?? obj.iso;
    if (typeof iso === 'string' && iso.trim()) return iso.trim();
  }
  return '';
}

export function normalizeCountry(value: unknown): string | null {
  const raw = extractCountryRaw(value);
  if (!raw) return null;
  const key = collapseKey(raw);
  if (!key || PLACEHOLDER.has(key)) return null;
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  return raw
    .trim()
    .split(/\s+/)
    .map(w => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

export function isUnitedStates(normalized: string | null): boolean {
  return normalized === 'United States';
}
