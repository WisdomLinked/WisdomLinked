export const normalizeModerationReason = (reason: unknown): string => {
    const raw = String(reason || "").trim().replace(/\s+/g, " ");
    if (!raw) return "due to concerns";
    return raw.length > 220 ? `${raw.slice(0, 220).trim()}...` : raw;
};

export const buildRemovedUserNotice = (reason: unknown): string => {
    const safeReason = normalizeModerationReason(reason);
    return `The moderator declined you from participating in the video call because ${safeReason}. Later communication with you will ensue when needed. Contact the admin through Contact Us or message the expert directly after this call.`;
};

