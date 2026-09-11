const AdminAuditLog = require("../models/AdminAuditLog");

/**
 * Fire-and-forget admin audit writer. Never throws to callers.
 */
function logAdminAction({
    actor,
    action,
    targetType,
    targetId,
    targetEmail,
    meta,
}: {
    actor?: { _id?: unknown; userId?: string; email?: string } | null;
    action: string;
    targetType?: string;
    targetId?: string | null;
    targetEmail?: string | null;
    meta?: Record<string, unknown> | null;
}): void {
    try {
        const actorId = actor?.userId || (actor?._id ? String(actor._id) : undefined);
        const actorEmail = actor?.email ? String(actor.email) : undefined;
        void AdminAuditLog.create({
            actorId: actorId || undefined,
            actorEmail,
            action: String(action),
            targetType: targetType || undefined,
            targetId: targetId != null ? String(targetId) : undefined,
            targetEmail: targetEmail || undefined,
            meta: meta || undefined,
        }).catch((err: unknown) => {
            console.error("[adminAudit] failed to write log:", err);
        });
    } catch (err) {
        console.error("[adminAudit] unexpected error:", err);
    }
}

module.exports = { logAdminAction };
