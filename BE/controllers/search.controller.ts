import { computeBookingPriceCents } from '../utils/bookingPrice';
import { normalizeExpertPrice } from '../utils/normalizeExpertPrice';
import { seminarCapacityLabel } from '../utils/seminarCapacityLabel';
import { canonicalOptionsForQuery, matchesServiceOption } from '../utils/serviceOptions';
import { enrolledStudentIds, firstFullFutureOccurrence } from '../utils/seminarCapacity';
import { normalizeProfileImageRef } from '../utils/profileImageFilename';
import { decodeBasicEntities, stripTags } from '../utils/wlHtmlPlainText';
import { safeErrorMessage } from '../utils/httpUserFacingCopy';

const User = require('../models/User');
const GroupChat = require('../models/GroupChat');
const Keyword = require('../models/Keyword');
const Service = require('../models/Service');
const { normalizeAppointmentDurations } = require('../utils/appointmentDurations');

const SEARCH_GROUP_LIMIT = 5;

const escapeRegex = (value: string): string =>
    String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toSearchPlainText = (value: unknown): string => {
    const raw = String(value ?? '');
    const withBreaks = raw
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n');
    return decodeBasicEntities(stripTags(withBreaks)).replace(/\s+/g, ' ').trim();
};

const callerId = (user: any): string => String(user?.userId || user?._id || '').trim();

const refId = (value: any): string => String(value?._id ?? value?.id ?? value ?? '').trim();

/** Cover images are public https objects stored under the chatFiles prefix. */
const seminarChatFileImage = (value: unknown): string | undefined => {
    const raw = String(value ?? '').trim();
    if (!raw) return undefined;
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return undefined;
    }
    if (url.protocol !== 'https:') return undefined;
    const parts = url.pathname.split('/').filter(Boolean);
    if (!parts.includes('chatFiles')) return undefined;
    return raw;
};

const seminarPriceDollars = (price: unknown): number => {
    if (typeof price === 'number' && Number.isFinite(price)) return price;
    if (typeof price === 'string' && price.trim() !== '') {
        const n = Number(price);
        if (Number.isFinite(n)) return n;
    }
    return 0;
};

const emptyResult = () => ({
    experts: [] as any[],
    seminars: [] as any[],
    students: [] as any[],
    yours: [] as any[],
    pages: [] as any[],
});

/**
 * WL-SEARCH-002 owns the public page index. Until BE/search/publicPages
 * exports searchPublicPages, keyword search returns pages: [].
 */
const searchPages = (query: string): any[] => {
    let mod: any;
    try {
        mod = require('../search/publicPages');
    } catch (err: any) {
        const missing = err?.code === 'MODULE_NOT_FOUND'
            || err?.code === 'ERR_MODULE_NOT_FOUND'
            || /Cannot find module/.test(String(err?.message || ''));
        if (missing) return [];
        throw err;
    }
    const fn = mod?.searchPublicPages;
    if (typeof fn !== 'function') return [];
    const rows = fn(query);
    return Array.isArray(rows) ? rows.slice(0, SEARCH_GROUP_LIMIT) : [];
};

const toExpertCard = (doc: any) => {
    const card: any = {
        id: refId(doc),
        name: String(doc?.username ?? '').trim(),
        title: String(doc?.title ?? '').trim(),
        bio: toSearchPlainText(doc?.description),
        // Active status is the only reason an expert is bookable.
        bookable: true,
    };
    const image = normalizeProfileImageRef(doc?.image);
    if (image) card.image = image;
    const hourlyRate = normalizeExpertPrice(doc?.price);
    if (hourlyRate !== undefined) {
        card.hourlyRate = hourlyRate;
        const durations = normalizeAppointmentDurations(doc?.appointmentDurations);
        card.sessionPrices = durations.map((minutes: number) => ({
            minutes,
            dollars: computeBookingPriceCents(minutes, hourlyRate) / 100,
        }));
    }
    return card;
};

const regexCond = (query: string) => ({ $regex: escapeRegex(query), $options: 'i' });

const searchExperts = async (query: string) => {
    const rx = regexCond(query);
    const keywords = await Keyword.find({ value: rx }).select('_id').lean();
    const keywordIds = (Array.isArray(keywords) ? keywords : [])
        .map((row: any) => row?._id)
        .filter((id: any) => id != null);

    const matchedOptions = canonicalOptionsForQuery(query);
    let serviceIds: any[] = [];
    if (matchedOptions.length) {
        const services = await Service.find({}).select('value label name').lean();
        serviceIds = (Array.isArray(services) ? services : [])
            .filter((row: any) => matchedOptions.some((opt) => matchesServiceOption(row, opt)))
            .map((row: any) => row?._id)
            .filter((id: any) => id != null);
    }

    const or: any[] = [
        { username: rx },
        { title: rx },
        { description: rx },
        { customKeywords: rx },
    ];
    if (keywordIds.length) or.push({ keywords: { $in: keywordIds } });
    if (serviceIds.length) or.push({ services: { $in: serviceIds } });

    const docs = await User.find({
        role: 'expert',
        status: 'active',
        $or: or,
    })
        .select('username title description image price appointmentDurations')
        .limit(SEARCH_GROUP_LIMIT)
        .lean();

    return (Array.isArray(docs) ? docs : []).slice(0, SEARCH_GROUP_LIMIT).map(toExpertCard);
};

