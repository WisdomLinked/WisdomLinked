const mammoth = require("mammoth");
const TermsVersion = require("../models/TermsVersion");
const TermsAcceptance = require("../models/TermsAcceptance");
const User = require("../models/User");
const {
    sha256Text,
    sha256Buffer,
    sanitizeTermsHtml,
    termsError,
    parseSignaturePng,
} = require("../utils/termsHtml");

const TERMS_AUDIENCES = ["shared", "expert", "customer"];
const TERMS_NOTES_MAX = 500;
const TERMS_SEARCH_LIMIT = 25;

/** Roles whose accounts must sign each contract. Mirrors listRequiredContracts. */
const AUDIENCE_ROLES: Record<string, string[]> = {
    shared: ["expert", "customer"],
    expert: ["expert"],
    customer: ["customer"],
};

/** Blocked accounts cannot sign in, so they are never asked to sign. */
function audienceMemberFilter(audience: string) {
    return { role: { $in: AUDIENCE_ROLES[audience] || [] }, status: { $ne: "blocked" } };
}

function readNotes(value: unknown): string {
    const notes = String(value ?? "").trim();
    if (notes.length > TERMS_NOTES_MAX) {
        throw termsError(400, `Keep the change notes to ${TERMS_NOTES_MAX} characters or fewer.`);
    }
    return notes;
}

const SIGNUP_TERMS_REQUIRED = "Sign the current Terms and Agreement before creating an account.";
const SIGNUP_TERMS_STALE = "The terms you signed are out of date. Reload the page and sign the current agreement.";
const AGREE_REQUIRED = "Check I agree to continue.";
const SIGNATURE_REQUIRED = "Enter your full legal name or draw your signature.";

function normalizeAudience(value: unknown): string | null {
    const audience = String(value || "").trim().toLowerCase();
    return TERMS_AUDIENCES.includes(audience) ? audience : null;
}

function roleAudience(role: unknown): string | null {
    if (role === "expert") return "expert";
    if (role === "customer") return "customer";
    return null;
}

function escapeRegExp(value: string): string {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeHash(value: unknown): string {
    return String(value || "").trim().toLowerCase();
}

function requestClientMeta(req: any) {
    const ip = String(req?.ip || req?.socket?.remoteAddress || "").slice(0, 200);
    const userAgent = String(
        (typeof req?.get === "function" ? req.get("user-agent") : "") ||
        req?.headers?.["user-agent"] ||
        ""
    ).slice(0, 1000);
    return { ip, userAgent };
}

function readSignupPayload(body: any) {
    const raw = body?.termsAgreement;
    if (raw == null || raw === "") return null;
    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" ? parsed : null;
        } catch (_err) {
            return null;
        }
    }
    if (typeof raw === "object") return raw;
    return null;
}

/** Returns a field error string, or the normalized signature fields. */
function assertSignature(input: any): string | { typedName: string; signaturePng: string } {
    const agreed = input?.agreed === true || input?.agreed === "true" || input?.agreed === 1;
    if (!agreed) return AGREE_REQUIRED;
    const typedName = String(input?.typedName || "").trim();
    if (typedName.length > 200) return "Enter a shorter legal name.";
    const signature = parseSignaturePng(input?.signaturePng);
    if ("error" in signature) return signature.error;
    if (!typedName && !signature.png) return SIGNATURE_REQUIRED;
    return { typedName, signaturePng: signature.png };
}

async function readLatest(audience: string) {
    return TermsVersion.findOne({ audience }).sort({ version: -1 }).select("-docx").lean();
}

async function convertDocxToSanitizedHtml(buffer: Buffer): Promise<string> {
    if (!buffer || !buffer.length) throw termsError(400, "Upload a .docx file.");
    let raw = "";
    try {
        const result = await mammoth.convertToHtml({ buffer });
        raw = String(result?.value || "");
    } catch (err: any) {
        console.error("[terms] docx convert", err?.message || err);
        throw termsError(400, "Could not read that document. Upload a .docx file.");
    }
    const html = sanitizeTermsHtml(raw);
    const text = html.replace(/<[^>]+>/g, "").trim();
    if (!text) throw termsError(400, "That document has no text to publish.");
    return html;
}

function publicContract(doc: any) {
    return {
        audience: doc.audience,
        version: doc.version,
        html: doc.html,
        contentHash: doc.contentHash,
        originalFilename: doc.originalFilename || "",
    };
}

