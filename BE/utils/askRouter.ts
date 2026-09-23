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

    const hasFact = price || who || seminarFact || exactServices || servicesPage;
    const needsLanguage = explanatory || otherChinese(text) || !hasFact;

    const routes: AskPageRoute[] = [];
    if (booking) routes.push('/rules');
    if (servicesPage) routes.push('/services');

    return {
        mongoExperts: (price && !seminarOwnsPrice) || who || exactServices,
        mongoSeminars: seminarFact,
        routes,
        retrieve: needsLanguage,
        model: needsLanguage,
    };
}
