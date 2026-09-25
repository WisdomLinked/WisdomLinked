import test from 'node:test';
import assert from 'node:assert/strict';
import { ASK_TOOLS, runAskAgent } from '../utils/askAgent';

const GroupChat = require('../models/GroupChat');
const Event = require('../models/Event');
const SeminarSeatRequest = require('../models/SeminarSeatRequest');

const INFERENCE_URL = 'https://inference.do-ai.run/v1/chat/completions';

function leanChain(rows: any[]) {
    const api: any = {
        select() {
            return api;
        },
        populate() {
            return api;
        },
        lean() {
            return Promise.resolve(rows);
        },
    };
    return api;
}

function inferenceMessage(message: any) {
    return {
        ok: true,
        json: async () => ({ choices: [{ message }] }),
    };
}

test('get_my_bookings ignores a model-supplied user id', async () => {
    const originalGroup = GroupChat.find;
    const originalEvent = Event.find;
    const originalSeat = SeminarSeatRequest.find;
    const originalFetch = global.fetch;
    const originalTimeout = AbortSignal.timeout;
    const timeouts: number[] = [];
    const calls: { url: string; body: any }[] = [];
    GroupChat.find = () => leanChain([
        {
            name: 'Ada Seminar',
            type: 'seminar',
            status: 'active',
            admin: { _id: 'expert-ada', username: 'Ada' },
            participants: [{ _id: 'student-a', username: 'Sam' }],
        },
        {
            name: 'Grace Seminar',
            type: 'seminar',
            status: 'active',
            admin: { _id: 'expert-grace', username: 'Grace' },
            participants: [{ _id: 'student-b', username: 'Grace Student' }],
        },
    ]);
    Event.find = () => leanChain([]);
    SeminarSeatRequest.find = () => leanChain([]);
    AbortSignal.timeout = ((ms: number) => {
        timeouts.push(ms);
        return originalTimeout.call(AbortSignal, ms);
    }) as typeof AbortSignal.timeout;
    global.fetch = (async (url: string, options: any) => {
        calls.push({ url: String(url), body: JSON.parse(options.body) });
        if (calls.length === 1) {
            return inferenceMessage({
                content: null,
                tool_calls: [{
                    id: 'call-1',
                    type: 'function',
                    function: {
                        name: 'get_my_bookings',
                        arguments: JSON.stringify({ userId: 'student-b', kind: 'seminar' }),
                    },
                }],
            });
        }
        return inferenceMessage({ content: 'Ada Seminar is yours.', tool_calls: [] });
    }) as typeof fetch;
    try {
        const result = await runAskAgent({
            messages: [{ role: 'user', content: 'what is my seminar?' }],
            caller: { role: 'customer', userId: 'student-a' },
            modelKey: 'test-key',
        });
        assert.equal(result.answer, 'Ada Seminar is yours.');
        assert.equal(calls.length, 2);
        assert.equal(calls[0].url, INFERENCE_URL);
        assert.equal(calls[0].body.model, 'deepseek-4-flash');
        const names = calls[0].body.tools.map((item: any) => item.function.name).sort();
        assert.deepEqual(names, [
            'get_experts',
            'get_my_bookings',
            'get_seminars',
            'search_faq',
            'search_public_pages',
        ]);
        const booking = calls[0].body.tools.find((item: any) => item.function.name === 'get_my_bookings');
        assert.equal(Object.prototype.hasOwnProperty.call(booking.function.parameters.properties, 'userId'), false);
        assert.equal(calls[1].body.tool_choice, 'auto');
        const tool = calls[1].body.messages.find((message: any) => message.role === 'tool');
        assert.match(tool.content, /Ada Seminar/);
        assert.equal(tool.content.includes('Grace Seminar'), false);
        assert.equal(tool.content.includes('student-b'), false);
        assert.equal(timeouts.includes(15000), true);
        assert.equal(ASK_TOOLS.length, 5);
    } finally {
        GroupChat.find = originalGroup;
        Event.find = originalEvent;
        SeminarSeatRequest.find = originalSeat;
        global.fetch = originalFetch;
        AbortSignal.timeout = originalTimeout;
    }
});

test('four tool rounds end with tool_choice none', async () => {
    const originalFetch = global.fetch;
    let calls = 0;
    const bodies: any[] = [];
    global.fetch = (async (_url: string, options: any) => {
        calls += 1;
        bodies.push(JSON.parse(options.body));
        if (calls < 5) {
            return inferenceMessage({
                content: null,
                tool_calls: [{
                    id: `call-${calls}`,
                    type: 'function',
                    function: { name: 'search_public_pages', arguments: JSON.stringify({ query: 'rules' }) },
                }],
            });
        }
        return inferenceMessage({ content: 'Here are the rules.', tool_calls: [] });
    }) as typeof fetch;
    try {
        const result = await runAskAgent({
            messages: [{ role: 'user', content: 'rules?' }],
            modelKey: 'test-key',
        });
        assert.equal(result.answer, 'Here are the rules.');
        assert.equal(calls, 5);
        assert.equal(bodies[4].tool_choice, 'none');
        assert.equal(bodies[4].tools, undefined);
    } finally {
        global.fetch = originalFetch;
    }
});

test('a reply with no tool call does not make a second inference call', async () => {
    const originalFetch = global.fetch;
    let calls = 0;
    global.fetch = (async () => {
        calls += 1;
        return inferenceMessage({ content: 'Hello.', tool_calls: [] });
    }) as typeof fetch;
    try {
        const result = await runAskAgent({
            messages: [{ role: 'user', content: 'hi' }],
            caller: undefined,
            modelKey: 'test-key',
        });
        assert.equal(result.answer, 'Hello.');
        assert.equal(calls, 1);
    } finally {
        global.fetch = originalFetch;
    }
});

test('a missing model key does not call inference', async () => {
    const originalFetch = global.fetch;
    let calls = 0;
    global.fetch = (async () => {
        calls += 1;
        return inferenceMessage({ content: 'nope' });
    }) as typeof fetch;
    try {
        await assert.rejects(
            () => runAskAgent({ messages: [{ role: 'user', content: 'hi' }], modelKey: '  ' }),
            /model key missing/,
        );
        assert.equal(calls, 0);
    } finally {
        global.fetch = originalFetch;
    }
});
