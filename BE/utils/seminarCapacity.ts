const normalizeSeminarId = (v: any): string => String(v?._id ?? v?.id ?? v ?? "").trim();

// Enrolled students = participants minus the host (the admin is always a
// participant of their own seminar).
export const enrolledStudentIds = (groupChat: any): string[] => {
    const adminId = normalizeSeminarId(groupChat?.admin);
    return (Array.isArray(groupChat?.participants) ? groupChat.participants : [])
        .map((p: any) => normalizeSeminarId(p))
        .filter((id: string) => id && id !== adminId);
};

// A seminar is full once its capacity (maxAttendees) is set and reached.
export const seminarIsFull = (groupChat: any): boolean => {
    const cap = typeof groupChat?.maxAttendees === 'number' ? groupChat.maxAttendees : null;
    if (cap == null || cap <= 0) return false;
    return enrolledStudentIds(groupChat).length >= cap;
};

export const SEAT_REQUEST_HOLD_MS = 7 * 24 * 60 * 60 * 1000;

// Overflow seat requests hold funds via Stripe (auth expires after ~7 days), and
// the host must decide by an admin-set number of hours before the seminar starts.
// The effective release deadline is whichever of the two comes first.
export const computeSeatRequestDeadline = (
    startMs: number,
    deadlineHours: number,
    nowMs: number = Date.now(),
): Date => {
    const deadlineByStart = startMs - deadlineHours * 60 * 60 * 1000;
    const holdExpiry = nowMs + SEAT_REQUEST_HOLD_MS;
    return new Date(Math.min(deadlineByStart, holdExpiry));
};

// A full seminar only accepts seat requests while it's inside the hold window
// (future, but no more than ~7 days out).
export const seatRequestWindowOpen = (startMs: number, nowMs: number = Date.now()): boolean =>
    startMs > nowMs && startMs <= nowMs + SEAT_REQUEST_HOLD_MS;
