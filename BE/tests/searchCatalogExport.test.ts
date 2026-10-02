import test, { describe, mock } from 'node:test';
import assert from 'node:assert/strict';

const User = require('../models/User');
const GroupChat = require('../models/GroupChat');
const chatBotQA = require('../models/chatBotQA');
const storage = require('../services/profileImageStorage');
const searchCatalog = require('../services/searchCatalogExport');
const {
    createChatBotQA,
    updateChatBotQA,
    deleteChatBotQA,
} = require('../controllers/chatBotQA.controller');

const INDEXING_JOBS_URL = 'https://api.digitalocean.com/v2/gen-ai/indexing_jobs';
const TOKEN = 'gradient-token-test-value';
const KB = 'kb-uuid-test-value';

const LEAKS = [
    'catalog-leak-email@example.com',
    'catalog-phone-leak',
    'catalog-password-leak',
    'catalog-oauth-id-leak',
    'catalog-oauth-provider-leak',
    'catalog-gpa-leak',
    'catalog-ranking-leak',
    'catalog-resume-leak',
    'catalog-payment-pi-leak',
    'catalog-private-chat-leak',
    'catalog-meeting-chat-leak',
    'catalog-other-session-leak',
    'catalog-direct-session-leak',
    'catalog-community-leak',
    'catalog-customer-qa-leak',
    'catalog-expert-qa-leak',
    'catalog-pending-qa-leak',
    'catalog-empty-qa-leak',
    'catalog-blank-qa-leak',
    'catalog-customer-name-leak',
    'catalog-blocked-expert-leak',
    'catalog-ended-seminar-leak',
    'catalog-draft-seminar-leak',
    'Pending answer...',
    TOKEN,
    KB,
];

const future = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);
const past = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

function matchesCond(docVal: any, cond: any): boolean {
    if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
        if ('$in' in cond) return (cond.$in || []).map(String).includes(String(docVal));
        if ('$ne' in cond) return docVal !== cond.$ne;
    }
    return String(docVal ?? '') === String(cond ?? '');
}

function docMatches(doc: any, query: any): boolean {
    if (!query || typeof query !== 'object') return true;
    for (const [key, cond] of Object.entries(query)) {
        if (!matchesCond(doc[key], cond)) return false;
    }
    return true;
}

function cloneDoc(doc: any) {
    return { ...doc };
}

function catalogFixture() {
    const host = {
        _id: 'host-public',
        role: 'expert',
        status: 'active',
        username: 'Public Catalog Expert',
        title: 'Admissions Advisor',
        description: 'Helps students plan graduate applications.',
        image: 'public-expert.png',
        price: [40],
        appointmentDurations: [30, 60],
        keywords: [{ value: 'Civil Engineering' }],
        email: 'catalog-leak-email@example.com',
        phoneNumber: 'catalog-phone-leak',
        password: 'catalog-password-leak',
        oauthId: 'catalog-oauth-id-leak',
        oauthProvider: 'catalog-oauth-provider-leak',
        gpa: 'catalog-gpa-leak',
        rankingPercentile: 'catalog-ranking-leak',
        resume: 'https://example.com/resumes/catalog-resume-leak.pdf',
    };
    const blocked = {
        _id: 'host-blocked',
        role: 'expert',
        status: 'blocked',
        username: 'catalog-blocked-expert-leak',
        email: 'catalog-leak-email@example.com',
        phoneNumber: 'catalog-phone-leak',
        password: 'catalog-password-leak',
    };
    const customer = {
        _id: 'student-1',
        role: 'customer',
        status: 'active',
        username: 'catalog-customer-name-leak',
        email: 'catalog-leak-email@example.com',
        phoneNumber: 'catalog-phone-leak',
        password: 'catalog-password-leak',
        oauthId: 'catalog-oauth-id-leak',
        gpa: 'catalog-gpa-leak',
        rankingPercentile: 'catalog-ranking-leak',
        resume: 'https://example.com/resumes/catalog-resume-leak.pdf',
        degreeSought: 'catalog-customer-name-leak',
    };
    const users = [host, blocked, customer];
    const chats = [
        {
            _id: 'sem-public',
            type: 'seminar',
            status: 'active',
            name: 'Public Catalog Seminar',
            description: 'Weekly office hours for applicants.',
            admin: 'host-public',
            participants: ['host-public', 'student-1'],
            maxAttendees: 10,
            price: 25,
            start: future(24),
            end: future(25),
            image: 'https://cdn.example.com/chatFiles/public-cover.png',
            paidBy: 'catalog-payment-pi-leak',
            decisionNote: 'catalog-private-chat-leak',
            moderationNotes: [{ reason: 'catalog-meeting-chat-leak' }],
        },
        {
            _id: 'sem-ended',
            type: 'seminar',
            status: 'active',
            name: 'catalog-ended-seminar-leak',
            admin: 'host-public',
            participants: ['host-public'],
            start: past(5),
            end: past(4),
        },
        {
            _id: 'sem-draft',
            type: 'seminar',
            status: 'draft',
            name: 'catalog-draft-seminar-leak',
            admin: 'host-public',
            participants: ['host-public'],
            start: future(5),
            end: future(6),
        },
        {
            _id: 'direct-1',
            type: 'individual',
            status: 'active',
            name: 'catalog-direct-session-leak',
            description: 'catalog-private-chat-leak',
            admin: 'host-public',
            participants: ['host-public', 'student-1'],
            start: future(2),
            end: future(3),
            paidBy: 'catalog-payment-pi-leak',
        },
        {
            _id: 'direct-2',
            type: 'individual',
            status: 'active',
            name: 'catalog-other-session-leak',
            admin: 'host-blocked',
            participants: ['host-blocked', 'student-1'],
            start: future(2),
            end: future(3),
        },
        {
            _id: 'community-1',
            type: 'community',
            status: 'active',
            name: 'catalog-community-leak',
            description: 'catalog-meeting-chat-leak',
            admin: 'host-public',
            participants: ['host-public', 'student-1'],
        },
    ];
    const questions = [
        {
            role: 'user',
            question: 'How do I find a seminar?',
            answer: 'Open Seminars and pick a session.',
        },
        {
            role: 'user',
            question: 'catalog-pending-qa-leak',
            answer: 'Pending answer...',
        },
        {
            role: 'user',
            question: 'catalog-empty-qa-leak',
            answer: '',
        },
        {
            role: 'user',
            question: 'catalog-blank-qa-leak',
            answer: '   ',
        },
        {
            role: 'user',
            question: 'Missing answer leak',
            answer: undefined,
        },
        {
            role: 'customer',
            question: 'catalog-customer-qa-leak',
            answer: 'Only customers should see this.',
        },
        {
            role: 'expert',
            question: 'catalog-expert-qa-leak',
            answer: 'Only experts should see this.',
        },
    ];
    return { users, chats, questions };
}

