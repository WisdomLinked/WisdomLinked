import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ASK_NEVER_AUTHORIZES,
    ASK_PAGE_ROUTES,
    ASK_RETRIEVE_CONTRACT,
    routeAsk,
    type AskPlan,
} from '../utils/askRouter';

const FULL_CATALOG = ['/', '/aboutus', '/services', '/rules', '/contactus'];

function plan(question: string): AskPlan {
    return routeAsk(question);
}

test('retrieve contract is documented and not invoked', () => {
    assert.equal(ASK_RETRIEVE_CONTRACT.method, 'POST');
    assert.equal(
        ASK_RETRIEVE_CONTRACT.url,
        'https://kbaas.do-ai.run/v1/${GRADIENT_KNOWLEDGE_BASE_UUID}/retrieve',
    );
    assert.equal(ASK_RETRIEVE_CONTRACT.numResults, 8);
    assert.equal(ASK_RETRIEVE_CONTRACT.alpha, 0.5);
    assert.equal(ASK_RETRIEVE_CONTRACT.timeoutMs, 15000);
    assert.equal(ASK_RETRIEVE_CONTRACT.bearerEnv, 'GRADIENT_API_TOKEN');
    assert.equal(ASK_RETRIEVE_CONTRACT.knowledgeBase, 'wisdomlinked-search-staging');
    assert.deepEqual(ASK_PAGE_ROUTES, ['/rules', '/services']);
    assert.deepEqual([...ASK_NEVER_AUTHORIZES], [
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
    ]);
});

test('pure price, who, seminar, and exact-service questions skip retrieve and the model', () => {
    const cases: Array<[string, Partial<AskPlan>]> = [
        ['who is the cheapest professor in civil', { mongoExperts: true, mongoSeminars: false }],
        ['highest hourly rate', { mongoExperts: true, mongoSeminars: false }],
        ['experts under 50', { mongoExperts: true, mongoSeminars: false }],
        ['experts over 100', { mongoExperts: true, mongoSeminars: false }],
        ['最便宜', { mongoExperts: true, mongoSeminars: false }],
        ['最贵', { mongoExperts: true, mongoSeminars: false }],
        ['which expert teaches structures', { mongoExperts: true, mongoSeminars: false }],
        ['教授', { mongoExperts: true, mongoSeminars: false }],
        ['what is the seminar price', { mongoExperts: false, mongoSeminars: true }],
        ['seminar seats left', { mongoExperts: false, mongoSeminars: true }],
        ['Study Abroad', { mongoExperts: true, mongoSeminars: false, routes: ['/services'] }],
        ['Work Abroad', { mongoExperts: true, mongoSeminars: false, routes: ['/services'] }],
        ['Research Guidance', { mongoExperts: true, mongoSeminars: false, routes: ['/services'] }],
    ];
    for (const [question, expected] of cases) {
        const got = plan(question);
        assert.equal(got.retrieve, false, question);
        assert.equal(got.model, false, question);
        assert.equal(got.mongoExperts, expected.mongoExperts, question);
        assert.equal(got.mongoSeminars, expected.mongoSeminars, question);
        if (expected.routes) assert.deepEqual(got.routes, expected.routes, question);
        else assert.deepEqual(got.routes, [], question);
    }
});

test('a Chinese question that is only 最便宜 or 最贵 does not set retrieve', () => {
    for (const question of ['最便宜', '最贵', '  最便宜  ', '最便宜最贵']) {
        const got = plan(question);
        assert.equal(got.retrieve, false, question);
        assert.equal(got.model, false, question);
        assert.equal(got.mongoExperts, true, question);
    }
});

test('how, why, explanatory Chinese, other Chinese, and unmatched wording set retrieve', () => {
    for (const question of [
        'how does office hours work',
        'why is there a tip',
        '怎么',
        '如何',
        '怎样',
        '便宜',
        'where is the office',
    ]) {
        const got = plan(question);
        assert.equal(got.retrieve, true, question);
        assert.equal(got.model, true, question);
    }
});

test('booking, appointment, and 预约 select only /rules', () => {
    for (const question of ['how does booking work', 'I need an appointment', '预约是怎么工作的']) {
        const got = plan(question);
        assert.deepEqual(got.routes, ['/rules'], question);
        assert.equal(got.retrieve, true, question);
        assert.equal(got.model, true, question);
        assert.equal(got.routes.includes('/services' as never), false);
    }
});

test('a pure services question selects only /services and does not retrieve', () => {
    for (const question of [
        'what services do you offer',
        'Study Abroad, Work Abroad, and Research Guidance',
    ]) {
        const got = plan(question);
        assert.deepEqual(got.routes, ['/services'], question);
        assert.equal(got.retrieve, false, question);
        assert.equal(got.model, false, question);
    }
});

test('cheapest plus how booking works sets Mongo, /rules, retrieve, and model', () => {
    const got = plan('who is the cheapest and how does booking work');
    assert.equal(got.mongoExperts, true);
    assert.equal(got.mongoSeminars, false);
    assert.deepEqual(got.routes, ['/rules']);
    assert.equal(got.retrieve, true);
    assert.equal(got.model, true);
});

test('the plan never selects the whole public catalog or private records', () => {
    const got = plan('home about contact services rules booking cheapest professor seminar price');
    assert.deepEqual(got.routes, ['/rules', '/services']);
    assert.equal(got.routes.length < FULL_CATALOG.length, true);
    for (const route of got.routes) {
        assert.equal(route === '/rules' || route === '/services', true);
    }
    const keys = Object.keys(got);
    for (const denied of ASK_NEVER_AUTHORIZES) {
        assert.equal(keys.includes(denied), false);
    }
    assert.equal(JSON.stringify(got).includes('@'), false);
});
