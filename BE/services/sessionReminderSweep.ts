/**
 * Sends session reminders at the moment they fall due.
 *
 * Runs on a short interval from server.ts. Each tick asks the two questions in
 * utils/sessionReminders.ts — "has this session passed a reminder mark we have
 * not sent yet?" — and emails whoever is due.
 *
 * This lives outside groupChat.controller.ts (where the other six sweeps sit)
 * only because that file is already ~6,000 lines.
 *
 * Deciding due-ness here rather than pre-queueing with SendGrid means:
 *   - lead time stops mattering (SendGrid refuses sendAt beyond 72h)
 *   - a cancelled session stops matching the query, so nothing is sent
 *   - a rescheduled session is read at its current start
 *   - each occurrence of a recurring seminar is its own document, so no special case
 */
const AppState = require('../models/AppState');
const GroupChat = require('../models/GroupChat');
const Event = require('../models/Event');
const User = require('../models/User');
const { sendSessionReminderEmail } = require('./notifications');
const {
    dueReminders,
    reminderQueryWindow,
} = require('../utils/sessionReminders');

/** Seminars and 1:1s both live in GroupChat; communities have no start time. */
const REMINDABLE_GROUP_TYPES = ['seminar', 'individual'];

/**
 * Which notification toggle governs this session type.
 * These are written by the Settings UI but, until now, read by nothing.
 */
const preferenceKeyFor = (kind: string): string =>
    kind === 'seminar' ? 'seminarReminders' : 'sessionReminders';

const wantsReminder = (user: any, sessionKind: string): boolean => {
    const prefs = user?.notificationPreferences;
    if (!prefs) return true;                      // no preferences recorded = opted in
    if (prefs.email === false) return false;      // master email switch
    const value = prefs[preferenceKeyFor(sessionKind)];
    return value !== false;                       // undefined means never set = opted in
};

/**
 * Claim one reminder for one session, atomically.
 *
 * findOneAndUpdate with `$ne` in the filter is the same pattern the other sweeps
 * use: whichever run matches first wins, the rest get null. That is what makes
 * overlapping ticks and restarts safe, without a lock.
 */
const claimReminder = async (model: any, id: any, kind: string): Promise<boolean> => {
    const claimed = await model.findOneAndUpdate(
        { _id: id, remindersSent: { $ne: kind } },
        { $addToSet: { remindersSent: kind } },
    );
    return Boolean(claimed);
};

/**
 * Send one reminder to one person. Never throws: one bad address must not stop
 * the rest of the sweep.
 */
const remindOne = async (
    user: any,
    kind: string,
    sessionKind: string,
    title: string,
    start: any,
    duration: any,
    role: string,
): Promise<boolean> => {
    if (!user?.email) return false;
    if (!wantsReminder(user, sessionKind)) return false;
    try {
        await sendSessionReminderEmail({
            kind,
            targetEmail: user.email,
            userName: user.username,
            title,
            start,
            duration,
            // Each recipient has their own timezone — the time must render in theirs.
            timeZone: user.timeZone,
            role,
        });
        return true;
    } catch (err: any) {
        console.error('[sessionReminderSweep] send failed', user.email, err?.message || err);
        return false;
    }
};
const scheduledAt = (session: any): any => session?.confirmedAt || session?.createdAt;

/**
 * The instant this environment's sweep first ran, written once and reused.
 *
 * Replaces what would otherwise be a manual migration step at deploy time. Every
 * session that already exists has an empty `remindersSent`, so the first tick
 * would treat them all as never-reminded and email everyone starting within 24h
 * at once. Marks older than this timestamp are simply not owed.
 *
 * Deliberately persisted rather than computed at boot: a process that recomputed
 * "now" on every restart would suppress a 15-minute reminder that was genuinely
 * due at that moment.
 */
