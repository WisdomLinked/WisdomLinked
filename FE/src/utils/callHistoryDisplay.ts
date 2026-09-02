export type CallHistoryRowLike = {
    startedAt?: string | Date | null;
    endedAt?: string | Date | null;
    duration?: number;
    durationSeconds?: number | null;
    isActive?: boolean;
    status?: string;
};

export function resolveCallHistoryActive(row: CallHistoryRowLike): boolean {
    if (typeof row.isActive === "boolean") return row.isActive;
    return row.status === "active";
}

export function resolveCallHistoryDurationSeconds(row: CallHistoryRowLike): number | null {
    if (resolveCallHistoryActive(row)) return null;
    if (row.durationSeconds != null && Number.isFinite(Number(row.durationSeconds))) {
        return Math.max(0, Number(row.durationSeconds));
    }
    const startedMs = row.startedAt ? new Date(row.startedAt).getTime() : NaN;
    const endedMs = row.endedAt ? new Date(row.endedAt).getTime() : NaN;
    if (Number.isFinite(startedMs) && Number.isFinite(endedMs)) {
        return Math.max(0, Math.round((endedMs - startedMs) / 1000));
    }
    const stored = Number(row.duration);
    return Number.isFinite(stored) ? Math.max(0, stored) : null;
}

export function formatCallDateTime(iso: string | Date | null | undefined): string {
    if (!iso) return "—";
    const d = iso instanceof Date ? iso : new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
}

export function formatCallStarted(iso: string | Date | null | undefined): string {
    return formatCallDateTime(iso);
}

export function formatCallEnded(
    iso: string | Date | null | undefined,
    isActive: boolean,
): string {
    if (isActive) return "In progress";
    return formatCallDateTime(iso);
}

export function formatCallDuration(seconds: number | null | undefined, isActive: boolean): string {
    if (isActive) return "—";
    const total = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}
