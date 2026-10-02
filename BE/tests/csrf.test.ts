import test from 'node:test';
import assert from 'node:assert';
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { csrfProtection, csrfErrorHandler } = require('../config/csrf');

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(csrfProtection);
    app.get('/csrf-token', (req: any, res: any) => res.json({ csrfToken: req.csrfToken() }));
    app.get('/read', (_req: any, res: any) => res.json({ ok: true }));
    app.post('/change', (_req: any, res: any) => res.json({ ok: true }));
    app.use(csrfErrorHandler);
    return app;
}

test('POST without a CSRF token is rejected with 403 EBADCSRFTOKEN', async () => {
    const res = await request(buildApp()).post('/change').send({});
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'EBADCSRFTOKEN');
});

test('GET issues a token and a POST carrying it succeeds', async () => {
    const agent = request.agent(buildApp());
    const tok = await agent.get('/csrf-token');
    assert.equal(tok.status, 200);
    assert.ok(tok.body.csrfToken, 'csrf-token endpoint should return a token');

    const ok = await agent.post('/change').set('X-CSRF-Token', tok.body.csrfToken).send({});
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body, { ok: true });
});

test('a token without its matching secret cookie is rejected', async () => {
    const app = buildApp();
    const tok = await request(app).get('/csrf-token');
    const res = await request(app).post('/change').set('X-CSRF-Token', tok.body.csrfToken).send({});
    assert.equal(res.status, 403);
});

test('GET requests pass without any token', async () => {
    const res = await request(buildApp()).get('/read');
    assert.equal(res.status, 200);
});

function buildMeetingApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(csrfProtection);
    app.post('/api/meeting/chat-sync', (_req: any, res: any) => res.json({ ok: true }));
    app.post('/api/meeting/heartbeat', (_req: any, res: any) => res.json({ ok: true }));
    app.post('/api/meeting/end-call', (_req: any, res: any) => res.json({ ok: true }));
    app.post('/api/meeting/rate', (_req: any, res: any) => res.json({ ok: true }));
    app.use(csrfErrorHandler);
    return app;
}

test('meeting chat-sync from the Jitsi tab is no longer blocked by CSRF', async () => {
    const res = await request(buildMeetingApp())
        .post('/api/meeting/chat-sync')
        .set('Authorization', 'Bearer some-meeting-token')
        .send({ meetingThreadId: 'm1', content: 'hello from the call' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
});

test('heartbeat and end-call are exempt too, so meetings track real presence', async () => {
    for (const path of ['/api/meeting/heartbeat', '/api/meeting/end-call']) {
        const res = await request(buildMeetingApp())
            .post(path)
            .set('Authorization', 'Bearer some-meeting-token')
            .send({ meetingThreadId: 'm1' });
        assert.equal(res.status, 200, `${path} should skip CSRF for bearer callers`);
    }
});

test('the same route still demands CSRF when called with cookies instead of a bearer', async () => {
    const res = await request(buildMeetingApp())
        .post('/api/meeting/chat-sync')
        .send({ meetingThreadId: 'm1', content: 'hi' });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'EBADCSRFTOKEN');
});

test('an empty bearer value does not buy a CSRF exemption', async () => {
    const res = await request(buildMeetingApp())
        .post('/api/meeting/chat-sync')
        .set('Authorization', 'Bearer   ')
        .send({ meetingThreadId: 'm1', content: 'hi' });
    assert.equal(res.status, 403);
});

test('a bearer header does not exempt routes outside the meeting callback list', async () => {
    const res = await request(buildMeetingApp())
        .post('/api/meeting/rate')
        .set('Authorization', 'Bearer some-meeting-token')
        .send({ score: 5 });
    assert.equal(res.status, 403, 'only the Jitsi-called routes may skip CSRF');
});
