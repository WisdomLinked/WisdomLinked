const AppState = require('../models/AppState');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const GroupChat = require('../models/GroupChat');
const {
    decideUnreadEmail,
    countableRoomIds,
    totalUnread,
    isUnreadEmailRecipient,
    UNREAD_EMAIL_IDLE_MS,
    UNREAD_EMAIL_ROLES,
    CHAT_SEEN_THROTTLE_MS,
} = require('../utils/unreadMessageEmail');

const MAX_CONSECUTIVE_RC_FAILURES = 3;

const STATE_FIELDS =
    '+chatLastSeenAt +unreadEmailSentAt +unreadEmailCheckedAt +unreadEmailCountdownFrom +unreadEmailFailedAt';

const recordChatSeen = async (userId: any, now: number = Date.now()): Promise<void> => {
    if (!userId) return;
    try {
        await User.updateOne(
            {
                _id: userId,
                $or: [
                    { chatLastSeenAt: null },
                    { chatLastSeenAt: { $lt: new Date(now - CHAT_SEEN_THROTTLE_MS) } },
                ],
            },
            { $set: { chatLastSeenAt: new Date(now) } },
            { timestamps: false },
        );
    } catch (err: any) {
        console.warn('[recordChatSeen]', err?.message || err);
    }
};

const sweepActivatedAt = async (now: number): Promise<number> => {
    const existing = await AppState.findOne({}, 'unreadEmailSweepActivatedAt');
    if (existing?.unreadEmailSweepActivatedAt) return new Date(existing.unreadEmailSweepActivatedAt).getTime();

    if (!existing) await AppState.updateOne({}, { $setOnInsert: {} }, { upsert: true }).catch(() => null);
    await AppState.updateOne(
        { unreadEmailSweepActivatedAt: null },
        { $set: { unreadEmailSweepActivatedAt: new Date(now) } },
    ).catch(() => null);

    const settled = await AppState.findOne({}, 'unreadEmailSweepActivatedAt');
    return settled?.unreadEmailSweepActivatedAt
        ? new Date(settled.unreadEmailSweepActivatedAt).getTime()
        : now;
};

const loadUserRooms = async (user: any): Promise<{ countable: Set<string>; activity: any[] }> => {
    const dmIds = user?.directConversations || [];
    const groupIds = [...(user?.groupChats || []), ...(user?.generalChats || [])];

    const dms = dmIds.length
        ? await Conversation.find({ _id: { $in: dmIds } }).select('rcChannelId lastMessageAt').lean()
        : [];
    const groups = await GroupChat.find({
        $or: [{ _id: { $in: groupIds } }, { type: 'community', participants: user._id }],
    })
        .select('rcChannelId type status lastMessageAt')
        .lean();

    const countable = countableRoomIds(
        dms.map((d: any) => d?.rcChannelId),
        groups,
    );
    const inCountableRoom = (doc: any) => countable.has(String(doc?.rcChannelId ?? '').trim());

    const groupRids = groups.filter(inCountableRoom).map((g: any) => String(g.rcChannelId).trim());
    const siblings = groupRids.length
        ? await GroupChat.find({ rcChannelId: { $in: groupRids } }).select('rcChannelId lastMessageAt').lean()
        : [];

    const activity = [...dms, ...groups, ...siblings]
        .filter(inCountableRoom)
        .map((doc: any) => doc?.lastMessageAt)
        .filter(Boolean);

    return { countable, activity };
};

const defaultDeps = {
    countUnread: (reader: any, onlyRids: Set<string>) =>
        require('./rocketchat.service').getChatUnreadCountsAsUser(reader, onlyRids),
    sendEmail: (args: any) => require('./notifications').sendUnreadMessagesEmail(args),
};

let sweeping = false;

