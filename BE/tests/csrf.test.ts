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