function publisherFields(doc: any) {
    const publisher = doc.publisher;
    if (publisher && typeof publisher === "object") {
        return {
            publisherId: String(publisher._id || publisher.id || ""),
            publisherName: publisher.username || publisher.name || publisher.email || "",
        };
    }
    return {
        publisherId: publisher ? String(publisher) : "",
        publisherName: "",
    };
}

function versionMeta(doc: any) {
    return {
        audience: doc.audience,
        version: doc.version,
        contentHash: doc.contentHash,
        docxSha256: doc.docxSha256,
        originalFilename: doc.originalFilename || "",
        notes: doc.notes || "",
        publishedAt: doc.publishedAt,
        ...publisherFields(doc),
    };
}

async function previewTermsVersion({ audience, buffer }: { audience: string; buffer: Buffer }) {
    const html = await convertDocxToSanitizedHtml(buffer);
    return {
        audience,
        html,
        contentHash: sha256Text(html),
        docxSha256: sha256Buffer(buffer),
    };
}

async function publishTermsVersion({
    audience,
    buffer,
    filename,
    publisherId,
    notes: rawNotes,
}: {
    audience: string;
    buffer: Buffer;
    filename: string;
    publisherId: string;
    notes?: unknown;
}) {
    const notes = readNotes(rawNotes);
    const html = await convertDocxToSanitizedHtml(buffer);
    const contentHash = sha256Text(html);
    const docxSha256 = sha256Buffer(buffer);
    const originalFilename = String(filename || "terms.docx").slice(0, 300);
    const publishedAt = new Date();

    for (let attempt = 0; attempt < 3; attempt++) {
        const latest = await readLatest(audience);
        const version = (latest?.version || 0) + 1;
        try {
            const created = await TermsVersion.create({
                audience,
                version,
                html,
                contentHash,
                docx: buffer,
                docxSha256,
                originalFilename,
                notes,
                publisher: publisherId,
                publishedAt,
            });
            return {
                ...versionMeta(created),
                html,
                contentHash,
                publishedAt: created.publishedAt || publishedAt,
            };
        } catch (err: any) {
            if (err?.code === 11000 && attempt < 2) continue;
            throw err;
        }
    }
    throw termsError(500, "Could not publish that agreement.");
}

async function listVersionMetas(audience: string) {
    const rows = await TermsVersion.find({ audience })
        .sort({ version: 1 })
        .select("-docx")
        .populate("publisher", "username email name")
        .lean();
    return rows.map(versionMeta);
}

/**
 * Versions plus how many people the contract applies to and how many of them
 * signed each version. Signatures from accounts that are no longer in the
 * audience (deleted, blocked, role changed) are not counted, so accepted can
 * never exceed the audience and pending never goes negative.
 */
async function listVersionOverview(audience: string) {
    const versions = await listVersionMetas(audience);
    const members = await User.find(audienceMemberFilter(audience)).select("_id").lean();
    const memberIds = members.map((member: any) => member._id);
    const signersByVersion = new Map<number, Set<string>>();
    if (memberIds.length && versions.length) {
        const rows = await TermsAcceptance.find({ audience, user: { $in: memberIds } })
            .select("user version")
            .lean();
        for (const row of rows) {
            const version = Number(row.version);
            if (!signersByVersion.has(version)) signersByVersion.set(version, new Set());
            signersByVersion.get(version)!.add(String(row.user));
        }
    }
    return {
        audience,
        audienceSize: memberIds.length,
        versions: versions.map((meta: any) => ({
            ...meta,
            accepted: signersByVersion.get(Number(meta.version))?.size || 0,
        })),
    };
}

async function getVersionDocument(audience: string, version: number, withDocx = false) {
    let query = TermsVersion.findOne({ audience, version: Number(version) });
    query = withDocx ? query.select("+docx") : query.select("-docx");
    const doc = await query.lean();
    if (!doc) throw termsError(404, "That agreement version was not found.");
    if (withDocx) {
        const bytes = docxBytes(doc.docx);
        if (!bytes) throw termsError(404, "That agreement file was not found.");
        doc.docx = bytes;
    }
    return doc;
}

/**
 * .lean() returns stored files as a BSON Binary, not a Buffer. Express would
 * send a Binary as JSON (a quoted base64 string), which is not a .docx.
 */
