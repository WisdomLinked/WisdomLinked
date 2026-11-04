import test from "node:test";
import assert from "node:assert/strict";

// Never let these tests reach the real chat or video servers.
process.env.ROCKETCHAT_URL = "http://127.0.0.1:9999";
process.env.JITSI_DOMAIN = "127.0.0.1:9999";

const LoginAttempt = require("../models/LoginAttempt");
const User = require("../models/User");
const AdminAuditLog = require("../models/AdminAuditLog");
const { filterUsers, unlockUserLogin } = require("../controllers/admin.controller");
const { loginLockStatus } = require("../controllers/auth.controller");

const ADMIN = { userId: "507f191e810c19729de860aa", email: "admin@example.com" };
const MINUTE = 60 * 1000;

const lockedFor = (ms: number) => ({ failures: 5, lockUntil: new Date(Date.now() + ms), lastFailedAt: new Date() });
const open = () => ({ failures: 0, lockUntil: null, lastFailedAt: null });

/** In-memory LoginAttempt holding exactly the queries services/loginThrottle.ts sends. */
const installAttempts = (t: any, records: any[]) => {
    const rows = new Map<string, any>(records.map(r => [r.email, structuredClone(r)]));
    const lockedNow = (r: any, now: Date) =>
        [r.password?.lockUntil, r.otp?.lockUntil].some(d => d && new Date(d).getTime() > now.getTime());
    t.mock.method(LoginAttempt, "findOne", (filter: any) => ({ lean: async () => structuredClone(rows.get(filter.email) ?? null) }));
    t.mock.method(LoginAttempt, "find", (filter: any) => ({
        lean: async () => {
            if (filter.email?.$in) return [...rows.values()].filter(r => filter.email.$in.includes(r.email)).map(r => structuredClone(r));
            const now = filter.$or[0]["password.lockUntil"].$gt;
            return [...rows.values()].filter(r => lockedNow(r, now)).map(r => ({ email: r.email }));
        },
    }));
    t.mock.method(LoginAttempt, "updateOne", async (filter: any, update: any) => {
        const row = rows.get(filter.email);
        if (!row) return {};
        for (const [path, value] of Object.entries(update.$set ?? {})) {
            const [step, field] = path.split(".");
            row[step] = { ...row[step], [field]: value };
        }
        return {};
    });
    return rows;
};

const captureAudits = (t: any) => {
    const audits: any[] = [];
    t.mock.method(AdminAuditLog, "create", async (doc: any) => { audits.push(doc); return doc; });
    return audits;
};

/** A User.find / countDocuments stand-in that records every where() and answers from `docs`. */
const installUsers = (t: any, docs: any[]) => {
    const wheres: any[] = [];
    // Every where() must hold, as in Mongo (Mongoose merges a repeated email key into one $regex + $in).
    const matches = (doc: any) => wheres.every(w => {
        if (w.status) return doc.status === w.status;
        if (w.email?.$in) return w.email.$in.some((rx: RegExp) => rx.test(doc.email));
        if (w.email?.$regex) return new RegExp(w.email.$regex, w.email.$options).test(doc.email);
        return true;
    });
    const query = (finish: () => any) => {
        const q: any = {
            where: (w: any) => { wheres.push(w); return q; },
            sort: () => q,
            skip: () => q,
            limit: () => q,
            exec: async () => finish(),
        };
        return q;
    };
    t.mock.method(User, "find", () => query(() => docs.filter(matches).map(d => ({ ...d, toJSON: () => ({ ...d }) }))));
    t.mock.method(User, "countDocuments", () => query(() => docs.filter(matches).length));
    t.mock.method(User, "findOne", (filter: any) => ({
        select: () => ({
            lean: async () => {
                const rx = new RegExp(filter.email.$regex, filter.email.$options);
                return docs.find(d => rx.test(d.email)) ?? null;
            },
        }),
    }));
    return wheres;
};

const makeRes = () => ({
    statusCode: 200,
    body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
    send(body: any) { this.body = body; return this; },
});

const USERS = [
    { _id: "1", email: "Locked.Student@example.com", role: "customer", status: "review" },
    { _id: "2", email: "fine@example.com", role: "customer", status: "active" },
    { _id: "3", email: "blocked@example.com", role: "expert", status: "blocked" },
];

test("each row carries its running sign-in lock, and rows without one carry null", async t => {
    installAttempts(t, [
        { email: "locked.student@example.com", password: lockedFor(10 * MINUTE), otp: open() },
        { email: "fine@example.com", password: { failures: 5, lockUntil: new Date(Date.now() - 1000), lastFailedAt: new Date() }, otp: open() },
    ]);
    installUsers(t, USERS);
    const res = makeRes();
    await filterUsers({ body: {} }, res);
    const byEmail = Object.fromEntries(res.body.result.map((u: any) => [u.email, u.loginLock]));
    assert.equal(byEmail["Locked.Student@example.com"].step, "password");
    assert.ok(new Date(byEmail["Locked.Student@example.com"].lockedUntil).getTime() > Date.now());
    assert.equal(byEmail["fine@example.com"], null, "a lock that ran out is not shown");
    assert.equal(byEmail["blocked@example.com"], null);
    assert.equal(res.body.result.find((u: any) => u._id === "1").status, "review", "the stored status is untouched");
});

