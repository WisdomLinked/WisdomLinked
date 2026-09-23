const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'of', 'to', 'for', 'in', 'on', 'at', 'by',
    'with', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'do', 'does',
    'did', 'have', 'has', 'had', 'i', 'you', 'we', 'they', 'he', 'she', 'it', 'me', 'my',
    'your', 'our', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'why',
    'how', 'where', 'when', 'can', 'could', 'should', 'would', 'will', 'just', 'about',
    'into', 'over', 'after', 'before', 'than', 'too', 'very', 'not', 'no', 'so', 'please',
    'tell', 'up', 'out', 'any', 'some', 'there', 'here', 'its',
]);

const INSTRUCTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
    /disregard\s+(your|the|all)\s+(instructions|rules|prompt)/i,
    /\b(system|developer)\s*:\s*/i,
    /\byou\s+are\s+now\b/i,
    /\bact\s+as\b/i,
    /\bpretend\s+(you|to)\b/i,
    /\bnew\s+instructions\b/i,
    /<\s*\/?\s*(system|instructions)\s*>/i,
    /\bjailbreak\b/i,
    /\bdo\s+not\s+follow\b/i,
    /\boverride\s+(the\s+)?(system|instructions|rules)\b/i,
];

const DOLLAR_AMOUNT = /(?:\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)|(?:\b\d+(?:\.\d{1,2})?\s*(?:dollars|usd)\b)|(?:\b(?:usd|us\$)\s?\d+(?:\.\d{1,2})?\b)/gi;
const CLOCK_TIME = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\b|\b\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)\b/gi;
const RATING_PHRASE = /\b(?:rated\s+)?\d+(?:\.\d+)?\s*(?:stars?|\/\s*5)\b|\b\d+(?:\.\d+)?\s*star\s+rating\b/gi;
const SEAT_PHRASE = /\b\d+\s+of\s+\d+\s+seats?\b|\b\d+\s+seats?\b(?:\s+(?:left|filled|available|remaining))?/gi;

export type StoredAskRole = 'user' | 'customer' | 'expert';

export type PromptPage = { title?: string; snippet?: string; route?: string };
export type PromptExpert = { name?: string; title?: string; bio?: string };
export type PromptSeminar = { name?: string; description?: string };
export type PromptQuestion = { question?: string; answer?: string };

const normalizeNumber = (raw: string): string => {
    const n = Number(String(raw).replace(/,/g, ''));
    if (!Number.isFinite(n)) return '';
    return String(n);
};

export const normalizeQuestion = (value: unknown): string =>
    String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

const tokens = (value: unknown): string[] =>
    normalizeQuestion(value).split(/[^a-z0-9]+/).filter(Boolean);

export const isStopWordOnly = (value: unknown): boolean => {
    const words = tokens(value);
    if (!words.length) return true;
    return words.every((word) => STOP_WORDS.has(word));
};

export const isInstructionShaped = (value: unknown): boolean => {
    const text = String(value ?? '');
    return INSTRUCTION_PATTERNS.some((pattern) => pattern.test(text));
};

const GREETINGS = new Set(['hi', 'hii', 'hey', 'hello', 'thanks', 'thank you']);

/** Whole-message greetings, including the same words with punctuation. */
export const isGreeting = (value: unknown): boolean => {
    const text = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return GREETINGS.has(text);
};

const CHUNK_TEXT_FIELDS = ['text_content', 'text', 'content', 'chunk_text', 'page_content'];

const textFromChunk = (chunk: unknown): string => {
    if (typeof chunk === 'string') return chunk.trim();
    if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) return '';
    const record = chunk as Record<string, unknown>;
    for (const field of CHUNK_TEXT_FIELDS) {
        const value = record[field];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
};

/** Chunk strings from a knowledge-base retrieve payload. Unknown shapes contribute nothing. */
export const retrievedChunkTexts = (payload: unknown): string[] => {
    let rows: unknown[] = [];
    if (Array.isArray(payload)) {
        rows = payload;
    } else if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown>;
        for (const key of ['results', 'chunks', 'documents']) {
            if (Array.isArray(record[key])) {
                rows = record[key] as unknown[];
                break;
            }
        }
    }
    const texts: string[] = [];
    for (const row of rows) {
        const text = textFromChunk(row);
        if (text) texts.push(text);
    }
    return texts;
};

export const storedRoleForCaller = (user: any): StoredAskRole => {
    const role = String(user?.role || '');
    if (role === 'customer') return 'customer';
    if (role === 'expert') return 'expert';
    return 'user';
};

export const qaRolesForCaller = (user: any): string[] => {
    const roles = ['user'];
    if (user?.role === 'customer') roles.push('customer');
    if (user?.role === 'expert') roles.push('expert');
    return roles;
};

export const hasRealAnswer = (row: any, pendingAnswer: string): boolean => {
    if (row?.answer == null) return false;
    const answer = String(row.answer);
    if (!answer.trim()) return false;
    if (answer === pendingAnswer) return false;
    return true;
};

const pageNumbers = (pageText: string): Set<string> => {
    const found = new Set<string>();
    const re = /\d[\d,]*(?:\.\d+)?/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(pageText))) {
        const normalized = normalizeNumber(match[0]);
        if (normalized) found.add(normalized);
    }
    return found;
};

const pageClocks = (pageText: string): Set<string> => {
    const found = new Set<string>();
    const re = /\b\d{1,2}:\d{2}\b/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(pageText))) {
        const [hour, minute] = match[0].split(':');
        found.add(`${Number(hour)}:${minute}`);
    }
    return found;
};

