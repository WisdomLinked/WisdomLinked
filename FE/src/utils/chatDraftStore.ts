import { isQuillComposerEmpty } from "./quillSendHtml";

const STORAGE_KEY = "wl_chat_drafts_v1";

const MAX_DRAFTS = 100;

type DraftRecord = { html: string; at: number };
type DraftMap = Record<string, DraftRecord>;

type ChatPeer = { userId?: string | number | null } | null | undefined;
type ChatGroup = { groupId?: string | number | null; _id?: string | number | null } | null | undefined;

function readStore(): DraftMap {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        const out: DraftMap = {};
        Object.entries(parsed as Record<string, any>).forEach(([key, value]) => {
            const html = typeof value?.html === "string" ? value.html : "";
            if (!html) return;
            out[key] = { html, at: Number(value?.at) || 0 };
        });
        return out;
    } catch {
        return {};
    }
}

function prune(map: DraftMap, limit: number): DraftMap {
    const keys = Object.keys(map);
    if (keys.length <= limit) return map;
    const newest = keys
        .sort((a, b) => (map[b].at || 0) - (map[a].at || 0))
        .slice(0, limit);
    const out: DraftMap = {};
    newest.forEach((key) => {
        out[key] = map[key];
    });
    return out;
}

function writeStore(map: DraftMap): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prune(map, MAX_DRAFTS)));
    } catch {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prune(map, 10)));
        } catch {
        }
    }
}

function idPart(value: unknown): string {
    const text = String(value ?? "").trim();
    return text && text !== "null" && text !== "undefined" ? text : "";
}

export function chatDraftKey(ownerId: unknown, peer: ChatPeer, group: ChatGroup): string | null {
    const owner = idPart(ownerId);
    if (!owner) return null;

    const peerId = idPart(peer?.userId);
    if (peerId) return `${owner}|dm|${peerId}`;

    const groupId = idPart(group?.groupId) || idPart(group?._id);
    if (groupId) return `${owner}|group|${groupId}`;

    return null;
}

export function readDraft(key: string | null): string {
    if (!key) return "";
    return readStore()[key]?.html ?? "";
}
export function writeDraft(key: string | null, html: string): void {
    if (!key) return;
    const map = readStore();
    if (isQuillComposerEmpty(html)) {
        if (!(key in map)) return;
        delete map[key];
    } else {
        map[key] = { html, at: Date.now() };
    }
    writeStore(map);
}

export function clearDraft(key: string | null): void {
    if (!key) return;
    const map = readStore();
    if (!(key in map)) return;
    delete map[key];
    writeStore(map);
}