function docxBytes(value: any): Buffer | null {
    if (Buffer.isBuffer(value)) return value;
    if (value?.buffer instanceof Uint8Array) {
        const end = typeof value.position === "number" ? value.position : value.buffer.length;
        return Buffer.from(value.buffer.subarray(0, end));
    }
    if (value instanceof Uint8Array) return Buffer.from(value);
    return null;
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Public link to a version's .docx for the admin "View document" button, which opens the same
 * online Word viewer résumés use (that viewer has to fetch the file from a public URL). The file
 * is copied to Spaces the first time it is viewed and the link is kept, so older versions need
 * no backfill. The agreement text is already shown to every signer, so a public copy is fine.
 * `upload` is the existing Spaces uploader; a failure throws `code: "DOCX_VIEWER_UNAVAILABLE"`.
 */
async function ensureVersionDocxUrl(
    audience: string,
    version: number,
    upload: (file: { buffer: Buffer; originalname: string; mimetype: string }, folder: string) => Promise<string>,
): Promise<string> {
    const meta = await getVersionDocument(audience, version, false);
    if (meta.docxUrl) return meta.docxUrl;
    const doc = await getVersionDocument(audience, version, true);
    let url = "";
    try {
        url = await upload(
            { buffer: doc.docx, originalname: safeDownloadName(doc.originalFilename, audience, version), mimetype: DOCX_MIME },
            "termsDocuments",
        );
    } catch (err: any) {
        console.error("[terms] could not copy the agreement file to Spaces", err?.message);
    }
    if (!url) {
        const err: any = new Error("Agreement file could not be uploaded for viewing.");
        err.code = "DOCX_VIEWER_UNAVAILABLE";
        throw err;
    }
    // Two admins opening the same old version at once: keep whichever link was saved first.
    const saved = await TermsVersion.findOneAndUpdate(
        { _id: doc._id, $or: [{ docxUrl: { $exists: false } }, { docxUrl: "" }, { docxUrl: null }] },
        { $set: { docxUrl: url } },
        { new: true },
    )
        .select("docxUrl")
        .lean();
    if (saved?.docxUrl) return saved.docxUrl;
    const current = await TermsVersion.findOne({ _id: doc._id }).select("docxUrl").lean();
    return current?.docxUrl || url;
}

function safeDownloadName(name: string, audience: string, version: number) {
    const cleaned = String(name || "")
        .replace(/[/\\"]/g, "")
        .replace(/[\r\n]/g, "")
        .trim();
    if (cleaned.toLowerCase().endsWith(".docx")) return cleaned;
    return `terms-${audience}-v${version}.docx`;
}

async function listSigners(audience: string, version: number) {
    const versionDoc = await getVersionDocument(audience, version, false);
    const rows = await TermsAcceptance.find({ audience, version: Number(version) }).lean();
    rows.sort((a: any, b: any) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime());
    const ids = rows.map((row: any) => row.user);
    const users = ids.length
        ? await User.find({ _id: { $in: ids } }).select("email username name role status").lean()
        : [];
    const byId = new Map(users.map((user: any) => [String(user._id), user]));
    return {
        version: versionMeta(versionDoc),
        acceptances: rows.map((row: any) => {
            const account: any = byId.get(String(row.user)) || {};
            return acceptanceView(row, account, versionDoc);
        }),
    };
}

function acceptanceView(row: any, account: any, versionDoc: any) {
    return {
        userId: String(row.user || account?._id || ""),
        email: account?.email || "",
        username: account?.username || "",
        name: account?.name || "",
        role: account?.role || "",
        status: account?.status || "",
        audience: row.audience,
        version: row.version,
        signedAt: row.signedAt,
        ip: row.ip || "",
        userAgent: row.userAgent || "",
        contentHash: row.contentHash,
        versionContentHash: versionDoc?.contentHash || "",
        hashMatches: !!versionDoc && versionDoc.contentHash === row.contentHash,
        typedName: row.typedName || "",
        signaturePng: row.signaturePng || "",
        originalFilename: versionDoc?.originalFilename || "",
    };
}

function termsUserSearchFilter(term: string) {
    const rx = new RegExp(escapeRegExp(term), "i");
    return {
        $or: [
            { email: rx },
            { username: rx },
            { name: rx },
        ],
    };
}

async function searchTermsUsers(rawQuery: unknown) {
    const term = String(rawQuery || "").trim();
    if (!term) throw termsError(400, "Enter a name, username, or email.");
    if (term.length > 100) throw termsError(400, "Search is too long.");
    const users = await User.find(termsUserSearchFilter(term))
        .select("email username name role status")
        .limit(TERMS_SEARCH_LIMIT)
        .lean();
    const latest = await latestSignaturesFor(users.map((user: any) => user._id));
    return users.map((user: any) => ({
        id: String(user._id),
        email: user.email || "",
        username: user.username || "",
        name: user.name || "",
        role: user.role || "",
        status: user.status || "",
        signatures: latest.get(String(user._id)) || [],
    }));
}

/** Each user's highest signed version per contract, so search results can show where they stand. */
async function latestSignaturesFor(userIds: any[]) {
    const byUser = new Map<string, { audience: string; version: number; signedAt: any }[]>();
    if (!userIds.length) return byUser;
    const rows = await TermsAcceptance.find({ user: { $in: userIds } })
        .select("user audience version signedAt")
        .lean();
    const best = new Map<string, any>();
    for (const row of rows) {
        const key = `${row.user}|${row.audience}`;
        const seen = best.get(key);
        if (!seen || Number(row.version) > Number(seen.version)) best.set(key, row);
    }
    for (const row of best.values()) {
        const userId = String(row.user);
        if (!byUser.has(userId)) byUser.set(userId, []);
        byUser.get(userId)!.push({ audience: row.audience, version: Number(row.version), signedAt: row.signedAt });
    }
    return byUser;
}

async function listAcceptancesForUser(userId: string) {
    const user = await User.findById(userId).select("email username name role status").lean();
    if (!user) throw termsError(404, "Account not found.");
    const rows = await TermsAcceptance.find({ user: userId }).lean();
    rows.sort((a: any, b: any) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime());
    const acceptances = [];
    for (const row of rows) {
        const versionDoc = await TermsVersion.findOne({ audience: row.audience, version: row.version })
            .select("-docx")
            .lean();
        acceptances.push(acceptanceView(row, user, versionDoc));
    }
    return {
        user: {
            id: String(user._id),
            email: user.email || "",
            username: user.username || "",
            name: user.name || "",
            role: user.role || "",
        },
        acceptances,
    };
}

async function listRequiredContracts(user: any) {
    if (!user || user.role === "admin") return [];
    const role = roleAudience(user.role);
    if (!role) return [];
    const userId = user.userId || user._id || user.id;
    const contracts = [];
    for (const audience of ["shared", role]) {
        const latest = await readLatest(audience);
        if (!latest) continue;
        const signed = await TermsAcceptance.findOne({
            user: userId,
            audience,
            version: latest.version,
        }).lean();
        if (!signed) contracts.push(publicContract(latest));
    }
    return contracts;
}

async function getVisibleCurrent(user: any, audienceRaw: unknown) {
    const audience = normalizeAudience(audienceRaw);
    const role = roleAudience(user?.role);
    if (!audience || (audience !== "shared" && audience !== role)) {
        throw termsError(403, "That agreement does not apply to your account.");
    }
    const latest = await readLatest(audience);
    if (!latest) return { published: false, audience };
    const userId = user.userId || user._id || user.id;
    const signed = await TermsAcceptance.findOne({
        user: userId,
        audience,
        version: latest.version,
    }).lean();
    const current = {
        published: true,
        alreadySigned: !!signed,
        ...publicContract(latest),
    };
    if (!signed) return current;
    const signedAt = signed.signedAt ? new Date(signed.signedAt) : null;
    return {
        ...current,
        alreadySigned: true,
        signedAt: signedAt && !Number.isNaN(signedAt.getTime()) ? signedAt.toISOString() : "",
        typedName: String(signed.typedName || ""),
        signaturePng: String(signed.signaturePng || ""),
    };
}

async function insertAcceptance(doc: any) {
    const existing = await TermsAcceptance.findOne({
        user: doc.user,
        audience: doc.audience,
        version: doc.version,
    }).lean();
    if (existing) return { alreadyAccepted: true, acceptance: existing };
    try {
        const created = await TermsAcceptance.create(doc);
        return { alreadyAccepted: false, acceptance: created };
    } catch (err: any) {
        if (err?.code === 11000) {
            const again = await TermsAcceptance.findOne({
                user: doc.user,
                audience: doc.audience,
                version: doc.version,
            }).lean();
            return { alreadyAccepted: true, acceptance: again };
        }
        throw err;
    }
}

async function acceptTermsForUser({
    userId,
    role,
    body,
    meta,
}: {
    userId: string;
    role: string;
    body: any;
    meta: { ip: string; userAgent: string };
}) {
    const audience = normalizeAudience(body?.audience);
    const allowed = audience === "shared" || audience === roleAudience(role);
    if (!audience || !allowed) {
        throw termsError(403, "That agreement does not apply to your account.");
    }
    const version = Number(body?.version);
    if (!Number.isInteger(version) || version < 1) {
        throw termsError(400, "That agreement version was not found.");
    }
    const versionDoc = await TermsVersion.findOne({ audience, version }).select("-docx").lean();
    if (!versionDoc) throw termsError(404, "That agreement version was not found.");
    if (normalizeHash(body?.contentHash) !== versionDoc.contentHash) {
        throw termsError(409, SIGNUP_TERMS_STALE);
    }
    const signature = assertSignature(body);
    if (typeof signature === "string") throw termsError(400, signature);
    return insertAcceptance({
        user: userId,
        audience,
        version,
        contentHash: versionDoc.contentHash,
        signedAt: new Date(),
        ip: meta.ip,
        userAgent: meta.userAgent,
        typedName: signature.typedName,
        signaturePng: signature.signaturePng,
    });
}

function acceptanceFromPayload(payload: any, current: any, meta: { ip: string; userAgent: string }) {
    const signature = assertSignature(payload);
    if (typeof signature === "string") return { ok: false as const, error: signature };
    if (Number(payload.version) !== current.version || normalizeHash(payload.contentHash) !== current.contentHash) {
        return { ok: false as const, error: SIGNUP_TERMS_STALE };
    }
    return {
        ok: true as const,
        acceptance: {
            audience: "shared",
            version: current.version,
            contentHash: current.contentHash,
            typedName: signature.typedName,
            signaturePng: signature.signaturePng,
            ip: meta.ip,
            userAgent: meta.userAgent,
            signedAt: new Date(),
            agreed: true,
        },
    };
}

/** Signup may proceed exactly as it does today until a shared version exists. */
async function gateSignupAgreement(body: any, meta: { ip: string; userAgent: string }) {
    const current = await readLatest("shared");
    if (!current) return { ok: true as const, acceptance: null };
    const payload = readSignupPayload(body);
    if (!payload) return { ok: false as const, error: SIGNUP_TERMS_REQUIRED };
    return acceptanceFromPayload(payload, current, meta);
}

/** Re-check the signature captured at register against the shared version that is current now. */
async function assertPendingSignupCanCreateAccount(stored: any) {
    const current = await readLatest("shared");
    if (!current) return { ok: true as const, acceptance: null };
    if (!stored || typeof stored !== "object") {
        return { ok: false as const, error: SIGNUP_TERMS_REQUIRED };
    }
    const signature = assertSignature(stored);
    if (typeof signature === "string") return { ok: false as const, error: signature };
    if (Number(stored.version) !== current.version || normalizeHash(stored.contentHash) !== current.contentHash) {
        return { ok: false as const, error: SIGNUP_TERMS_STALE };
    }
    return {
        ok: true as const,
        acceptance: {
            audience: "shared",
            version: current.version,
            contentHash: current.contentHash,
            typedName: signature.typedName,
            signaturePng: signature.signaturePng,
            ip: String(stored.ip || ""),
            userAgent: String(stored.userAgent || ""),
            signedAt: stored.signedAt ? new Date(stored.signedAt) : new Date(),
            agreed: true,
        },
    };
}

async function recordSignupAcceptance(userId: string, acceptance: any) {
    return insertAcceptance({
        user: userId,
        audience: "shared",
        version: acceptance.version,
        contentHash: acceptance.contentHash,
        signedAt: acceptance.signedAt || new Date(),
        ip: acceptance.ip || "",
        userAgent: acceptance.userAgent || "",
        typedName: acceptance.typedName || "",
        signaturePng: acceptance.signaturePng || "",
    });
}

async function getCurrentSharedPublic() {
    const latest = await readLatest("shared");
    if (!latest) return { published: false };
    return { published: true, ...publicContract(latest) };
}

module.exports = {
    TERMS_AUDIENCES,
    TERMS_NOTES_MAX,
    TERMS_SEARCH_LIMIT,
    SIGNUP_TERMS_REQUIRED,
    SIGNUP_TERMS_STALE,
    normalizeAudience,
    roleAudience,
    requestClientMeta,
    termsUserSearchFilter,
    previewTermsVersion,
    publishTermsVersion,
    listVersionMetas,
    listVersionOverview,
    getVersionDocument,
    ensureVersionDocxUrl,
    safeDownloadName,
    listSigners,
    searchTermsUsers,
    listAcceptancesForUser,
    listRequiredContracts,
    getVisibleCurrent,
    acceptTermsForUser,
    gateSignupAgreement,
    assertPendingSignupCanCreateAccount,
    recordSignupAcceptance,
    getCurrentSharedPublic,
    readLatest,
};
