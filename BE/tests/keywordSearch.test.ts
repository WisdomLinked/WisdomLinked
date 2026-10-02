import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeBookingPriceCents } from '../utils/bookingPrice';

const User = require('../models/User');
const GroupChat = require('../models/GroupChat');
const Keyword = require('../models/Keyword');
const Service = require('../models/Service');
const { search } = require('../controllers/search.controller');

const FORBIDDEN_KEY = /email|phone|password|oauth|gpa|ranking|resume|stripe|payment|paidby/i;

const EXPERT_KEYS = ['id', 'name', 'title', 'bio', 'image', 'bookable', 'hourlyRate', 'sessionPrices'];
const SEMINAR_KEYS = ['id', 'name', 'description', 'price', 'full', 'seats', 'image', 'hostImage'];
const STUDENT_KEYS = ['id', 'name', 'image', 'degreeSought', 'currentUniversity', 'intendedIntake'];
const YOURS_KEYS = ['id', 'name', 'start', 'end', 'student', 'expert'];
const PERSON_KEYS = ['id', 'name', 'image'];

function makeRes() {
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

function assertKeys(obj: any, allowed: string[]) {
    for (const key of Object.keys(obj)) {
        assert.ok(allowed.includes(key), `unexpected key ${key}`);
    }
}

function assertPrivate(value: any) {
    const walk = (node: any) => {
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        if (node && typeof node === 'object') {
            for (const key of Object.keys(node)) {
                assert.equal(FORBIDDEN_KEY.test(key), false, `forbidden key ${key}`);
                walk(node[key]);
            }
        }
    };
    walk(value);
}

function matchesCond(docVal: any, cond: any): boolean {
    if (
        cond &&
        typeof cond === 'object' &&
        !Array.isArray(cond) &&
        !(cond instanceof Date) &&
        !(cond instanceof RegExp)
    ) {
        if ('$regex' in cond) {
            const re = new RegExp(cond.$regex, cond.$options || '');
            if (Array.isArray(docVal)) return docVal.some((v) => re.test(String(v ?? '')));
            return re.test(String(docVal ?? ''));
        }
        if ('$in' in cond) {
            const list = (cond.$in || []).map((v: any) => String(v));
            if (Array.isArray(docVal)) {
                return docVal.some((v) => list.includes(String(v?._id ?? v)));
            }
            return list.includes(String(docVal?._id ?? docVal));
        }
        if ('$ne' in cond) return docVal !== cond.$ne;
        if ('$gt' in cond) {
            const left = new Date(docVal).getTime();
            const right = new Date(cond.$gt).getTime();
            return Number.isFinite(left) && Number.isFinite(right) && left > right;
        }
        return false;
    }
    if (Array.isArray(docVal)) {
        return docVal.some((v) => String(v?._id ?? v) === String(cond));
    }
    return String(docVal ?? '') === String(cond ?? '');
}

function docMatches(doc: any, query: any): boolean {
    if (!query || typeof query !== 'object') return true;
    for (const [key, cond] of Object.entries(query)) {
        if (key === '$or') {
            if (!(cond as any[]).some((clause) => docMatches(doc, clause))) return false;
            continue;
        }
        if (key === '$and') {
            if (!(cond as any[]).every((clause) => docMatches(doc, clause))) return false;
            continue;
        }
        if (!matchesCond(doc[key], cond)) return false;
    }
    return true;
}

function cloneDoc(doc: any) {
    const copy = { ...doc };
    for (const key of ['participants', 'followers', 'keywords', 'services', 'customKeywords']) {
        if (Array.isArray(doc[key])) copy[key] = [...doc[key]];
    }
    return copy;
}

function installStore(data: {
    users?: any[];
    chats?: any[];
    keywords?: any[];
    services?: any[];
}) {
    const users = data.users || [];
    const chats = data.chats || [];
    const keywords = data.keywords || [];
    const services = data.services || [];
    const calls = {
        userFind: 0,
        userFindById: 0,
        groupFind: 0,
        keywordFind: 0,
        keywordCreate: 0,
        serviceFind: 0,
        userQueries: [] as any[],
        groupQueries: [] as any[],
    };

    const original = {
        userFind: User.find,
        userFindById: User.findById,
        groupFind: GroupChat.find,
        keywordFind: Keyword.find,
        keywordCreate: Keyword.create,
        serviceFind: Service.find,
    };

    const applyPopulate = (doc: any, path: string) => {
        if (path === 'admin' && doc.admin && typeof doc.admin !== 'object') {
            const user = users.find((row) => String(row._id) === String(doc.admin));
            if (user) {
                doc.admin = {
                    _id: user._id,
                    username: user.username,
                    image: user.image,
                    status: user.status,
                    role: user.role,
                };
            }
        }
        if (path === 'participants' && Array.isArray(doc.participants)) {
            doc.participants = doc.participants.map((participant: any) => {
                if (participant && typeof participant === 'object') return participant;
                const user = users.find((row) => String(row._id) === String(participant));
                if (!user) return participant;
                return {
                    _id: user._id,
                    username: user.username,
                    image: user.image,
                    status: user.status,
                    role: user.role,
                };
            });
        }
    };

    const chain = (getDocs: () => any[]) => {
        const paths: string[] = [];
        let limitN: number | null = null;
        const api: any = {
            select() {
                return api;
            },
            sort() {
                return api;
            },
            populate(arg: any) {
                paths.push(typeof arg === 'string' ? arg : arg?.path);
                return api;
            },
            limit(n: number) {
                limitN = n;
                return api;
            },
            lean() {
                let docs = getDocs().map(cloneDoc);
                for (const path of paths) {
                    if (!path) continue;
                    for (const doc of docs) applyPopulate(doc, path);
                }
                if (limitN != null) docs = docs.slice(0, limitN);
                return Promise.resolve(docs);
            },
        };
        return api;
    };

    User.find = (query: any) => {
        calls.userFind += 1;
        calls.userQueries.push(query);
        return chain(() => users.filter((row) => docMatches(row, query)));
    };
    User.findById = (id: any) => {
        calls.userFindById += 1;
        const found = users.find((row) => String(row._id) === String(id)) || null;
        const api: any = {
            select() {
                return api;
            },
            lean: async () => (found ? cloneDoc(found) : null),
        };
        return api;
    };
    GroupChat.find = (query: any) => {
        calls.groupFind += 1;
        calls.groupQueries.push(query);
        return chain(() => chats.filter((row) => docMatches(row, query)));
    };
    Keyword.find = (query: any) => {
        calls.keywordFind += 1;
        return chain(() => keywords.filter((row) => docMatches(row, query)));
    };
    Keyword.create = async () => {
        calls.keywordCreate += 1;
        throw new Error('Keyword.create must not be called');
    };
    Service.find = (query: any) => {
        calls.serviceFind += 1;
        return chain(() => services.filter((row) => docMatches(row, query)));
    };

    return {
        calls,
        restore() {
            User.find = original.userFind;
            User.findById = original.userFindById;
            GroupChat.find = original.groupFind;
            Keyword.find = original.keywordFind;
            Keyword.create = original.keywordCreate;
            Service.find = original.serviceFind;
        },
    };
}

function assertShape(body: any) {
    for (const key of ['experts', 'seminars', 'students', 'yours', 'pages']) {
        assert.ok(Array.isArray(body[key]), key);
        assert.ok(body[key].length <= 5, key);
    }
    for (const page of body.pages) {
        assertKeys(page, ['title', 'snippet', 'route']);
        assert.equal(typeof page.title, 'string');
        assert.equal(page.title.length > 0, true);
        assert.equal(typeof page.snippet, 'string');
        assert.equal(['/', '/aboutus', '/services', '/rules', '/contactus', '/resources', '/resources/graduate-school-guide', '/resources/scholarship-guide'].includes(page.route), true);
    }
    for (const expert of body.experts) {
        assertKeys(expert, EXPERT_KEYS);
        assert.equal(expert.bookable, true);
        if (expert.sessionPrices) {
            for (const row of expert.sessionPrices) assertKeys(row, ['minutes', 'dollars']);
        }
    }
    for (const seminar of body.seminars) assertKeys(seminar, SEMINAR_KEYS);
    for (const student of body.students) assertKeys(student, STUDENT_KEYS);
    for (const row of body.yours) {
        assertKeys(row, YOURS_KEYS);
        assertKeys(row.student, PERSON_KEYS);
        assertKeys(row.expert, PERSON_KEYS);
    }
    assertPrivate(body);
}

async function runSearch(store: Parameters<typeof installStore>[0], q: string, user?: any) {
    const installed = installStore(store);
    try {
        const res = makeRes();
        await search({ query: { q }, user }, res);
        assert.equal(res.statusCode, 200);
        assertShape(res.body);
        return { body: res.body, calls: installed.calls };
    } finally {
        installed.restore();
    }
}

function expert(partial: any) {
    return {
        role: 'expert',
        status: 'active',
        username: 'Expert',
        title: '',
        description: '',
        email: 'leak-email@example.com',
        phoneNumber: '555-0199',
        password: 'hunter2-secret',
        oauthId: 'oauth-leak-id',
        gpa: '3.99-leak',
        rankingPercentile: '99-leak',
        resume: 'https://example.com/resumes/leak.pdf',
        ...partial,
    };
}

function customer(partial: any) {
    return {
        role: 'customer',
        status: 'active',
        isAdHocCustomer: false,
        username: 'Student',
        email: 'leak-email@example.com',
        phoneNumber: '555-0199',
        password: 'hunter2-secret',
        oauthId: 'oauth-leak-id',
        gpa: '3.99-leak',
        rankingPercentile: '99-leak',
        resume: 'https://example.com/resumes/leak.pdf',
        ...partial,
    };
}

const future = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);
const past = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

