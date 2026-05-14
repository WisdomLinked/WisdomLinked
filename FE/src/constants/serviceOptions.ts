/**
 * Canonical WisdomLinked services — single source of truth for filters, forms, and tags.
 */
export const SERVICE_OPTIONS = [
  { value: 'study_abroad', label: 'Study Abroad' },
  { value: 'work_abroad', label: 'Work Abroad' },
  { value: 'research_guidance', label: 'Research Guidance' },
] as const;

export type ServiceOption = (typeof SERVICE_OPTIONS)[number];
export type ServiceOptionValue = ServiceOption['value'];

/** Display strings in canonical order (forms that store human-readable selections). */
export const SERVICE_LABELS: string[] = SERVICE_OPTIONS.map((o) => o.label);

export function matchesServiceOption(
  apiDoc: { value?: string; name?: string; label?: string },
  canonical: ServiceOption,
): boolean {
  const raw = String(apiDoc?.value ?? apiDoc?.name ?? apiDoc?.label ?? '')
    .trim()
    .toLowerCase();
  if (!raw) return false;
  const slug = raw.replace(/\s+/g, '_').replace(/-/g, '_');
  if (slug === canonical.value) return true;
  if (raw === canonical.label.toLowerCase()) return true;
  if (canonical.value === 'study_abroad' && raw.includes('study') && raw.includes('abroad')) return true;
  if (canonical.value === 'work_abroad') {
    if (raw.includes('work') && raw.includes('abroad')) return true;
    // Legacy DB seed: "Overseas work consultation"
    if (raw.includes('overseas') && raw.includes('work')) return true;
    return false;
  }
  if (canonical.value === 'research_guidance') {
    if (raw.includes('research')) return true;
    // Legacy DB seed: "Scientific paper guidance" (no substring "research")
    if (raw.includes('scientific') && raw.includes('paper')) return true;
    if (raw.includes('paper') && raw.includes('guidance')) return true;
    if (raw.includes('publication') || raw.includes('thesis')) return true;
    return false;
  }
  return false;
}

/**
 * Returns API service rows that map to the three canonical options (preserves `_id` for filters).
 */
export function filterApiServicesToCanonical<T extends { _id?: string; value?: string; name?: string; label?: string }>(
  apiServices: T[] | undefined,
): T[] {
  const list = Array.isArray(apiServices) ? apiServices : [];
  const out: T[] = [];
  for (const opt of SERVICE_OPTIONS) {
    const hit = list.find((s) => matchesServiceOption(s, opt));
    if (hit) out.push(hit);
  }
  return out;
}

/** For expert search dropdown: `{ value: Mongo _id, label }` using canonical labels. */
export function serviceDropdownRowsFromApi(
  apiServices: Array<{ _id?: string; value?: string; name?: string; label?: string }> | undefined,
): Array<{ _id: string; value: string }> {
  const list = Array.isArray(apiServices) ? apiServices : [];
  const rows: Array<{ _id: string; value: string }> = [];
  for (const opt of SERVICE_OPTIONS) {
    const hit = list.find((s) => matchesServiceOption(s, opt));
    if (hit?._id) {
      rows.push({ _id: String(hit._id), value: opt.label });
    }
  }
  return rows;
}

/** Maps stored service strings or populated docs to canonical display labels (three only). */
export function canonicalLabelsFromMixedServiceEntries(entries: unknown[] | undefined): string[] {
  const list = Array.isArray(entries) ? entries : [];
  const out: string[] = [];
  for (const item of list) {
    const doc =
      typeof item === 'string'
        ? { value: item, name: item, label: item }
        : {
            value: (item as { value?: string })?.value,
            name: (item as { name?: string })?.name,
            label: (item as { label?: string })?.label,
          };
    for (const opt of SERVICE_OPTIONS) {
      if (matchesServiceOption(doc, opt)) {
        out.push(opt.label);
        break;
      }
    }
  }
  return out;
}