const sweepUnreadMessageEmails = async (
    now: number = Date.now(),
    deps: {
        countUnread: (reader: any, onlyRids: Set<string>) => Promise<Record<string, number> | null>;
        sendEmail: (args: any) => Promise<any>;
    } = defaultDeps,
): Promise<number> => {
    if (sweeping) return 0;
    sweeping = true;
    let sent = 0;
    try {
        const activatedAt = await sweepActivatedAt(now);
        if (now - activatedAt < UNREAD_EMAIL_IDLE_MS) return 0;

        const candidates = await User.find({
            role: { $in: UNREAD_EMAIL_ROLES },
            status: { $ne: 'blocked' },
            'notificationPreferences.email': { $ne: false },
            $or: [
                { chatLastSeenAt: null },
                { chatLastSeenAt: { $lte: new Date(now - UNREAD_EMAIL_IDLE_MS) } },
            ],
        })
            .select(`${STATE_FIELDS} email username role status notificationPreferences directConversations groupChats generalChats`)
            .lean();

        let rcFailures = 0;
        for (const user of candidates || []) {
            if (!isUnreadEmailRecipient(user)) continue;
            try {
                const { countable, activity } = await loadUserRooms(user);
                const decision = decideUnreadEmail({
                    state: {
                        chatLastSeenAt: user.chatLastSeenAt,
                        sentAt: user.unreadEmailSentAt,
                        checkedAt: user.unreadEmailCheckedAt,
                        countdownFrom: user.unreadEmailCountdownFrom,
                        failedAt: user.unreadEmailFailedAt,
                    },
                    activity,
                    now,
                    activatedAt,
                });

                if (decision.action === 'wait') continue;

                if (decision.action === 'startCountdown') {
                    await User.updateOne(
                        { _id: user._id },
                        { $set: { unreadEmailCountdownFrom: new Date(decision.fromMs) } },
                        { timestamps: false },
                    );
                    continue;
                }

                const counts = await deps.countUnread(
                    {
                        email: user.email,
                        username: user.username,
                        name: user.username,
                    },
                    countable,
                );
                const checkedAt = new Date(now);
                if (counts === null || counts === undefined) {
                    await User.updateOne(
                        { _id: user._id },
                        { $set: { unreadEmailFailedAt: checkedAt } },
                        { timestamps: false },
                    );
                    rcFailures += 1;
                    if (rcFailures >= MAX_CONSECUTIVE_RC_FAILURES) {
                        console.warn('[unreadMessageEmailSweep] Rocket.Chat unavailable, stopping this tick');
                        break;
                    }
                    continue;
                }
                rcFailures = 0;

                const unreadCount = totalUnread(counts, countable);
                if (unreadCount <= 0) {
                    await User.updateOne(
                        { _id: user._id },
                        { $set: { unreadEmailCheckedAt: checkedAt } },
                        { timestamps: false },
                    );
                    continue;
                }

                const claimed = await User.findOneAndUpdate(
                    {
                        _id: user._id,
                        chatLastSeenAt: user.chatLastSeenAt ?? null,
                        unreadEmailSentAt: user.unreadEmailSentAt ?? null,
                    },
                    { $set: { unreadEmailSentAt: checkedAt, unreadEmailCheckedAt: checkedAt } },
                    { timestamps: false, projection: { _id: 1 } },
                );
                if (!claimed) continue;

                await deps.sendEmail({
                    targetEmail: user.email,
                    userName: user.username,
                    unreadCount,
                    role: user.role,
                });
                sent += 1;
            } catch (err: any) {
                console.error('[unreadMessageEmailSweep] user failed', String(user?._id), err?.message || err);
            }
        }

        if (sent > 0) console.log(`[unreadMessageEmailSweep] sent ${sent} unread-messages email(s)`);
        return sent;
    } catch (err: any) {
        console.log('[unreadMessageEmailSweep]', err?.message || err);
        return sent;
    } finally {
        sweeping = false;
    }
};

export {
    sweepUnreadMessageEmails,
    recordChatSeen,
    loadUserRooms,
    sweepActivatedAt,
    MAX_CONSECUTIVE_RC_FAILURES,
};
