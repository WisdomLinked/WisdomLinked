// Detects the material changes a host made to a seminar — time, length, price — by
// comparing the pre-update doc to the fields being applied. Cosmetic edits (name,
// description, image) are intentionally ignored so they never trigger a notification.
// Returns human-readable summaries; an empty array means nothing material changed.

const formatWhen = (value: unknown, timeZone?: string): string => {
    try {
        return new Date(value as any).toLocaleString('en-US', timeZone ? { timeZone } : undefined);
    } catch {
        return new Date(value as any).toLocaleString('en-US');
    }
};

export const describeSeminarChanges = (before: any, updateFields: Record<string, any>): string[] => {
    const changes: string[] = [];
    const tz = before?.timezone || undefined;

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
    return changes;
};
