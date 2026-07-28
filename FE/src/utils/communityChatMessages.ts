import { toRocketChatUsername } from './rocketchatUsername';
import { canonicalMembershipSide } from './rcMembershipTypes';

export const WL_COMMUNITY_SYS_PREFIX = '__WL_COMMUNITY_SYS__::';

/** Mirrors BE `wlDisplayName` for chat labels (avoid showing raw email/slug). */
function displayName(u: { username?: string; email?: string } | null | undefined): string {
    if (!u) return 'Someone';
    const raw = String(u.username ?? '').trim();
    if (raw && !raw.includes('@')) return raw;
    const email = String(u.email ?? '').trim();
    if (email) {
        const local = email.split('@')[0];
        return local
            .replace(/[._-]+/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
    }
    return raw || 'Someone';
}

function collectPools(
    groupDetails: any | null | undefined,
    extraUsers: any[] | null | undefined,
    serverResolvedUser: any | null | undefined,
): any[] {
    const out: any[] = [];
    if (groupDetails?.participants?.length) {
        out.push(...groupDetails.participants);
    }
    const adm = groupDetails?.admin;
    if (adm && typeof adm === 'object' && adm._id) {
        if (!out.some((x: any) => String(x?._id) === String(adm._id))) {
            out.push(adm);
        }
    }
    if (Array.isArray(extraUsers)) {
        for (const u of extraUsers) {
            if (u && typeof u === 'object' && u._id) out.push(u);
        }
    }
    if (serverResolvedUser && typeof serverResolvedUser === 'object' && serverResolvedUser._id) {
        if (!out.some((x: any) => String(x?._id) === String(serverResolvedUser._id))) {
            out.push(serverResolvedUser);
        }
    }
    return out;
}

/**
 * Rocket.Chat: `uj`/`ujt` = added, `ul`/`ult` = left. WL-prefixed lines are our own copy.
 * `extraUsers` should include friends + `userDetails` so we can resolve before Redux refreshes.
 * `serverResolvedUser` comes from GET …/resolve-participant when subscription lines use the bot as `u`.
 */
export function parseCommunityGroupRealtimeMessage(
    rawMsg: string,
    groupDetails: any | null | undefined,
    rcMessageType?: string | null,
    rcAuthorUsername?: string | null,
    extraUsers?: any[] | null,
    serverResolvedUser?: any | null,
): { content: string; type: string } {
    const raw = String(rawMsg ?? '').trim();
    if (raw.startsWith(WL_COMMUNITY_SYS_PREFIX)) {
        return { content: raw.slice(WL_COMMUNITY_SYS_PREFIX.length), type: 'wl-community-sys' };
    }

    const plist = collectPools(groupDetails, extraUsers, serverResolvedUser);
    if (!plist.length) {
        return { content: raw, type: 'message' };
    }

    const side = canonicalMembershipSide(rcMessageType);

    const tryMatchSlug = (slugRaw: string | null | undefined) => {
        const s = String(slugRaw ?? '').trim();
        if (!s || s.includes(' ') || s.startsWith('__') || s.length >= 120) {
            return null;
        }
        const lower = s.toLowerCase();
        return plist.find((x: any) => x?.email && toRocketChatUsername(String(x.email)).toLowerCase() === lower) || null;
    };

    let match = tryMatchSlug(raw);
    if (!match && rcAuthorUsername && side) {
        match = tryMatchSlug(String(rcAuthorUsername));
    }

    if (match && side === 'join') {
        return { content: `${displayName(match)} has joined the community.`, type: 'wl-community-sys' };
    }
    if (match && side === 'leave') {
        return { content: `${displayName(match)} has left the community.`, type: 'wl-community-sys' };
    }

    return { content: raw, type: 'message' };
}

/** Looks like an RC email-derived username (e.g. `local_domain.tld`). */
function looksLikeRcEmailSlug(s: string): boolean {
    const t = String(s ?? '').trim();
    if (!t || t.includes(' ') || t.length > 120) return false;
    if (!/^[a-z0-9._-]+$/i.test(t)) return false;
    return t.includes('_') || t.includes('.');
}

/**
 * Last-line UI fix: Rocket sometimes stores subscription rows as a normal message from the RC bot
 * with body = member slug. Uses `wlRcSubtype` from the API (`uj`/`ul`/…) so we never guess "joined" on a leave.
 */
export function rewriteStaleCommunitySlugMessage(
    message: any,
    groupDetails: any | null | undefined,
    extraUsers?: any[] | null,
): any {
    if (!groupDetails || groupDetails.type !== 'community') return message;
    if (message?.type === 'wl-community-sys') return message;
    const c = String(message?.content ?? '').trim();
    if (!c || c.startsWith(WL_COMMUNITY_SYS_PREFIX)) return message;
    if (!looksLikeRcEmailSlug(c)) return message;

    const plist = collectPools(groupDetails, extraUsers, null);
    const lower = c.toLowerCase();
    const match =
        plist.find(
            (x: any) => x?.email && toRocketChatUsername(String(x.email)).toLowerCase() === lower,
        ) || null;

    const sub = String(message?.wlRcSubtype ?? '').trim().toLowerCase();

    if (!match) {
        if (sub === 'ul') {
            return { ...message, content: 'A member has left the community.', type: 'wl-community-sys' };
        }
        if (sub === 'uj') {
            return { ...message, content: 'A member has joined the community.', type: 'wl-community-sys' };
        }
        return message;
    }
    if (sub === 'ul') {
        return {
            ...message,
            content: `${displayName(match)} has left the community.`,
            type: 'wl-community-sys',
        };
    }
    if (sub === 'uj') {
        return {
            ...message,
            content: `${displayName(match)} has joined the community.`,
            type: 'wl-community-sys',
        };
    }

    const authorSlug = String(message?.author?.username ?? '')
        .trim()
        .toLowerCase();
    const authorIsMember = plist.some(
        (x: any) => x?.email && toRocketChatUsername(String(x.email)).toLowerCase() === authorSlug,
    );
    const botLike =
        !authorIsMember &&
        authorSlug &&
        (/admin|rocket\.cat|system|bot|wisdomlinked/i.test(authorSlug) ||
            authorSlug !== lower);

    /** No `wlRcSubtype`: do not infer join vs leave (prevents "joined" on self-leave / kick rows). */
    if (!botLike) return message;
    return message;
}