const hostIsActive = (doc: any): boolean => {
    const admin = doc?.admin;
    if (!admin || typeof admin !== 'object') return false;
    return String(admin.status || '') === 'active';
};

const seriesKey = (doc: any): string => {
    const raw = doc?.seriesId;
    const sid = raw && typeof raw === 'object' ? (raw._id ?? raw.id) : raw;
    const text = sid == null ? '' : String(sid).trim();
    if (text && text !== 'null' && text !== 'undefined') return text;
    return refId(doc);
};

const timeMs = (value: unknown): number => {
    if (value == null || value === '') return NaN;
    const ms = new Date(value as any).getTime();
    return Number.isFinite(ms) ? ms : NaN;
};

const occurrencePhase = (doc: any, now: number): 'future' | 'in_progress' | 'ended' => {
    const start = timeMs(doc?.start);
    const end = timeMs(doc?.end);
    if (Number.isFinite(start) && Number.isFinite(end) && start < now && now < end) return 'in_progress';
    if (Number.isFinite(end) && end <= now) return 'ended';
    if (Number.isFinite(start) && start >= now) return 'future';
    if (Number.isFinite(start) && start < now) return 'ended';
    return 'ended';
};

const toSeminarCard = (id: string, occurrences: any[], now: number) => {
    const live = occurrences.filter((occ) => occurrencePhase(occ, now) !== 'ended');
    if (!live.length) return null;
    live.sort((a, b) => timeMs(a?.start) - timeMs(b?.start));
    const representative = live[0];
    const card: any = {
        id,
        name: toSearchPlainText(representative?.name),
        description: toSearchPlainText(representative?.description),
        price: seminarPriceDollars(representative?.price),
        full: Boolean(firstFullFutureOccurrence(occurrences, now)),
        seats: seminarCapacityLabel(
            enrolledStudentIds(representative).length,
            representative?.maxAttendees,
        ),
    };
    const image = seminarChatFileImage(representative?.image);
    if (image) card.image = image;
    const hostImage = normalizeProfileImageRef(representative?.admin?.image);
    if (hostImage) card.hostImage = hostImage;
    return card;
};

const searchSeminars = async (query: string) => {
    const rx = regexCond(query);
    const now = Date.now();
    const matches = await GroupChat.find({
        type: 'seminar',
        status: { $in: ['pending', 'active'] },
        $or: [{ name: rx }, { description: rx }],
    })
        .populate({ path: 'admin', select: 'username image status' })
        .lean();

    const keys = new Set<string>();
    for (const doc of Array.isArray(matches) ? matches : []) {
        if (!hostIsActive(doc)) continue;
        keys.add(seriesKey(doc));
    }
    if (!keys.size) return [];

    const keyList = [...keys];
    const siblings = await GroupChat.find({
        type: 'seminar',
        status: { $in: ['pending', 'active'] },
        $or: [
            { seriesId: { $in: keyList } },
            { _id: { $in: keyList } },
        ],
    })
        .populate({ path: 'admin', select: 'username image status' })
        .lean();

    const groups = new Map<string, any[]>();
    for (const doc of Array.isArray(siblings) ? siblings : []) {
        if (!hostIsActive(doc)) continue;
        const key = seriesKey(doc);
        if (!keys.has(key)) continue;
        const list = groups.get(key) || [];
        list.push(doc);
        groups.set(key, list);
    }

    const cards: any[] = [];
    for (const [id, occurrences] of groups) {
        const card = toSeminarCard(id, occurrences, now);
        if (card) cards.push(card);
    }
    return cards.slice(0, SEARCH_GROUP_LIMIT);
};

const toStudentCard = (doc: any) => {
    const card: any = {
        id: refId(doc),
        name: String(doc?.username ?? '').trim(),
        degreeSought: String(doc?.degreeSought ?? ''),
        currentUniversity: String(doc?.currentUniversity ?? ''),
        intendedIntake: String(doc?.intendedIntake ?? ''),
    };
    const image = normalizeProfileImageRef(doc?.image);
    if (image) card.image = image;
    return card;
};

