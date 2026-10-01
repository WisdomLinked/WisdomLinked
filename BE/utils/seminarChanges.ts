const formatWhen = (value: unknown, timeZone?: string): string => {
    try {
        return new Date(value as any).toLocaleString('en-US', timeZone ? { timeZone } : undefined);
    } catch {
        return new Date(value as any).toLocaleString('en-US');
    }
};

const capacityLabel = (value: unknown): string => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? String(n) : 'Unlimited';
};

export const describeSeminarChanges = (before: any, updateFields: Record<string, any>): string[] => {
    const changes: string[] = [];
    const tz = before?.timezone || undefined;

    if (updateFields.name !== undefined) {
        const oldName = String(before?.name ?? '').trim();
        const newName = String(updateFields.name ?? '').trim();
        if (newName && newName !== oldName) {
            changes.push(`Title: ${oldName || '—'} → ${newName}`);
        }
    }
    if (updateFields.start !== undefined) {
        const oldMs = before?.start ? new Date(before.start).getTime() : 0;
        const newMs = new Date(updateFields.start).getTime();
        if (Number.isFinite(newMs) && oldMs !== newMs) {
            changes.push(`Time: ${formatWhen(before?.start, tz)} → ${formatWhen(updateFields.start, tz)}`);
        }
    }
    if (updateFields.duration !== undefined && Number(updateFields.duration) !== Number(before?.duration || 0)) {
        changes.push(`Duration: ${Number(before?.duration || 0)} min → ${Number(updateFields.duration)} min`);
    }
    if (updateFields.price !== undefined && Number(updateFields.price) !== Number(before?.price || 0)) {
        changes.push(`Price: $${Number(before?.price || 0)} → $${Number(updateFields.price)}`);
    }
    if (updateFields.maxAttendees !== undefined
        && capacityLabel(updateFields.maxAttendees) !== capacityLabel(before?.maxAttendees)) {
        changes.push(`Max attendees: ${capacityLabel(before?.maxAttendees)} → ${capacityLabel(updateFields.maxAttendees)}`);
    }
    return changes;
};

export const seminarDetailPairs = (
    before: any,
    updateFields: Record<string, any> = {},
): Array<[string, string]> => {
    const tz = before?.timezone || undefined;
    const pick = (key: string) => (updateFields[key] !== undefined ? updateFields[key] : before?.[key]);
    const price = Number(pick('price') || 0);
    return [
        ['Seminar', String(pick('name') ?? '').trim() || 'Seminar'],
        ['Date & time', pick('start') ? formatWhen(pick('start'), tz) : 'Not scheduled'],
        ['Duration', `${Number(pick('duration') || 0)} min`],
        ['Price', price > 0 ? `$${price}` : 'Free'],
        ['Max attendees', capacityLabel(pick('maxAttendees'))],
    ];
};
