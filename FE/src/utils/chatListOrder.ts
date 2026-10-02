export type RoomActivityMap = Record<string, number>;
export const toActivityMs = (value: unknown): number | null => {
    if (value == null || value === '') return null;
    if (value instanceof Date) {
        const ms = value.getTime();
        return Number.isNaN(ms) ? null : ms;
    }
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
        const ms = new Date(value).getTime();
        return Number.isNaN(ms) ? null : ms;
    }
    return null;
};

export const lastActivityAt = (
    storedValue: unknown,
    liveValue?: number | null,
): number | null => {
    const stored = toActivityMs(storedValue);
    const live = toActivityMs(liveValue ?? null);
    if (stored == null) return live;
    if (live == null) return stored;
    return Math.max(stored, live);
};

export interface RowActivitySource {
    roomId?: string | null;
    storedAt?: unknown;
}

export function sortByRecentActivity<T>(
    rows: readonly T[],
    resolve: (row: T) => RowActivitySource,
    liveActivity: RoomActivityMap = {},
): T[] {
    return rows
        .map((row, index) => {
            const { roomId, storedAt } = resolve(row) || {};
            const rid = roomId == null ? '' : String(roomId);
            const live = rid ? liveActivity[rid] : undefined;
            return { row, index, at: lastActivityAt(storedAt, live) };
        })
        .sort((a, b) => {
            if (a.at == null && b.at == null) return a.index - b.index;
            if (a.at == null) return 1;
            if (b.at == null) return -1;
            if (a.at !== b.at) return b.at - a.at;
            return a.index - b.index;
        })
        .map(entry => entry.row);
}

export const withRoomActivity = (
    current: RoomActivityMap,
    roomId: unknown,
    at: unknown,
): RoomActivityMap => {
    const rid = roomId == null ? '' : String(roomId).trim();
    const ms = toActivityMs(at);
    if (!rid || ms == null) return current;
    const existing = current[rid];
    if (typeof existing === 'number' && existing >= ms) return current;
    return { ...current, [rid]: ms };
};