function installStore(data: { users?: any[]; chats?: any[]; questions?: any[] }) {
    const users = data.users || [];
    const chats = data.chats || [];
    const questions = data.questions || [];
    const original = {
        userFind: User.find,
        groupFind: GroupChat.find,
        qaFind: chatBotQA.find,
    };

    User.find = (query: any) => {
        const api: any = {
            select() {
                return api;
            },
            populate() {
                return api;
            },
            lean() {
                return Promise.resolve(users.filter((row) => docMatches(row, query)).map(cloneDoc));
            },
        };
        return api;
    };

    GroupChat.find = (query: any) => {
        const paths: string[] = [];
        const api: any = {
            select() {
                return api;
            },
            populate(arg: any) {
                paths.push(typeof arg === 'string' ? arg : arg?.path);
                return api;
            },
            lean() {
                const docs = chats.filter((row) => docMatches(row, query)).map(cloneDoc);
                if (paths.includes('admin')) {
                    for (const doc of docs) {
                        if (!doc.admin || typeof doc.admin === 'object') continue;
                        const user = users.find((row) => String(row._id) === String(doc.admin));
                        if (!user) continue;
                        doc.admin = {
                            _id: user._id,
                            username: user.username,
                            image: user.image,
                            status: user.status,
                        };
                    }
                }
                return Promise.resolve(docs);
            },
        };
        return api;
    };

    chatBotQA.find = () => {
        const api: any = {
            select() {
                return api;
            },
            lean() {
                return Promise.resolve(questions.map(cloneDoc));
            },
        };
        return api;
    };

    return {
        restore() {
            User.find = original.userFind;
            GroupChat.find = original.groupFind;
            chatBotQA.find = original.qaFind;
        },
    };
}

function resCapture() {
    return {
        statusCode: 200,
        body: null as any,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(payload: any) {
            this.body = payload;
            return this;
        },
        send(payload: any) {
            this.body = payload;
            return this;
        },
    };
}