test("the Locked filter lists locked users whatever their status, matched without regard to capitals", async t => {
    installAttempts(t, [
        { email: "locked.student@example.com", password: open(), otp: lockedFor(5 * MINUTE) },
        { email: "blocked@example.com", password: lockedFor(5 * MINUTE), otp: open() },
    ]);
    const wheres = installUsers(t, USERS);
    const res = makeRes();
    await filterUsers({ body: { status: "locked" } }, res);
    assert.deepEqual(res.body.result.map((u: any) => u._id).sort(), ["1", "3"]);
    assert.equal(res.body.totalCount, 2);
    assert.equal(wheres.some(w => "status" in w), false, "Locked is never sent as a stored status");
});

test("the Locked filter keeps an email search instead of replacing it", async t => {
    installAttempts(t, [
        { email: "locked.student@example.com", password: lockedFor(5 * MINUTE), otp: open() },
        { email: "blocked@example.com", password: lockedFor(5 * MINUTE), otp: open() },
    ]);
    installUsers(t, USERS);
    const res = makeRes();
    await filterUsers({ body: { status: "locked", email: "blocked" } }, res);
    assert.deepEqual(res.body.result.map((u: any) => u._id), ["3"]);
    assert.equal(res.body.totalCount, 1);
});

test("the Locked filter shows nobody when no one is locked", async t => {
    installAttempts(t, []);
    installUsers(t, USERS);
    const res = makeRes();
    await filterUsers({ body: { status: "locked" } }, res);
    assert.deepEqual(res.body.result, []);
    assert.equal(res.body.totalCount, 0);
});

test("the other status filters still filter by stored status", async t => {
    installAttempts(t, []);
    installUsers(t, USERS);
    const res = makeRes();
    await filterUsers({ body: { status: "active" } }, res);
    assert.deepEqual(res.body.result.map((u: any) => u._id), ["2"]);
});

test("Unlock ends both locks and the wrong-try counts, and is written to the audit log", async t => {
    const rows = installAttempts(t, [
        { email: "locked.student@example.com", password: lockedFor(10 * MINUTE), otp: lockedFor(3 * MINUTE) },
    ]);
    installUsers(t, USERS);
    const audits = captureAudits(t);
    const res = makeRes();
    await unlockUserLogin({ user: ADMIN, body: { email: "LOCKED.student@example.com" } }, res);
    assert.equal(res.body.status, "SUCCESS");
    const row = rows.get("locked.student@example.com");
    for (const step of ["password", "otp"]) {
        assert.equal(row[step].lockUntil, null);
        assert.equal(row[step].failures, 0);
    }
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "user_login_unlock");
    assert.equal(audits[0].targetEmail, "Locked.Student@example.com");
    assert.deepEqual(audits[0].meta, { role: "customer", step: "password" });
});

test("Unlock on a user who is not locked succeeds and writes no audit entry", async t => {
    installAttempts(t, []);
    installUsers(t, USERS);
    const audits = captureAudits(t);
    const res = makeRes();
    await unlockUserLogin({ user: ADMIN, body: { email: "fine@example.com" } }, res);
    assert.equal(res.body.status, "SUCCESS");
    assert.equal(audits.length, 0);
});

test("Unlock refuses a missing email or an unknown user", async t => {
    installAttempts(t, []);
    installUsers(t, USERS);
    const missing = makeRes();
    await unlockUserLogin({ user: ADMIN, body: {} }, missing);
    assert.equal(missing.statusCode, 400);
    const unknown = makeRes();
    await unlockUserLogin({ user: ADMIN, body: { email: "nobody@example.com" } }, unknown);
    assert.equal(unknown.statusCode, 404);
});

test("the login page's lock check reports a running lock with its step and time left", async t => {
    installAttempts(t, [{ email: "locked.student@example.com", password: open(), otp: lockedFor(2 * MINUTE) }]);
    const res = makeRes();
    await loginLockStatus({ body: { email: "Locked.Student@example.com" } }, res);
    assert.equal(res.body.status, "SUCCESS");
    assert.equal(res.body.locked, true);
    assert.equal(res.body.lockedStep, "otp");
    assert.ok(res.body.lockedForSeconds > 110 && res.body.lockedForSeconds <= 120);
});

test("the login page's lock check says unlocked after an admin's Unlock", async t => {
    installAttempts(t, [{ email: "locked.student@example.com", password: lockedFor(10 * MINUTE), otp: open() }]);
    installUsers(t, USERS);
    captureAudits(t);
    await unlockUserLogin({ user: ADMIN, body: { email: "locked.student@example.com" } }, makeRes());
    const res = makeRes();
    await loginLockStatus({ body: { email: "locked.student@example.com" } }, res);
    assert.deepEqual(res.body, { status: "SUCCESS", locked: false });
});

test("the lock check gives the same unlocked answer for an email with no record", async t => {
    installAttempts(t, []);
    const res = makeRes();
    await loginLockStatus({ body: { email: "nobody@example.com" } }, res);
    assert.deepEqual(res.body, { status: "SUCCESS", locked: false });
});