const sweepActivatedAt = async (now: number): Promise<number> => {
    const existing = await AppState.findOne({}, 'reminderSweepActivatedAt');
    if (existing?.reminderSweepActivatedAt) return new Date(existing.reminderSweepActivatedAt).getTime();

    // Ensure the singleton exists, then claim the timestamp only if unset. Both
    // steps are idempotent, so concurrent boots settle on the same value.
    if (!existing) await AppState.updateOne({}, { $setOnInsert: {} }, { upsert: true }).catch(() => null);
    await AppState.updateOne(
        { reminderSweepActivatedAt: null },
        { $set: { reminderSweepActivatedAt: new Date(now) } },
    ).catch(() => null);

    const settled = await AppState.findOne({}, 'reminderSweepActivatedAt');
    return settled?.reminderSweepActivatedAt
        ? new Date(settled.reminderSweepActivatedAt).getTime()
        : now;
};

const sweepGroupChats = async (now: number, notBefore: number): Promise<number> => {
    const { from, to } = reminderQueryWindow(now);
    const sessions = await GroupChat.find({
        type: { $in: REMINDABLE_GROUP_TYPES },
        status: 'active',
        start: { $gt: from, $lte: to },
    });

    let sent = 0;
    for (const session of sessions) {
        const due = dueReminders({
            start: session.start,
            createdAt: scheduledAt(session),
            alreadySent: session.remindersSent,
            now,
            notBefore,
        });
        for (const kind of due) {
            if (!(await claimReminder(GroupChat, session._id, kind))) continue;

            // The host is the group admin; for a seminar that is the expert running it.
            const host = await User.findById(session.admin);
            const audience = (session.participants || [])
                .map(String)
                .filter((id: string) => id !== String(session.admin));
            const attendees = audience.length
                ? await User.find({ _id: { $in: audience } })
                : [];

            if (await remindOne(host, kind, session.type, session.name, session.start, session.duration, 'expert')) sent += 1;
            for (const attendee of attendees) {
                if (await remindOne(attendee, kind, session.type, session.name, session.start, session.duration, 'customer')) sent += 1;
            }
        }
    }
    return sent;
};

const sweepEvents = async (now: number, notBefore: number): Promise<number> => {
    const { from, to } = reminderQueryWindow(now);
    const events = await Event.find({
        status: 'accepted',
        start: { $gt: from, $lte: to },
    });

    let sent = 0;
    for (const event of events) {
        const due = dueReminders({
            start: event.start,
            createdAt: scheduledAt(event),
            alreadySent: event.remindersSent,
            now,
            notBefore,
        });
        for (const kind of due) {
            if (!(await claimReminder(Event, event._id, kind))) continue;

            const expert = await User.findById(event.expert);
            const customer = await User.findById(event.customer);
            const title = event.title || 'your session';

            if (await remindOne(expert, kind, 'individual', title, event.start, event.duration, 'expert')) sent += 1;
            if (await remindOne(customer, kind, 'individual', title, event.start, event.duration, 'customer')) sent += 1;
        }
    }
    return sent;
};

/**
 * One tick. Returns how many emails actually went out — handy in tests and logs.
 * Swallows its own errors so a bad tick never takes the interval down with it.
 */
const sweepSessionReminders = async (now: number = Date.now()): Promise<number> => {
    try {
        const notBefore = await sweepActivatedAt(now);
        const [groupSent, eventSent] = await Promise.all([
            sweepGroupChats(now, notBefore),
            sweepEvents(now, notBefore),
        ]);
        const total = groupSent + eventSent;
        if (total > 0) console.log(`[sessionReminderSweep] sent ${total} reminder(s)`);
        return total;
    } catch (err: any) {
        console.log('[sessionReminderSweep]', err?.message || err);
        return 0;
    }
};

module.exports = {
    sweepSessionReminders,
    wantsReminder,
    scheduledAt,
    sweepActivatedAt,
    REMINDABLE_GROUP_TYPES,
};
