const PREFERRED_KEYS = [
    "from",
    "to",
    "role",
    "amount",
    "reason",
    "target",
    "sources",
    "targetRole",
    "month",
    "chequeNumber",
    "chequeDate",
    "description",
    "originalPayment",
    "stripeMode",
    "audience",
    "version",
    "file",
    "changes",
];

const isPresent = (value: unknown) => value !== undefined && value !== null;

export function formatMetaValue(value: unknown): string {
    if (!isPresent(value) || value === "") return "—";
    if (Array.isArray(value)) {
        const items = value.filter(isPresent).map(formatMetaValue);
        return items.length ? items.join(", ") : "—";
    }
    if (typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>).filter(([, inner]) => isPresent(inner));
        if (!entries.length) return "—";
        return entries.map(([key, inner]) => `${key}: ${formatMetaValue(inner)}`).join(", ");
    }
    return String(value);
}

export function formatMetaChanges(changes: unknown): string {
    if (!changes || typeof changes !== "object" || Array.isArray(changes)) return formatMetaValue(changes);
    const entries = Object.entries(changes as Record<string, unknown>);
    if (!entries.length) return "no changes";
    return entries
        .map(([field, change]) => {
            const { from, to } = (change && typeof change === "object" ? change : {}) as { from?: unknown; to?: unknown };
            return `${field}: ${formatMetaValue(from)} → ${formatMetaValue(to)}`;
        })
        .join("; ");
}

const formatPart = (key: string, value: unknown) =>
    key === "changes" ? formatMetaChanges(value) : `${key}=${formatMetaValue(value)}`;

export function metaSummary(meta?: Record<string, unknown>): string {
    if (!meta || typeof meta !== "object") return "—";
    try {
        const keys = Object.keys(meta);
        if (!keys.length) return "—";
        const parts = PREFERRED_KEYS.filter((key) => isPresent(meta[key])).map((key) => formatPart(key, meta[key]));
        if (!parts.length) {
            return keys
                .slice(0, 3)
                .map((key) => formatPart(key, meta[key]))
                .join("; ");
        }
        return parts.join("; ");
    } catch {
        return "—";
    }
}
