/**
 * Rocket.Chat group rooms must use the same key as chat history / send:
 * seriesId when present (shared channel across seminar occurrences), else the GroupChat _id.
 * Meeting start/end previously used only the occurrence id, so Meet cards never reached peers.
 */

const GroupChat = require('../models/GroupChat');
import { syncRocketGroupChannelMembers } from '../services/rocketchat.service';

export function groupRocketChannelKey(
    groupChat: { _id?: any; seriesId?: any } | null | undefined,
    fallbackId?: string,
): string {
    if (groupChat?.seriesId) return String(groupChat.seriesId);
    if (groupChat?._id != null) return String(groupChat._id);
    return String(fallbackId || '').trim();
}

/** GroupChat ids that share one Meet scope (all series occurrences, or just this group). */
export async function resolveGroupMeetingScopeIds(
    groupChat: { _id?: any; seriesId?: any } | null | undefined,
): Promise<string[]> {
    if (!groupChat) return [];
    if (groupChat.seriesId) {
        const docs = await GroupChat.find({ seriesId: groupChat.seriesId }).select('_id').lean();
        const ids = docs.map((d: any) => String(d._id)).filter(Boolean);
        if (ids.length) return ids;
    }
    if (groupChat._id != null) return [String(groupChat._id)];
    return [];
}

const pushEmails = (emails: string[], groupChat: any) => {
    for (const p of groupChat?.participants || []) {
        if ((p as any)?.email) emails.push(String((p as any).email).toLowerCase());
    }
    const adm = groupChat?.admin as any;
    if (adm?.email) emails.push(String(adm.email).toLowerCase());
};

/** Collect participant emails; for series rooms, union across all occurrences. */
export async function collectGroupRocketEmails(groupChat: any): Promise<string[]> {
    const emails: string[] = [];
    if (!groupChat) return emails;

    if (groupChat.seriesId) {
        const seriesDocs = await GroupChat.find({ seriesId: groupChat.seriesId })
            .populate('participants', 'email')
            .populate('admin', 'email');
        for (const d of seriesDocs) pushEmails(emails, d);
    } else {
        pushEmails(emails, groupChat);
    }
    return [...new Set(emails.filter(Boolean))];
}

/**
 * Ensure members are in the shared RC channel and return its room id.
 * Prefer syncing by series key (same as getGroupHistory) so posts land where peers listen.
 */
export async function resolveGroupRocketChannelId(groupChat: any, fallbackId?: string): Promise<string | null> {
    const key = groupRocketChannelKey(groupChat, fallbackId);
    if (!key) return null;
    const emails = await collectGroupRocketEmails(groupChat);
    if (!emails.length) return groupChat?.rcChannelId ? String(groupChat.rcChannelId) : null;

    const synced = await syncRocketGroupChannelMembers(key, emails);
    if (synced) return synced;
    // Fallback if name lookup failed but Mongo already has the shared room id.
    return groupChat?.rcChannelId ? String(groupChat.rcChannelId) : null;
}
