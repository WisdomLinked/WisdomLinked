/**
 * WL-SEARCH-007. Pure source plan for one Ask question string.
 * No fetch, no Mongo, and no model call. Do not import the Ask controller.
 * Greeting, instruction-shaped, and stop-word replies stay in the controller.
 *
 * Retrieve contract for the later ticket. Do not call it from this file.
 * The knowledge base wisdomlinked-search-staging stays. Do not delete it
 * and do not create a replacement.
 * POST https://kbaas.do-ai.run/v1/${GRADIENT_KNOWLEDGE_BASE_UUID}/retrieve
 * with num_results 8, alpha 0.5, and AbortSignal.timeout(15000).
 * The bearer token is GRADIENT_API_TOKEN.
 *
 * The plan never authorizes emails, phones, GPA, ranking, resumes, chatFiles,
 * profile photos, 1:1s, communities, or student records. Students stay on
 * keyword cards only for a logged-in expert.
 *
 * ownIndividual, ownSeminar, ownCommunity, and ownLegacyEvent name the
 * caller's records a later ticket may load. This function still receives
 * only the question string. Those flags are not the public seminar list.
 */

export const ASK_RETRIEVE_CONTRACT = {
    method: 'POST',
    url: 'https://kbaas.do-ai.run/v1/${GRADIENT_KNOWLEDGE_BASE_UUID}/retrieve',
    numResults: 8,
    alpha: 0.5,
    timeoutMs: 15000,
    bearerEnv: 'GRADIENT_API_TOKEN',
    knowledgeBase: 'wisdomlinked-search-staging',
} as const;

/** Prompt fields this router cannot turn on. */
export const ASK_NEVER_AUTHORIZES = [
    'emails',
    'phones',
    'gpa',
    'ranking',
    'resumes',
    'chatFiles',
    'profilePhotos',
    'oneToOnes',
    'communities',
    'studentRecords',
] as const;

export const ASK_PAGE_ROUTES = ['/rules', '/services'] as const;

export type AskPageRoute = (typeof ASK_PAGE_ROUTES)[number];

export type AskPlan = {
    mongoExperts: boolean;
    mongoSeminars: boolean;
    /** Caller's 1:1s and meetings. Not another person's rows. */
    ownIndividual: boolean;
    /** Caller's seminars. Not the public seminar catalog. */
    ownSeminar: boolean;
    /** Caller's communities. */
    ownCommunity: boolean;
    /** Caller's legacy events, including an upcoming question. */
    ownLegacyEvent: boolean;
    routes: AskPageRoute[];
    retrieve: boolean;
    model: boolean;
};

const PRICE_EN = /\b(?:cheapest|highest|under|over)\b/i;
const PRICE_ZH = /最便宜|最贵/;
const WHO_EN = /\bwhich experts?\b|\bprofessors?\b/i;
const SEMINAR = /\bseminars?\b/i;
const SEMINAR_DETAIL = /\b(?:price|prices|cost|costs|fee|fees|seats?)\b/i;
const SERVICES_WORD = /\bservices?\b/i;
const BOOKING_EN = /\b(?:bookings?|appointments?)\b/i;
const EXPLANATORY_EN = /\b(?:how|why)\b/i;
const EXPLANATORY_ZH = /怎么|如何|怎样/;
const HAN = /[\u4e00-\u9fff]/;
const MY_NEXT = String.raw`my\s+(?:next\s+|upcoming\s+)?`;
const OWN_INDIVIDUAL = new RegExp(
    String.raw`\b${MY_NEXT}(?:meetings?|1:1s?|one-on-ones?|one\s+on\s+ones?)\b|\bmeetings?\b[\s\S]{0,40}\b(?:i|i've|i'm)\b|\b(?:i|i've|i'm)\b[\s\S]{0,40}\bmeetings?\b`,
    'i',
);
const OWN_SEMINAR = new RegExp(
    String.raw`\b${MY_NEXT}seminars?\b|\bseminars?\b[\s\S]{0,40}\b(?:i have|do i)\b|\b(?:i have|do i)\b[\s\S]{0,40}\bseminars?\b`,
    'i',
);
const OWN_COMMUNITY = new RegExp(
    String.raw`\b${MY_NEXT}communit(?:y|ies)\b|\bcommunit(?:y|ies)\b[\s\S]{0,40}\b(?:i have|do i)\b`,
    'i',
);
const OWN_LEGACY = /\bupcoming\b|\bmy\s+(?:legacy\s+)?events?\b/i;

const SERVICE_LABELS = [
    'study abroad',
    'study_abroad',
    'work abroad',
    'work_abroad',
    'research guidance',
    'research_guidance',
];

/** Fact and route phrases. Any other Han text is other Chinese wording. */
const KNOWN_ZH = ['最便宜', '最贵', '教授', '预约', '怎么', '如何', '怎样'];

const hasExactService = (lower: string): boolean =>
    SERVICE_LABELS.some((label) => lower.includes(label));

const otherChinese = (question: string): boolean => {
    let rest = question;
    for (const token of KNOWN_ZH) rest = rest.split(token).join('');
    return HAN.test(rest);
};

const emptyPlan = (): AskPlan => ({
    mongoExperts: false,
    mongoSeminars: false,
    ownIndividual: false,
    ownSeminar: false,
    ownCommunity: false,
    ownLegacyEvent: false,
    routes: [],
    retrieve: true,
    model: true,
});

/** Classify which sources a later ticket may read. Pure function of the question. */
export function routeAsk(question: unknown): AskPlan {
    const text = String(question ?? '');
    const lower = text.toLowerCase();
    if (!lower.trim() && !HAN.test(text)) return emptyPlan();

    const price = PRICE_EN.test(lower) || PRICE_ZH.test(text);
    const who = WHO_EN.test(lower) || text.includes('教授');
    const seminarFact = SEMINAR.test(lower) && (SEMINAR_DETAIL.test(lower) || price);
    const exactServices = hasExactService(lower);
    const servicesPage = exactServices || SERVICES_WORD.test(lower);
    const booking = BOOKING_EN.test(lower) || text.includes('预约');
    const explanatory = EXPLANATORY_EN.test(lower) || EXPLANATORY_ZH.test(text);
    const expertSubject = who || /\bexperts?\b/i.test(lower) || exactServices;
    const seminarOwnsPrice = seminarFact && price && !expertSubject;
    const ownIndividual = OWN_INDIVIDUAL.test(lower);
    const ownSeminar = OWN_SEMINAR.test(lower);
    const ownCommunity = OWN_COMMUNITY.test(lower);
    const ownLegacyEvent = OWN_LEGACY.test(lower);
    const ownRecord = ownIndividual || ownSeminar || ownCommunity || ownLegacyEvent;

    const hasFact = price || who || seminarFact || exactServices || servicesPage || ownRecord;
    const needsLanguage = explanatory || otherChinese(text) || !hasFact;

    const routes: AskPageRoute[] = [];
    if (booking) routes.push('/rules');
    if (servicesPage) routes.push('/services');

    return {
        mongoExperts: (price && !seminarOwnsPrice) || who || exactServices,
        mongoSeminars: seminarFact && !ownSeminar,
        ownIndividual,
        ownSeminar,
        ownCommunity,
        ownLegacyEvent,
        routes,
        retrieve: needsLanguage,
        model: needsLanguage,
    };
}