const amountToken = (match: string): string => {
    const raw = match.match(/\d[\d,]*(?:\.\d+)?/);
    return raw ? normalizeNumber(raw[0]) : '';
};

const clockToken = (match: string): { kind: 'clock' | 'hour'; value: string } | null => {
    const hm = match.match(/\d{1,2}:\d{2}/);
    if (hm) {
        const [hour, minute] = hm[0].split(':');
        return { kind: 'clock', value: `${Number(hour)}:${minute}` };
    }
    const hour = match.match(/\d{1,2}/);
    if (!hour) return null;
    return { kind: 'hour', value: normalizeNumber(hour[0]) };
};

const tidyAnswer = (value: string): string =>
    value
        .replace(/\s+\b(or|and)\b\s*(?=[.,!?]|$)/gi, '')
        .replace(/\s+([,.!?;:])/g, '$1')
        .replace(/\(\s*\)/g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.!?;:])/g, '$1')
        .trim();

/** Dollar amounts and clock times stay only when that number is in the source text. Ratings and seat counts never stay in the sentence. */
export const postFilterAnswer = (answer: unknown, pageText: unknown): string => {
    const pages = String(pageText ?? '');
    const numbers = pageNumbers(pages);
    const clocks = pageClocks(pages);
    let text = String(answer ?? '');
    text = text.replace(RATING_PHRASE, '');
    text = text.replace(SEAT_PHRASE, '');
    text = text.replace(DOLLAR_AMOUNT, (match) => {
        const token = amountToken(match);
        return token && numbers.has(token) ? match : '';
    });
    text = text.replace(CLOCK_TIME, (match) => {
        const token = clockToken(match);
        if (!token) return '';
        if (token.kind === 'clock') return clocks.has(token.value) ? match : '';
        return token.value && numbers.has(token.value) ? match : '';
    });
    return tidyAnswer(text);
};

export const promptContext = (input: {
    pages?: PromptPage[];
    experts?: PromptExpert[];
    seminars?: PromptSeminar[];
    questions?: PromptQuestion[];
    retrieved?: string[];
}): string => {
    const blocks: string[] = [];
    for (const page of input.pages || []) {
        blocks.push(`Public page\ntitle: ${page.title ?? ''}\nroute: ${page.route ?? ''}\ntext: ${page.snippet ?? ''}`);
    }
    for (const text of input.retrieved || []) {
        const chunk = String(text ?? '').trim();
        if (!chunk) continue;
        blocks.push(`Retrieved site text\n${chunk}`);
    }
    for (const expert of input.experts || []) {
        blocks.push(`Public expert\nname: ${expert.name ?? ''}\ntitle: ${expert.title ?? ''}\nbio: ${expert.bio ?? ''}`);
    }
    for (const seminar of input.seminars || []) {
        blocks.push(`Public seminar\nname: ${seminar.name ?? ''}\ndescription: ${seminar.description ?? ''}`);
    }
    for (const row of input.questions || []) {
        blocks.push(`Answered question\nquestion: ${row.question ?? ''}\nanswer: ${row.answer ?? ''}`);
    }
    return blocks.join('\n\n');
};

export const selectSimilarQuestions = (rows: any[], question: unknown, limit = 4) => {
    const current = normalizeQuestion(question);
    const wanted = new Set(tokens(question).filter((token) => !STOP_WORDS.has(token)));
    return (Array.isArray(rows) ? rows : [])
        .filter((row) => row && normalizeQuestion(row.question) !== current && row._id != null)
        .map((row) => {
            const score = tokens(row.question).filter((token) => wanted.has(token)).length;
            return { row, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || String(a.row.question).localeCompare(String(b.row.question)))
        .slice(0, limit)
        .map(({ row }) => ({
            id: String(row._id),
            question: String(row.question ?? ''),
        }));
};

export const parseModelContent = (content: unknown): { answer: string; miss: boolean; citations: any[] } => {
    const raw = String(content ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    if (!raw) return { answer: '', miss: true, citations: [] };
    try {
        const parsed = JSON.parse(raw);
        const answer = typeof parsed?.answer === 'string' ? parsed.answer : '';
        return {
            answer,
            miss: Boolean(parsed?.miss) || !answer.trim(),
            citations: Array.isArray(parsed?.citations) ? parsed.citations : [],
        };
    } catch {
        if (/^(i (do not|don't) know|i cannot answer|not enough information)\b/i.test(raw)) {
            return { answer: '', miss: true, citations: [] };
        }
        return { answer: raw, miss: false, citations: [] };
    }
};

export const groundedCitations = (pages: PromptPage[], cited: any[]) => {
    const rows = (Array.isArray(pages) ? pages : [])
        .map((page) => ({
            title: String(page?.title ?? ''),
            route: String(page?.route ?? ''),
        }))
        .filter((page) => page.title && page.route);
    const out: { title: string; route: string }[] = [];
    const seen = new Set<string>();
    const push = (title: string, route: string) => {
        const key = `${route}\n${title}`;
        if (seen.has(key)) return;
        if (!rows.some((page) => page.route === route && page.title === title)) return;
        seen.add(key);
        out.push({ title, route });
    };
    for (const item of Array.isArray(cited) ? cited : []) {
        push(String(item?.title ?? ''), String(item?.route ?? ''));
    }
    if (!out.length) {
        for (const page of rows) push(page.title, page.route);
    }
    return out.slice(0, 4);
};

export const publicPageText = (pages: PromptPage[]): string =>
    (Array.isArray(pages) ? pages : [])
        .map((page) => `${page?.title ?? ''}\n${page?.snippet ?? ''}`)
        .join('\n');