describe('search catalog export', { concurrency: false }, () => {
    const envKeys = [
        'NODE_ENV',
        'DO_SPACES_BUCKET',
        'DO_SPACES_KEY',
        'DO_SPACES_SECRET',
        'DO_SPACES_ENDPOINT',
        'GRADIENT_API_TOKEN',
        'GRADIENT_KNOWLEDGE_BASE_UUID',
        'GRADIENT_MODEL_ACCESS_KEY',
    ];
    const previousEnv: Record<string, string | undefined> = {};
    let objects: Map<string, string>;
    let puts: Array<{ key: string; body: string }>;
    let fetchCalls: Array<{ url: string; init: any }>;
    let timeoutMs: number | null;
    let restoreStore: (() => void) | null = null;
    const originalPut = storage.putSpacesObject;
    const originalGet = storage.getSpacesObjectText;

    test.beforeEach(() => {
        for (const key of envKeys) previousEnv[key] = process.env[key];
        process.env.NODE_ENV = 'staging';
        process.env.DO_SPACES_BUCKET = 'wisdomlinked-store';
        process.env.DO_SPACES_KEY = 'spaces-key';
        process.env.DO_SPACES_SECRET = 'spaces-secret';
        process.env.DO_SPACES_ENDPOINT = 'nyc3.digitaloceanspaces.com';
        process.env.GRADIENT_API_TOKEN = TOKEN;
        process.env.GRADIENT_KNOWLEDGE_BASE_UUID = KB;
        objects = new Map();
        puts = [];
        fetchCalls = [];
        timeoutMs = null;
        storage.putSpacesObject = async (key: string, body: string) => {
            puts.push({ key, body });
            objects.set(key, body);
        };
        storage.getSpacesObjectText = async (key: string) => (objects.has(key) ? objects.get(key)! : null);
        mock.method(globalThis, 'fetch', async (url: any, init: any) => {
            fetchCalls.push({ url: String(url), init });
            return new Response('{}', { status: 200 });
        });
        mock.method(AbortSignal, 'timeout', (ms: number) => {
            timeoutMs = ms;
            return AbortSignal.abort();
        });
        const installed = installStore(catalogFixture());
        restoreStore = installed.restore;
    });

    test.afterEach(() => {
        storage.putSpacesObject = originalPut;
        storage.getSpacesObjectText = originalGet;
        restoreStore?.();
        restoreStore = null;
        mock.restoreAll();
        for (const key of envKeys) {
            if (previousEnv[key] === undefined) delete process.env[key];
            else process.env[key] = previousEnv[key];
        }
    });

    test('catalog file omits private fields, other sessions, and non-public Q&A', async () => {
        await searchCatalog.rebuildSearchCatalog();
        assert.equal(puts.length, 1);
        assert.equal(puts[0].key, 'search/staging/catalog.txt');
        const body = puts[0].body;
        const blocks = body.trim().split('\n\n').filter(Boolean);
        assert.ok(blocks.length >= 1);
        for (const block of blocks) {
            assert.match(block, /^Question\n/);
            assert.equal(block.startsWith('Expert'), false);
            assert.equal(block.startsWith('Seminar'), false);
        }
        assert.equal(/^Expert$/m.test(body), false);
        assert.equal(/^Seminar$/m.test(body), false);
        assert.match(body, /How do I find a seminar\?/);
        assert.match(body, /Open Seminars and pick a session/);
        assert.equal(body.includes('public-expert.png'), false);
        assert.equal(body.includes('public-cover.png'), false);
        assert.equal(body.includes('hostImage'), false);
        assert.equal(body.includes('chatFiles'), false);
        assert.equal(body.includes('image:'), false);
        for (const leak of LEAKS) {
            assert.equal(body.includes(leak), false, leak);
        }
        const forbiddenPrefixes = ['profile/', 'resumes/', 'chatFiles/', 'originals/', 'large/', 'medium/', 'small/', 'logo/'];
        for (const prefix of forbiddenPrefixes) {
            assert.equal(puts[0].key.startsWith(prefix), false, prefix);
        }
    });

    test('skips pending, empty, and blank answers', async () => {
        await searchCatalog.rebuildSearchCatalog();
        const body = puts[0].body;
        assert.equal(body.includes('catalog-pending-qa-leak'), false);
        assert.equal(body.includes('Pending answer...'), false);
        assert.equal(body.includes('catalog-empty-qa-leak'), false);
        assert.equal(body.includes('catalog-blank-qa-leak'), false);
        assert.match(body, /Open Seminars and pick a session/);
    });

    test('does not POST indexing when the catalog body is unchanged', async () => {
        await searchCatalog.rebuildSearchCatalog();
        assert.equal(puts.length, 1);
        assert.equal(fetchCalls.length, 1);
        await searchCatalog.rebuildSearchCatalog();
        assert.equal(puts.length, 1);
        assert.equal(fetchCalls.length, 1);
    });

    test('writes the Spaces file but does not call indexing when Gradient secrets are unset', async () => {
        delete process.env.GRADIENT_API_TOKEN;
        await searchCatalog.rebuildSearchCatalog();
        assert.equal(puts.length, 1);
        assert.equal(fetchCalls.length, 0);
        assert.equal(puts[0].body.includes(TOKEN), false);
        assert.equal(puts[0].body.includes(KB), false);

        objects.clear();
        puts.length = 0;
        delete process.env.GRADIENT_KNOWLEDGE_BASE_UUID;
        process.env.GRADIENT_API_TOKEN = TOKEN;
        await searchCatalog.rebuildSearchCatalog();
        assert.equal(puts.length, 1);
        assert.equal(fetchCalls.length, 0);

        objects.clear();
        puts.length = 0;
        process.env.GRADIENT_API_TOKEN = '   ';
        process.env.GRADIENT_KNOWLEDGE_BASE_UUID = '   ';
        await searchCatalog.rebuildSearchCatalog();
        assert.equal(puts.length, 1);
        assert.equal(fetchCalls.length, 0);
    });

    test('uploads search/staging/catalog.txt or search/production/catalog.txt from NODE_ENV', async () => {
        process.env.NODE_ENV = 'staging';
        await searchCatalog.rebuildSearchCatalog();
        assert.equal(puts[0].key, 'search/staging/catalog.txt');

        process.env.NODE_ENV = 'production';
        await searchCatalog.rebuildSearchCatalog();
        assert.equal(puts[1].key, 'search/production/catalog.txt');
        assert.equal(fetchCalls.length, 2);
        assert.equal(fetchCalls[0].url, INDEXING_JOBS_URL);
        assert.equal(fetchCalls[0].init.method, 'POST');
        assert.equal(fetchCalls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
        assert.deepEqual(JSON.parse(fetchCalls[0].init.body), { knowledge_base_uuid: KB });
        assert.equal(timeoutMs, 15000);
        assert.equal(fetchCalls[0].url.includes('api.digitalocean.com'), true);
        assert.equal(String(fetchCalls[0].url).includes('/v2/gen-ai/indexing_jobs'), true);
    });

    test('admin create, update, and delete each rebuild, and delete uses findByIdAndDelete', async () => {
        restoreStore?.();
        restoreStore = null;
        const originalFindOne = chatBotQA.findOne;
        const originalFindById = chatBotQA.findById;
        const originalDelete = chatBotQA.findByIdAndDelete;
        const originalSave = chatBotQA.prototype.save;
        const originalRebuild = searchCatalog.rebuildSearchCatalog;
        let rebuilds = 0;
        let deletedWith: string | null = null;
        searchCatalog.rebuildSearchCatalog = async () => {
            rebuilds += 1;
        };
        chatBotQA.prototype.save = async function save() {
            return this;
        };

        try {
            chatBotQA.findOne = async () => ({ _id: 'existing' });
            const duplicate = resCapture();
            await createChatBotQA({ body: { question: 'Already there', answer: 'Yes', role: 'user' } }, duplicate);
            assert.equal(duplicate.statusCode, 200);
            assert.equal(rebuilds, 0);

            chatBotQA.findOne = async () => null;
            const created = resCapture();
            await createChatBotQA(
                { body: { question: 'How do I find a seminar?', answer: 'Open Seminars and pick a session.', role: 'user' } },
                created,
            );
            assert.equal(created.statusCode, 200);
            assert.equal(rebuilds, 1);

            chatBotQA.findById = async () => ({
                question: 'How do I find a seminar?',
                answer: 'Pending answer...',
                role: 'user',
                save: async function save() {
                    return this;
                },
            });
            const updated = resCapture();
            await updateChatBotQA(
                { params: { id: 'qa-1' }, body: { question: 'How do I find a seminar?', answer: 'Open Seminars and pick a session.', role: 'user' } },
                updated,
            );
            assert.equal(updated.statusCode, 200);
            assert.equal(rebuilds, 2);

            chatBotQA.findByIdAndDelete = async (id: string) => {
                deletedWith = id;
                return null;
            };
            const missing = resCapture();
            await deleteChatBotQA({ params: { id: 'missing' } }, missing);
            assert.equal(missing.statusCode, 404);
            assert.equal(rebuilds, 2);

            chatBotQA.findByIdAndDelete = async (id: string) => {
                deletedWith = id;
                return { _id: id };
            };
            const deleted = resCapture();
            await deleteChatBotQA({ params: { id: 'qa-1' } }, deleted);
            assert.equal(deleted.statusCode, 200);
            assert.equal(deletedWith, 'qa-1');
            assert.equal(rebuilds, 3);
        } finally {
            chatBotQA.findOne = originalFindOne;
            chatBotQA.findById = originalFindById;
            chatBotQA.findByIdAndDelete = originalDelete;
            chatBotQA.prototype.save = originalSave;
            searchCatalog.rebuildSearchCatalog = originalRebuild;
        }
    });
});
