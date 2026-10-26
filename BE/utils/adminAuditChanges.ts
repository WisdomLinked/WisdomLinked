export type AuditChange = { from: unknown; to: unknown };

// Long free text (a bio, a special note) is cut in the log entry only; the comparison
// always uses the full value, so an edit past the cut-off is still recorded.
export const AUDIT_TEXT_LIMIT = 200;
// Lists and objects (a long majors list, an old-format country with its timezones) are
// kept whole up to this size and stored as cut-off text beyond it.
export const AUDIT_STRUCTURE_LIMIT = 1000;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && !(value instanceof Date)
    && typeof (value as any).toHexString !== 'function';

// Blank, missing and null all mean "not set", so a form re-sending an empty field is not
// recorded as an edit. ObjectIds and Dates become strings so the entry stores plain values.
function normalize(value: unknown): unknown {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
    if (Array.isArray(value)) return value.map(normalize);
    if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, normalize(inner)]));
    }
    if (typeof value === 'object') return String(value);
    return value;
}

function forLog(value: unknown): unknown {
    if (typeof value === 'string' && value.length > AUDIT_TEXT_LIMIT) {
        return `${value.slice(0, AUDIT_TEXT_LIMIT)}…`;
    }
    if (Array.isArray(value) || isPlainObject(value)) {
        const json = JSON.stringify(value);
        if (json.length > AUDIT_STRUCTURE_LIMIT) return `${json.slice(0, AUDIT_STRUCTURE_LIMIT)}…`;
        if (Array.isArray(value)) return value.map(forLog);
        return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, forLog(inner)]));
    }
    return value;
}

export function auditChanges(
    before: Record<string, unknown> | null | undefined,
    after: Record<string, unknown> | null | undefined,
): Record<string, AuditChange> {
    const prev = before || {};
    const next = after || {};
    const keys = [...new Set([...Object.keys(next), ...Object.keys(prev)])];
    const changes: Record<string, AuditChange> = {};
    for (const key of keys) {
        const from = normalize(prev[key]);
        const to = normalize(next[key]);
        if (JSON.stringify(from) === JSON.stringify(to)) continue;
        changes[key] = { from: forLog(from), to: forLog(to) };
    }
    return changes;
}

export function flattenForAudit(value: unknown, prefix = ''): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!isPlainObject(value)) return out;
    for (const [key, inner] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (isPlainObject(inner)) Object.assign(out, flattenForAudit(inner, path));
        else out[path] = inner;
    }
    return out;
}

const valuesOf = (rows: unknown): string[] =>
    (Array.isArray(rows) ? rows : [])
        .map((row: any) => (row && typeof row === 'object' && 'value' in row ? row.value : row))
        .filter((value) => value !== undefined && value !== null && value !== '')
        .map(String);

// Majors and services are compared as names, in a stable order, so re-saving the same
// selection in a different order is not an edit and the entry is readable without ids.
export function profileAuditSnapshot(user: any): Record<string, unknown> {
    if (!user) return {};
    return {
        username: user.username,
        title: user.title,
        description: user.description,
        image: user.image,
        majors: [...valuesOf(user.keywords), ...valuesOf(user.customKeywords)].sort(),
        services: valuesOf(user.services).sort(),
        country: user.country,
        state: user.state,
        city: user.city,
        phoneNumber: user.phoneNumber,
        price: Array.isArray(user.price) ? user.price : user.price == null ? [] : [user.price],
        joinPopupBlocked: Boolean(user.joinPopupBlocked),
        specialNote: user.specialNote,
    };
}

export const PROFILE_AUDIT_FIELDS =
    'username title description image keywords customKeywords services country state city phoneNumber price joinPopupBlocked specialNote';

export function auditDate(value: unknown): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value as any);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function auditAmount(cents: unknown, currency = 'usd'): string {
    const value = Number(cents);
    const amount = Number.isFinite(value) ? (value / 100).toFixed(2) : '0.00';
    return `${amount} ${String(currency || 'usd').toUpperCase()}`;
}