const searchStudents = async (req: any, query: string) => {
    if (req?.user?.role !== 'expert') return [];
    const expertId = callerId(req.user);
    if (!expertId) return [];

    const expert = await User.findById(expertId).select('followers').lean();
    const followerIds = (Array.isArray(expert?.followers) ? expert.followers : [])
        .map((id: any) => refId(id))
        .filter(Boolean);

    const chats = await GroupChat.find({
        admin: expertId,
        type: { $in: ['individual', 'seminar'] },
    }).select('admin participants').lean();

    const participantIds: string[] = [];
    for (const chat of Array.isArray(chats) ? chats : []) {
        const adminId = refId(chat?.admin);
        for (const participant of Array.isArray(chat?.participants) ? chat.participants : []) {
            const id = refId(participant);
            if (id && id !== adminId) participantIds.push(id);
        }
    }

    const related = [...new Set([...followerIds, ...participantIds])];
    if (!related.length) return [];

    const rx = regexCond(query);
    const docs = await User.find({
        _id: { $in: related },
        role: 'customer',
        isAdHocCustomer: { $ne: true },
        status: { $ne: 'blocked' },
        $or: [
            { username: rx },
            { degreeSought: rx },
            { currentUniversity: rx },
            { intendedIntake: rx },
        ],
    })
        .select('username image degreeSought currentUniversity intendedIntake')
        .limit(SEARCH_GROUP_LIMIT)
        .lean();

    return (Array.isArray(docs) ? docs : []).slice(0, SEARCH_GROUP_LIMIT).map(toStudentCard);
};

const personCard = (user: any) => {
    const card: any = {
        id: refId(user),
        name: String(user?.username ?? '').trim(),
    };
    const image = normalizeProfileImageRef(user?.image);
    if (image) card.image = image;
    return card;
};

const searchYours = async (req: any, query: string) => {
    const role = req?.user?.role;
    if (role !== 'expert' && role !== 'customer') return [];
    const userId = callerId(req.user);
    if (!userId) return [];

    const rows = await GroupChat.find({
        type: 'individual',
        status: { $in: ['pending', 'active'] },
        end: { $gt: new Date() },
        $or: [{ admin: userId }, { participants: userId }],
    })
        .populate({ path: 'admin', select: 'username image' })
        .populate({ path: 'participants', select: 'username image' })
        .lean();

    const needle = new RegExp(escapeRegex(query), 'i');
    const cards: any[] = [];
    for (const row of Array.isArray(rows) ? rows : []) {
        const adminId = refId(row?.admin);
        const participants = Array.isArray(row?.participants) ? row.participants : [];
        const participantIds = participants.map((participant: any) => refId(participant));
        if (adminId !== userId && !participantIds.includes(userId)) continue;
        const student = participants.find((participant: any) => refId(participant) !== adminId);
        const expert = row?.admin && typeof row.admin === 'object' ? row.admin : null;
        if (!student || typeof student !== 'object' || !expert) continue;
        const hay = [row?.name, row?.description, student.username, expert.username].join('\n');
        if (!needle.test(hay)) continue;
        cards.push({
            id: refId(row),
            name: toSearchPlainText(row?.name),
            start: row?.start ? new Date(row.start).toISOString() : null,
            end: row?.end ? new Date(row.end).toISOString() : null,
            student: personCard(student),
            expert: personCard(expert),
        });
        if (cards.length >= SEARCH_GROUP_LIMIT) break;
    }
    return cards;
};

/** Every active expert, as the same public card keyword search returns. */
const listPublicExpertCards = async () => {
    const docs = await User.find({
        role: 'expert',
        status: 'active',
    })
        .select('username title description image price appointmentDurations')
        .lean();

    return (Array.isArray(docs) ? docs : []).map(toExpertCard);
};

/** Every live seminar series, as the same public card keyword search returns. */
const listPublicSeminarCards = async () => {
    const now = Date.now();
    const docs = await GroupChat.find({
        type: 'seminar',
        status: { $in: ['pending', 'active'] },
    })
        .populate({ path: 'admin', select: 'username image status' })
        .lean();

    const groups = new Map<string, any[]>();
    for (const doc of Array.isArray(docs) ? docs : []) {
        if (!hostIsActive(doc)) continue;
        const key = seriesKey(doc);
        const list = groups.get(key) || [];
        list.push(doc);
        groups.set(key, list);
    }

    const cards: any[] = [];
    for (const [id, occurrences] of groups) {
        const card = toSeminarCard(id, occurrences, now);
        if (card) cards.push(card);
    }
    return cards;
};

const collectSearchResults = async (req, q: string) => {
    const query = String(q ?? '').trim();
    if (query.length < 2) return emptyResult();
    const [experts, seminars, students, yours] = await Promise.all([
        searchExperts(query),
        searchSeminars(query),
        searchStudents(req, query),
        searchYours(req, query),
    ]);
    return {
        experts,
        seminars,
        students,
        yours,
        pages: searchPages(query),
    };
};

const search = async (req, res) => {
    try {
        const raw = req.query?.q;
        const q = String(Array.isArray(raw) ? raw[0] : raw ?? '').trim();
        return res.status(200).json(await collectSearchResults(req, q));
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

module.exports = {
    search,
    collectSearchResults,
    SEARCH_GROUP_LIMIT,
    listPublicExpertCards,
    listPublicSeminarCards,
};