describe('GET /api/search', { concurrency: false }, () => {
    test('returns 200 with no token and does not 401 on a bad token', async () => {
        const express = require('express');
        const request = require('supertest');
        const app = express();
        app.use('/api/search', require('../routes/searchRoutes'));

        const anonymous = await request(app).get('/api/search').query({ q: '' });
        assert.equal(anonymous.status, 200);
        assert.deepEqual(anonymous.body, {
            experts: [],
            seminars: [],
            students: [],
            yours: [],
            pages: [],
        });

        const invalid = await request(app)
            .get('/api/search')
            .set('Authorization', 'Bearer not-a-real-token')
            .query({ q: ' ' });
        assert.equal(invalid.status, 200);
        assert.deepEqual(invalid.body.students, []);
        assert.deepEqual(invalid.body.yours, []);
        assert.deepEqual(invalid.body.pages, []);
    });

    test('optionalAuth attaches a valid session and continues when the cookie is missing or unusable', async () => {
        const jwt = require('jsonwebtoken');
        const { optionalAuth } = require('../middlewares/requireAuth');
        const previousSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = 'search-optional-auth-test';
        const originalFindOne = User.findOne;
        let findOneCalls = 0;

        const userToken = jwt.sign({ email: 'expert@example.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const accessToken = jwt.sign({ email: 'expert@example.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const sessionUser = {
            _id: 'e1',
            email: 'expert@example.com',
            role: 'expert',
            status: 'active',
            token: userToken,
            _doc: {
                email: 'expert@example.com',
                role: 'expert',
                status: 'active',
                password: 'hunter2-secret',
                token: userToken,
            },
            generateAuthToken: async () => 'rotated-token',
        };

        User.findOne = () => ({
            select: async () => {
                findOneCalls += 1;
                return sessionUser;
            },
        });

        const run = async (req: any) => {
            let statusCode: number | null = null;
            let nextCalls = 0;
            const res: any = {
                cookie() {
                    return res;
                },
                status(code: number) {
                    statusCode = code;
                    return res;
                },
                send() {
                    return res;
                },
            };
            await optionalAuth(req, res, () => {
                nextCalls += 1;
            });
            return { statusCode, nextCalls, user: req.user };
        };

        try {
            const missing = await run({ headers: {}, cookies: {} });
            assert.equal(missing.nextCalls, 1);
            assert.equal(missing.statusCode, null);
            assert.equal(missing.user, undefined);
            assert.equal(findOneCalls, 0);

            const invalid = await run({
                headers: { authorization: 'Bearer not-a-real-token' },
                cookies: {},
            });
            assert.equal(invalid.nextCalls, 1);
            assert.equal(invalid.statusCode, null);
            assert.equal(invalid.user, undefined);

            const valid = await run({
                headers: { authorization: `Bearer ${accessToken}` },
                cookies: {},
            });
            assert.equal(valid.nextCalls, 1);
            assert.equal(valid.statusCode, null);
            assert.equal(valid.user.role, 'expert');
            assert.equal(valid.user.userId, 'e1');
            assert.equal(valid.user.password, null);
            assert.equal(valid.user.token, null);

            sessionUser.status = 'blocked';
            const blocked = await run({
                headers: { authorization: `Bearer ${accessToken}` },
                cookies: {},
            });
            assert.equal(blocked.nextCalls, 1);
            assert.equal(blocked.statusCode, null);
            assert.equal(blocked.user, undefined);
        } finally {
            User.findOne = originalFindOne;
            if (previousSecret === undefined) delete process.env.JWT_SECRET;
            else process.env.JWT_SECRET = previousSecret;
        }
    });

    test('a trimmed query shorter than 2 returns empty groups and does not query User or GroupChat', async () => {
        for (const q of ['', ' ', 'a', '  x  ', '.']) {
            const { body, calls } = await runSearch({}, q);
            assert.deepEqual(body.experts, []);
            assert.deepEqual(body.seminars, []);
            assert.deepEqual(body.students, []);
            assert.deepEqual(body.yours, []);
            assert.deepEqual(body.pages, []);
            assert.equal(calls.userFind, 0);
            assert.equal(calls.userFindById, 0);
            assert.equal(calls.groupFind, 0);
            assert.equal(calls.keywordFind, 0);
            assert.equal(calls.keywordCreate, 0);
        }
    });

    test('q is a literal regex so a. does not match ab', async () => {
        const store = {
            users: [
                expert({ _id: 'ab', username: 'ab' }),
                expert({ _id: 'dotted', username: 'a.b' }),
                expert({ _id: 'via-keyword', username: 'other', keywords: ['kw-ab'] }),
            ],
            keywords: [{ _id: 'kw-ab', value: 'ab' }],
        };
        const { body, calls } = await runSearch(store, 'a.');
        assert.deepEqual(body.experts.map((row: any) => row.id), ['dotted']);
        assert.equal(body.experts[0].name, 'a.b');
        assert.equal(calls.keywordCreate, 0);
        const pattern = calls.userQueries[0].$or[0].username.$regex;
        assert.equal(pattern, 'a\\.');
    });

    test('price matrix keeps finite rates, array price[0], and 30/60/90 when durations are empty or invalid', async () => {
        const cases = [
            {
                label: 'missing',
                price: undefined,
                appointmentDurations: [30, 60, 90],
                expectRate: false,
            },
            {
                label: 'NaN',
                price: Number.NaN,
                appointmentDurations: [30, 60, 90],
                expectRate: false,
            },
            {
                label: 'NaN array',
                price: [Number.NaN],
                appointmentDurations: [30],
                expectRate: false,
            },
            {
                label: 'zero',
                price: [0],
                appointmentDurations: [],
                expectRate: true,
                hourlyRate: 0,
                minutes: [30, 60, 90],
            },
            {
                label: 'split',
                price: [120],
                appointmentDurations: [30, 60, 90],
                expectRate: true,
                hourlyRate: 120,
                minutes: [30, 60, 90],
            },
            {
                label: 'invalid durations',
                price: 60,
                appointmentDurations: [15, 45],
                expectRate: true,
                hourlyRate: 60,
                minutes: [30, 60, 90],
            },
        ];

        for (const row of cases) {
            const user: any = expert({
                _id: 'p1',
                username: 'PriceCase',
                appointmentDurations: row.appointmentDurations,
            });
            if (row.price !== undefined) user.price = row.price;
            const { body } = await runSearch({ users: [user] }, 'PriceCase');
            assert.equal(body.experts.length, 1, row.label);
            const card = body.experts[0];
            if (!row.expectRate) {
                assert.equal(Object.hasOwn(card, 'hourlyRate'), false, row.label);
                assert.equal(Object.hasOwn(card, 'sessionPrices'), false, row.label);
                continue;
            }
            assert.equal(card.hourlyRate, row.hourlyRate, row.label);
            assert.deepEqual(
                card.sessionPrices.map((price: any) => price.minutes),
                row.minutes,
                row.label,
            );
            assert.deepEqual(
                card.sessionPrices.map((price: any) => price.dollars),
                row.minutes!.map((minutes) => computeBookingPriceCents(minutes, row.hourlyRate!) / 100),
                row.label,
            );
        }
    });

    test('only active experts are returned, bookable is true, and six name matches cap at five', async () => {
        const users = [
            expert({ _id: 'pending', username: 'CapExpert Pending', status: 'pending' }),
            expert({ _id: 'blocked', username: 'CapExpert Blocked', status: 'blocked' }),
            expert({ _id: 'inactive', username: 'CapExpert Inactive', status: 'inactive' }),
            expert({ _id: 'review', username: 'CapExpert Review', status: 'review' }),
            ...[1, 2, 3, 4, 5, 6].map((n) => expert({ _id: `active-${n}`, username: `CapExpert ${n}` })),
        ];
        const { body } = await runSearch({ users }, 'CapExpert');
        assert.equal(body.experts.length, 5);
        assert.deepEqual(
            body.experts.map((row: any) => row.id),
            ['active-1', 'active-2', 'active-3', 'active-4', 'active-5'],
        );
        assert.ok(body.experts.every((row: any) => row.bookable === true));
    });

    test('experts match name, title, bio, keywords, custom keywords, and canonical service labels', async () => {
        const host = expert({
            _id: 'bio',
            username: 'Ada Mentor',
            title: 'Provost of Testing',
            description: '<p>Cellist &amp; teacher</p>',
            customKeywords: ['violin'],
            keywords: ['kw-q'],
            services: ['svc-study'],
            image: 'https://cdn.example.com/avatars/ada.png',
        });
        const legacy = expert({
            _id: 'legacy',
            username: 'No Label In Name',
            services: ['svc-work'],
        });
        const research = expert({
            _id: 'research',
            username: 'Research Only',
            services: ['svc-research'],
        });
        const store = {
            users: [host, legacy, research],
            keywords: [{ _id: 'kw-q', value: 'Quantum Optics' }],
            services: [
                { _id: 'svc-study', value: 'study_abroad', label: 'Study Abroad' },
                { _id: 'svc-work', value: 'Overseas work consultation', label: 'Overseas work consultation' },
                { _id: 'svc-research', value: 'research_guidance', label: 'Research Guidance' },
            ],
        };

        const byTitle = await runSearch(store, 'Provost');
        assert.deepEqual(byTitle.body.experts.map((row: any) => row.id), ['bio']);

        const byBio = await runSearch(store, 'Cellist');
        assert.equal(byBio.body.experts.length, 1);
        assert.equal(byBio.body.experts[0].bio, 'Cellist & teacher');
        assert.equal(byBio.body.experts[0].image, 'ada.png');
        assert.equal(JSON.stringify(byBio.body).includes('https://cdn.example.com'), false);

        const byCustom = await runSearch(store, 'violin');
        assert.deepEqual(byCustom.body.experts.map((row: any) => row.id), ['bio']);

        const byKeyword = await runSearch(store, 'Quantum');
        assert.deepEqual(byKeyword.body.experts.map((row: any) => row.id), ['bio']);
        assert.equal(byKeyword.calls.keywordCreate, 0);

        const byLabel = await runSearch(store, 'Study Abroad');
        assert.deepEqual(byLabel.body.experts.map((row: any) => row.id), ['bio']);

        const bySlug = await runSearch(store, 'study_abroad');
        assert.deepEqual(bySlug.body.experts.map((row: any) => row.id), ['bio']);

        const byLegacy = await runSearch(store, 'Work Abroad');
        assert.deepEqual(byLegacy.body.experts.map((row: any) => row.id), ['legacy']);
    });

    test('seminars keep one card per series, in-progress and pending rows, and a flat price', async () => {
        const host = expert({
            _id: 'host-1',
            username: 'Host Active',
            image: 'https://cdn.example.com/people/host.png',
        });
        const inactiveHost = expert({
            _id: 'host-bad',
            username: 'Host Blocked',
            status: 'blocked',
        });
        const cover = 'https://wisdomlinked-store.nyc3.digitaloceanspaces.com/chatFiles/123_cover.png';
        const chats = [
            {
                _id: 'occ-early',
                seriesId: 'series-full',
                type: 'seminar',
                status: 'active',
                name: 'SemSearch Full Series',
                description: '<p>Seats &amp; more</p>',
                admin: 'host-1',
                participants: ['host-1', 'stu-1'],
                maxAttendees: 10,
                price: 25,
                start: future(24),
                end: future(25),
                image: 'just-a-file.png',
                paidBy: 'card',
                paymentIntent: 'pi_leak_secret',
            },
            {
                _id: 'occ-later',
                seriesId: 'series-full',
                type: 'seminar',
                status: 'active',
                name: 'SemSearch Full Series',
                description: '<p>Seats &amp; more</p>',
                admin: 'host-1',
                participants: ['host-1', 'stu-1'],
                maxAttendees: 1,
                price: 25,
                start: future(48),
                end: future(49),
            },
            {
                _id: 'live-now',
                type: 'seminar',
                status: 'active',
                name: 'SemSearch Live Now',
                description: 'Happening',
                admin: 'host-1',
                participants: ['host-1'],
                start: past(0.01),
                end: future(0.01),
                image: 'http://insecure.example/chatFiles/nope.png',
            },
            {
                _id: 'pending-cover',
                type: 'seminar',
                status: 'pending',
                name: 'SemSearch Pending Cover',
                description: 'Soon',
                admin: 'host-1',
                participants: ['host-1', 'stu-1'],
                maxAttendees: 5,
                start: future(10),
                end: future(11),
                image: cover,
            },
            {
                _id: 'ended-1',
                type: 'seminar',
                status: 'active',
                name: 'SemSearch Ended',
                admin: 'host-1',
                participants: ['host-1'],
                start: past(3),
                end: past(2),
                price: 80,
            },
            {
                _id: 'ended-2',
                seriesId: 'ended-1',
                type: 'seminar',
                status: 'active',
                name: 'SemSearch Ended',
                admin: 'host-1',
                participants: ['host-1'],
                start: past(5),
                end: past(4),
            },
            {
                _id: 'draft-1',
                type: 'seminar',
                status: 'draft',
                name: 'SemSearch Draft',
                admin: 'host-1',
                participants: ['host-1'],
                start: future(5),
                end: future(6),
            },
            {
                _id: 'cancelled-1',
                type: 'seminar',
                status: 'cancelled',
                name: 'SemSearch Cancelled',
                admin: 'host-1',
                participants: ['host-1'],
                start: future(5),
                end: future(6),
            },
            {
                _id: 'inactive-host',
                type: 'seminar',
                status: 'active',
                name: 'SemSearch Inactive Host',
                admin: 'host-bad',
                participants: ['host-bad'],
                start: future(5),
                end: future(6),
                price: 40,
            },
        ];

        const { body } = await runSearch({ users: [host, inactiveHost], chats }, 'SemSearch');
        assert.deepEqual(
            body.seminars.map((row: any) => row.id),
            ['series-full', 'live-now', 'pending-cover'],
        );

        const series = body.seminars[0];
        assert.equal(series.name, 'SemSearch Full Series');
        assert.equal(series.description, 'Seats & more');
        assert.equal(series.price, 25);
        assert.equal(series.full, true);
        assert.equal(series.seats, '1 of 10 seats filled · 9 left');
        assert.equal(series.hostImage, 'host.png');
        assert.equal(Object.hasOwn(series, 'image'), false);

        const live = body.seminars[1];
        assert.equal(live.price, 0);
        assert.equal(live.full, false);
        assert.equal(live.seats, '0 enrolled · no limit');
        assert.equal(Object.hasOwn(live, 'image'), false);
        assert.equal(JSON.stringify(body).includes('insecure.example'), false);
        assert.equal(JSON.stringify(body).includes('pi_leak_secret'), false);

        const pending = body.seminars[2];
        assert.equal(pending.image, cover);
        assert.equal(pending.price, 0);
    });

    test('each of seminars, students, and yours is capped at five', async () => {
        const host = expert({ _id: 'e1', username: 'Cap Host', followers: ['s1', 's2', 's3', 's4', 's5', 's6'] });
        const pupil = customer({ _id: 'pupil', username: 'Pupil' });
        const students = [1, 2, 3, 4, 5, 6].map((n) => customer({ _id: `s${n}`, username: `CapStu ${n}` }));
        const chats = [
            ...[1, 2, 3, 4, 5, 6].map((n) => ({
                _id: `sem-${n}`,
                type: 'seminar',
                status: 'active',
                name: `SemCap ${n}`,
                admin: 'e1',
                participants: ['e1'],
                start: future(n),
                end: future(n + 1),
            })),
            ...[1, 2, 3, 4, 5, 6].map((n) => ({
                _id: `yours-${n}`,
                type: 'individual',
                status: 'active',
                name: `YoursCap ${n}`,
                admin: 'e1',
                participants: ['e1', 'pupil'],
                start: future(n),
                end: future(n + 1),
            })),
        ];
        const seminars = await runSearch({ users: [host], chats }, 'SemCap');
        assert.equal(seminars.body.seminars.length, 5);

        const studentHits = await runSearch(
            { users: [host, ...students] },
            'CapStu',
            { role: 'expert', userId: 'e1' },
        );
        assert.equal(studentHits.body.students.length, 5);

        const yours = await runSearch(
            { users: [host, pupil], chats },
            'YoursCap',
            { role: 'expert', userId: 'e1' },
        );
        assert.equal(yours.body.yours.length, 5);
        assert.equal(yours.body.seminars.length, 0);
    });

    test('students and yours follow role and relationship rules', async () => {
        const expertUser = expert({
            _id: 'e1',
            username: 'Expert One',
            followers: ['fiona', 'adhoc', 'blocked'],
        });
        const otherExpert = expert({ _id: 'e2', username: 'Expert Two' });
        const fiona = customer({
            _id: 'fiona',
            username: 'StuRel Fiona',
            image: 'fiona.png',
            degreeSought: 'PhD',
            currentUniversity: 'TAMU',
            intendedIntake: 'Fall 2027',
        });
        const adhoc = customer({ _id: 'adhoc', username: 'StuRel Adhoc', isAdHocCustomer: true });
        const blocked = customer({ _id: 'blocked', username: 'StuRel Blocked', status: 'blocked' });
        const paul = customer({ _id: 'paul', username: 'StuRel Paul' });
        const sara = customer({ _id: 'sara', username: 'StuRel Sara' });
        const cora = customer({ _id: 'cora', username: 'StuRel Cora' });
        const rejected = customer({ _id: 'rejected', username: 'StuRel Rejected' });
        const otherStudent = customer({ _id: 'other', username: 'StuRel Other' });
        const users = [expertUser, otherExpert, fiona, adhoc, blocked, paul, sara, cora, rejected, otherStudent];
        const chats = [
            {
                _id: 'ind-1',
                type: 'individual',
                status: 'active',
                name: 'StuRel Session',
                admin: 'e1',
                participants: ['e1', 'paul'],
                start: past(0.2),
                end: future(1),
                price: 99,
                paymentIntent: 'pi_leak_secret',
                paidBy: 'card',
            },
            {
                _id: 'sem-1',
                type: 'seminar',
                status: 'active',
                name: 'StuRel Seminar',
                admin: 'e1',
                participants: ['e1', 'sara'],
                start: future(4),
                end: future(5),
            },
            {
                _id: 'community-1',
                type: 'community',
                status: 'active',
                name: 'StuRel Community',
                admin: 'e1',
                participants: ['e1', 'cora'],
                start: future(4),
                end: future(5),
            },
            {
                _id: 'ind-other',
                type: 'individual',
                status: 'active',
                name: 'StuRel Other Session',
                admin: 'e2',
                participants: ['e2', 'other'],
                start: future(2),
                end: future(3),
            },
            {
                _id: 'ind-past',
                type: 'individual',
                status: 'active',
                name: 'StuRel Session Past',
                admin: 'e1',
                participants: ['e1', 'paul'],
                start: past(5),
                end: past(4),
            },
            {
                _id: 'ind-draft',
                type: 'individual',
                status: 'draft',
                name: 'StuRel Session Draft',
                admin: 'e1',
                participants: ['e1', 'paul'],
                start: future(2),
                end: future(3),
            },
            {
                _id: 'ind-cancelled',
                type: 'individual',
                status: 'cancelled',
                name: 'StuRel Session Cancelled',
                admin: 'e1',
                participants: ['e1', 'paul'],
                start: future(2),
                end: future(3),
            },
        ];
        const store = { users, chats };

        const asExpert = await runSearch(store, 'StuRel', { role: 'expert', userId: 'e1' });
        assert.deepEqual(
            asExpert.body.students.map((row: any) => row.id).sort(),
            ['fiona', 'paul', 'sara'],
        );
        const fionaCard = asExpert.body.students.find((row: any) => row.id === 'fiona');
        assert.deepEqual(fionaCard, {
            id: 'fiona',
            name: 'StuRel Fiona',
            image: 'fiona.png',
            degreeSought: 'PhD',
            currentUniversity: 'TAMU',
            intendedIntake: 'Fall 2027',
        });
        assert.equal(asExpert.body.yours.length, 1);
        assert.equal(asExpert.body.yours[0].id, 'ind-1');
        assert.equal(asExpert.body.yours[0].student.id, 'paul');
        assert.equal(asExpert.body.yours[0].expert.id, 'e1');
        assert.equal(asExpert.body.seminars.map((row: any) => row.id).includes('sem-1'), true);
        assert.equal(asExpert.body.yours.some((row: any) => row.id === 'sem-1'), false);
        assert.equal(JSON.stringify(asExpert.body).includes('pi_leak_secret'), false);
        assert.equal(JSON.stringify(asExpert.body).includes('leak-email@example.com'), false);

        const asOther = await runSearch(store, 'StuRel', { role: 'expert', userId: 'e2' });
        assert.deepEqual(asOther.body.students.map((row: any) => row.id), ['other']);
        assert.deepEqual(asOther.body.yours.map((row: any) => row.id), ['ind-other']);
        assert.equal(asOther.body.yours[0].student.id, 'other');
        assert.equal(asOther.body.yours[0].expert.id, 'e2');

        const asPaul = await runSearch(store, 'StuRel', { role: 'customer', userId: 'paul' });
        assert.deepEqual(asPaul.body.students, []);
        assert.deepEqual(asPaul.body.yours.map((row: any) => row.id), ['ind-1']);
        assert.equal(asPaul.body.yours[0].student.id, 'paul');
        assert.equal(asPaul.body.yours[0].expert.id, 'e1');
        assert.equal(asPaul.calls.userQueries.some((query) => query.role === 'customer'), false);

        const asStranger = await runSearch(store, 'StuRel', { role: 'customer', userId: 'stranger' });
        assert.deepEqual(asStranger.body.students, []);
        assert.deepEqual(asStranger.body.yours, []);

        const asAdmin = await runSearch(store, 'StuRel', { role: 'admin', userId: 'e1' });
        assert.deepEqual(asAdmin.body.students, []);
        assert.deepEqual(asAdmin.body.yours, []);
        assert.equal(asAdmin.calls.groupQueries.some((query) => query.type === 'individual'), false);

        const asAnonymous = await runSearch(store, 'StuRel');
        assert.deepEqual(asAnonymous.body.students, []);
        assert.deepEqual(asAnonymous.body.yours, []);
        assert.deepEqual(asAnonymous.body.pages, []);
        assert.equal(asAnonymous.calls.userFindById, 0);
        assert.equal(asAnonymous.calls.groupQueries.some((query) => query.type === 'individual'), false);
        assert.equal(asAnonymous.calls.userQueries.some((query) => query.role === 'customer'), false);
    });

    test('stringifying the body walks no private keys or secret values', async () => {
        const host = expert({
            _id: 'e1',
            username: 'PrivacyNeedle Expert',
            followers: ['stu'],
            image: 'https://cdn.example.com/avatars/expert.png',
            description: 'Privacy bio',
            price: [30],
            stripeCustomerId: 'cus_leak_secret',
        });
        const student = customer({
            _id: 'stu',
            username: 'PrivacyNeedle Student',
            degreeSought: 'MS',
            currentUniversity: 'TAMU',
            intendedIntake: '2027',
        });
        const chats = [
            {
                _id: 'sem',
                type: 'seminar',
                status: 'active',
                name: 'PrivacyNeedle Seminar',
                description: 'Open seminar',
                admin: 'e1',
                participants: ['e1', 'stu'],
                start: future(3),
                end: future(4),
                price: 12,
                paymentMode: 'card',
                paymentIntent: 'pi_leak_secret',
                stripeCustomerId: 'cus_leak_secret',
            },
            {
                _id: 'ind',
                type: 'individual',
                status: 'active',
                name: 'PrivacyNeedle Session',
                admin: 'e1',
                participants: ['e1', 'stu'],
                start: future(1),
                end: future(2),
                paymentIntent: 'pi_leak_secret',
                paidBy: 'card',
            },
        ];
        const { body } = await runSearch(
            { users: [host, student], chats },
            'PrivacyNeedle',
            { role: 'expert', userId: 'e1' },
        );
        assert.equal(body.experts.length, 1);
        assert.equal(body.seminars.length, 1);
        assert.equal(body.students.length, 1);
        assert.equal(body.yours.length, 1);
        assert.deepEqual(body.pages, []);
        const serialized = JSON.stringify(body);
        for (const secret of [
            'leak-email@example.com',
            '555-0199',
            'hunter2-secret',
            'oauth-leak-id',
            '3.99-leak',
            '99-leak',
            'resumes/leak.pdf',
            'pi_leak_secret',
            'cus_leak_secret',
        ]) {
            assert.equal(serialized.includes(secret), false, secret);
        }
    });
});
