/** Canonical services. Slug/label matching mirrors FE/src/constants/serviceOptions.ts. */
export const SERVICE_OPTIONS = [
    { value: 'study_abroad', label: 'Study Abroad' },
    { value: 'work_abroad', label: 'Work Abroad' },
    { value: 'research_guidance', label: 'Research Guidance' },
] as const;

export type ServiceOption = (typeof SERVICE_OPTIONS)[number];

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
        if (raw.includes('overseas') && raw.includes('work')) return true;
        return false;
    }
    if (canonical.value === 'research_guidance') {
        if (raw.includes('research')) return true;
        if (raw.includes('scientific') && raw.includes('paper')) return true;
        if (raw.includes('paper') && raw.includes('guidance')) return true;
        if (raw.includes('publication') || raw.includes('thesis')) return true;
        return false;
    }
    return false;
}

/** Query hits a canonical label or slug (literal substring, case-insensitive). */
export function canonicalOptionsForQuery(query: string): ServiceOption[] {
    const needle = String(query ?? '').trim().toLowerCase();
    if (!needle) return [];
    return SERVICE_OPTIONS.filter((opt) => {
        const label = opt.label.toLowerCase();
        const slug = opt.value.toLowerCase();
        const words = slug.replace(/_/g, ' ');
        return label.includes(needle) || slug.includes(needle) || words.includes(needle);
    });
}
