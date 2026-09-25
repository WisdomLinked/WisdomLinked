const chatBotQA = require('../models/chatBotQA');
const storage = require('./profileImageStorage');

/**
 * Shared catalog for paraphrase, how, why, 怎么, 如何, 怎样, other Chinese
 * wording, and unmatched wording. Retrieve reads wisdomlinked-search-staging.
 * Do not delete that knowledge base and do not create a replacement.
 * Exact cheapest, highest, under, over, 最便宜, and 最贵 questions do not
 * sort this file. Those use live Mongo because this index cannot sort and
 * can be stale. Personal 1:1s, communities, legacy events, and seat requests
 * are not written here.
 */
const INDEXING_JOBS_URL = 'https://api.digitalocean.com/v2/gen-ai/indexing_jobs';
const PENDING_ANSWER = 'Pending answer...';

const FORBIDDEN_KEY_PARTS = new Set([
    'profile',
    'resumes',
    'chatFiles',
    'originals',
    'large',
    'medium',
    'small',
    'logo',
]);

const searchCatalogObjectKey = (): string | null => {
    const envName = String(process.env.NODE_ENV || '').trim();
    if (!envName || /[\\/]/.test(envName)) return null;
    const key = `search/${envName}/catalog.txt`;
    if (key.split('/').some((part) => FORBIDDEN_KEY_PARTS.has(part))) return null;
    return key;
};

const isAnsweredPublicQuestion = (row: any): boolean => {
    if (String(row?.role ?? '') !== 'user') return false;
    if (row?.answer == null) return false;
    const answer = String(row.answer);
    if (answer.trim() === '') return false;
    if (answer === PENDING_ANSWER) return false;
    return true;
};

const renderValue = (value: unknown): string => {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
};

const renderRecord = (label: string, source: any, fields: string[]): string => {
    const lines = [label];
    for (const field of fields) {
        const value = source?.[field];
        if (value == null || value === '') continue;
        lines.push(`${field}: ${renderValue(value)}`);
    }
    return lines.join('\n');
};

const buildCatalogText = async (): Promise<string> => {
    const questions = await chatBotQA.find({ role: 'user' }).select('question answer role').lean();

    const records: string[] = [];
    const answered = (Array.isArray(questions) ? questions : [])
        .filter(isAnsweredPublicQuestion)
        .map((row: any) => ({
            question: String(row.question ?? '').trim(),
            answer: String(row.answer),
        }))
        .sort((a: { question: string; answer: string }, b: { question: string; answer: string }) =>
            a.question.localeCompare(b.question) || a.answer.localeCompare(b.answer));

    for (const row of answered) {
        records.push(renderRecord('Question', row, ['question', 'answer']));
    }

    return records.length ? `${records.join('\n\n')}\n` : '';
};

const gradientIndexingConfigured = (): { token: string; knowledgeBaseUuid: string } | null => {
    const token = String(process.env.GRADIENT_API_TOKEN || '').trim();
    const knowledgeBaseUuid = String(process.env.GRADIENT_KNOWLEDGE_BASE_UUID || '').trim();
    if (!token || !knowledgeBaseUuid) return null;
    return { token, knowledgeBaseUuid };
};

const requestCatalogIndexing = async (): Promise<void> => {
    const secrets = gradientIndexingConfigured();
    if (!secrets) return;

    const response = await fetch(INDEXING_JOBS_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${secrets.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ knowledge_base_uuid: secrets.knowledgeBaseUuid }),
        signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
        console.error(`[search-catalog] indexing job failed with status ${response.status}`);
    }
};

const rebuildSearchCatalog = async (): Promise<void> => {
    try {
        const key = searchCatalogObjectKey();
        if (!key) return;
        if (!storage.isProfileImageStorageConfigured()) return;

        const body = await buildCatalogText();
        const existing = await storage.getSpacesObjectText(key);
        if (existing === body) return;

        await storage.putSpacesObject(key, body, 'text/plain; charset=utf-8');
        await requestCatalogIndexing();
    } catch (err) {
        console.error('[search-catalog] rebuild failed');
    }
};

module.exports = {
    rebuildSearchCatalog,
    searchCatalogObjectKey,
    INDEXING_JOBS_URL,
};
