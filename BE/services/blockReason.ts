const BlockAuditLog = require('../models/AdminAuditLog');

const MAX_REASON_LENGTH = 1000;

/** The reason the admin gave when last blocking this user, or null when none was recorded or it cannot be read. */
const latestBlockReason = async (userId: unknown): Promise<string | null> => {
    if (!userId) return null;
    try {
        const entry = await BlockAuditLog.findOne({
            action: 'user_status_change',
            targetId: String(userId),
            'meta.to': 'blocked',
        })
            .sort({ createdAt: -1 })
            .lean();
        const reason = typeof entry?.meta?.reason === 'string' ? entry.meta.reason.trim() : '';
        return reason ? reason.slice(0, MAX_REASON_LENGTH) : null;
    } catch (err) {
        console.error('Unable to read block reason:', err);
        return null;
    }
};

module.exports = { latestBlockReason, MAX_REASON_LENGTH };
