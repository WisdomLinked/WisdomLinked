import test from "node:test";
import assert from "node:assert/strict";

// Never let a sign-in test reach the real chat or video servers.
process.env.ROCKETCHAT_URL = "http://127.0.0.1:9999";
process.env.JITSI_DOMAIN = "127.0.0.1:9999";

const bcrypt = require("bcryptjs");
const auth = require("../middlewares/requireAuth");
const users = new Map<string, any>();
auth.getFullUserData = async (email: string) => users.get(String(email).toLowerCase()) ?? null;
const controller = require("../controllers/auth.controller");
const LoginAttempt = require("../models/LoginAttempt");
const PendingLogin = require("../models/PendingLogin");
const PendingPasswordReset = require("../models/PendingPasswordReset");
const utils = require("../services/utils");

const PASSWORD = "Correct#Pass1";
const HASH = bcrypt.hashSync(PASSWORD, 4);
const EMAIL = "student@example.com";

// ---- an in-memory LoginAttempt that supports exactly what services/loginThrottle.ts uses ----
const attempts = new Map<string, any>();
const clone = (doc: any) => (doc ? structuredClone(doc) : null);
const getPath = (doc: any, path: string) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), doc);
const setPath = (doc: any, path: string, value: any) => {
    const keys = path.split(".");
    let o = doc;
    for (const k of keys.slice(0, -1)) o = o[k] ??= {};
    o[keys[keys.length - 1]] = value;
};
const sameValue = (a: any, b: any) =>
    a instanceof Date || b instanceof Date ? new Date(a ?? 0).getTime() === new Date(b ?? 0).getTime() && (a == null) === (b == null) : (a ?? null) === (b ?? null);
const matches = (doc: any, filter: any) =>
    doc && Object.entries(filter).every(([k, v]) => (k === "email" ? doc.email === v : sameValue(getPath(doc, k), v)));
const applyUpdate = (doc: any, update: any) => {
    for (const [k, v] of Object.entries(update.$inc ?? {})) setPath(doc, k, (Number(getPath(doc, k)) || 0) + Number(v));
    for (const [k, v] of Object.entries(update.$set ?? {})) setPath(doc, k, v);
};
const newAttemptDoc = (email: string) => ({
    email,
    password: { failures: 0, lockUntil: null, lastFailedAt: null },
    otp: { failures: 0, lockUntil: null, lastFailedAt: null },
});

const installFakes = (t: any) => {
    attempts.clear();
    t.mock.method(LoginAttempt, "findOne", (filter: any) => ({ lean: async () => clone(attempts.get(filter.email)) }));
    t.mock.method(LoginAttempt, "updateOne", async (filter: any, update: any) => {
        const doc = attempts.get(filter.email);
        if (matches(doc, filter)) applyUpdate(doc, update);
        return {};
    });
    t.mock.method(LoginAttempt, "findOneAndUpdate", (filter: any, update: any, opts: any) => ({
        lean: async () => {
            let doc = attempts.get(filter.email);
            if (!doc && opts?.upsert) attempts.set(filter.email, (doc = newAttemptDoc(filter.email)));
            if (!doc) return null;
            applyUpdate(doc, update);
            return clone(doc);
        },
    }));

    const pending = new Map<string, any>();
    t.mock.method(PendingLogin, "findOne", async (filter: any) => {
        const rx: RegExp = filter.email.$regex;
        for (const [email, doc] of pending) if (rx.test(email)) return doc;
        return null;
    });
    t.mock.method(PendingLogin.prototype, "save", async function (this: any) {
        const doc = this;
        doc.deleteOne = async () => pending.delete(doc.email);
        doc.save = async () => doc;
        pending.set(doc.email, doc);
        return doc;
    });
    const sent: string[] = [];
    t.mock.method(utils, "sendOTP", async (email: string) => sent.push(email));

    users.clear();
    users.set(EMAIL, {
        email: EMAIL,
        username: "student",
        password: HASH,
        status: "active",
        generateAuthToken: async () => "token",
        save: async () => undefined,
    });
    return { sent, pending };
};

const makeRes = () => ({
    statusCode: 200,
    body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
    send(body: any) { this.body = body; return this; },
    cookie() { return this; },
});

const signIn = async (email: string, password: string) => {
    const res = makeRes();
    await controller.login({ body: { email, password } }, res);
    return res.body;
};
const enterCode = async (code: string, email = EMAIL) => {
    const res = makeRes();
    await controller.confirmLoginByCode({ body: { email, password: PASSWORD, code } }, res);
    return res.body;
};
const expireLock = (email: string, kind: "password" | "otp") => {
    attempts.get(email)[kind].lockUntil = new Date(Date.now() - 1000);
};

test("the first wrong password says four tries are left", async t => {
    installFakes(t);
    const reply = await signIn(EMAIL, "wrong");
    assert.equal(reply.status, "FAIL");
    assert.equal(reply.error, "Incorrect email or password. You have 4 attempts left.");
    assert.equal(reply.attemptsLeft, 4);
});

test("each wrong password counts down, ending on one try", async t => {
    installFakes(t);
    const left = [];
    for (let i = 0; i < 4; i++) left.push((await signIn(EMAIL, "wrong")).attemptsLeft);
    assert.deepEqual(left, [4, 3, 2, 1]);
    assert.equal((await signIn(EMAIL, "wrong")).error.startsWith("Too many failed sign-in attempts."), true);
});

test("the fifth wrong password locks the account for 15 minutes", async t => {
    installFakes(t);
    for (let i = 0; i < 4; i++) await signIn(EMAIL, "wrong");
    const reply = await signIn(EMAIL, "wrong");
    assert.equal(reply.error, "Too many failed sign-in attempts. Please try again in 15 minutes.");
    assert.equal(reply.attemptsLeft, 0);
    assert.equal(reply.lockedStep, "password");
    assert.equal(reply.lockedForSeconds, 900);
});

test("while locked even the right password is refused and no code is emailed", async t => {
    const { sent } = installFakes(t);
    for (let i = 0; i < 5; i++) await signIn(EMAIL, "wrong");
    const reply = await signIn(EMAIL, PASSWORD);
    assert.equal(reply.status, "FAIL");
    assert.match(reply.error, /^Too many failed sign-in attempts\. Please try again in 15 minutes\.$/);
    assert.equal(sent.length, 0);
});

test("after the lock runs out the right password works", async t => {
    const { sent } = installFakes(t);
    for (let i = 0; i < 5; i++) await signIn(EMAIL, "wrong");
    expireLock(EMAIL, "password");
    assert.equal((await signIn(EMAIL, PASSWORD)).status, "SUCCESS");
    assert.equal(sent.length, 1);
});

test("after the lock runs out there are five fresh tries", async t => {
    installFakes(t);
    for (let i = 0; i < 5; i++) await signIn(EMAIL, "wrong");
    expireLock(EMAIL, "password");
    assert.equal((await signIn(EMAIL, "wrong")).attemptsLeft, 4);
});

test("the right password resets the count", async t => {
    installFakes(t);
    await signIn(EMAIL, "wrong");
    await signIn(EMAIL, "wrong");
    assert.equal((await signIn(EMAIL, PASSWORD)).status, "SUCCESS");
    assert.equal((await signIn(EMAIL, "wrong")).attemptsLeft, 4);
});

test("the count follows the account whatever the email's capitals", async t => {
    installFakes(t);
    await signIn("Student@Example.com", "wrong");
    assert.equal((await signIn(" student@example.COM ", "wrong")).attemptsLeft, 3);
});

test("an email with no account gets the same replies and lock, so accounts cannot be discovered", async t => {
    installFakes(t);
    const replies = [];
    for (let i = 0; i < 5; i++) replies.push(await signIn("nobody@example.com", "wrong"));
    assert.equal(replies[0].error, "Incorrect email or password. You have 4 attempts left.");
    assert.equal(replies[4].error, "Too many failed sign-in attempts. Please try again in 15 minutes.");
});

test("one account's lock does not touch another account", async t => {
    installFakes(t);
    for (let i = 0; i < 5; i++) await signIn("nobody@example.com", "wrong");
    assert.equal((await signIn(EMAIL, PASSWORD)).status, "SUCCESS");
});

test("accounts that sign in with Google are pointed there and not counted", async t => {
    installFakes(t);
    users.set("oauth@example.com", { email: "oauth@example.com", password: null, oauthProvider: "google" });
    for (let i = 0; i < 6; i++) await signIn("oauth@example.com", "anything");
    assert.equal(attempts.get("oauth@example.com"), undefined);
});

test("the first wrong code says four tries are left", async t => {
    installFakes(t);
    await signIn(EMAIL, PASSWORD);
    const reply = await enterCode("000000");
    assert.equal(reply.error, "Incorrect verification code. You have 4 attempts left.");
    assert.equal(reply.attemptsLeft, 4);
});

test("the fifth wrong code locks the code step for 15 minutes, even for the right code", async t => {
    installFakes(t);
    await signIn(EMAIL, PASSWORD);
    const left = [];
    for (let i = 0; i < 4; i++) left.push((await enterCode("000000")).attemptsLeft);
    assert.deepEqual(left, [4, 3, 2, 1]);
    const locked = await enterCode("000000");
    assert.equal(locked.error, "Too many incorrect codes. Please try again in 15 minutes.");
    assert.equal(locked.lockedStep, "otp");
    assert.equal(locked.lockedForSeconds, 900);
    assert.equal((await enterCode("123456")).status, "FAIL");
});

test("asking for a new code cannot get around a code lock", async t => {
    const { sent } = installFakes(t);
    await signIn(EMAIL, PASSWORD);
    for (let i = 0; i < 5; i++) await enterCode("000000");
    const reply = await signIn(EMAIL, PASSWORD);
    assert.equal(reply.error, "Too many incorrect codes. Please try again in 15 minutes.");
    assert.equal(reply.lockedStep, "otp");
    assert.equal(sent.length, 1);
});

test("a resent code does not reset the wrong-code count", async t => {
    installFakes(t);
    await signIn(EMAIL, PASSWORD);
    await enterCode("000000");
    await enterCode("000000");
    await signIn(EMAIL, PASSWORD);
    assert.equal((await enterCode("000000")).attemptsLeft, 2);
});

test("after a code lock runs out a new code can be requested and used", async t => {
    installFakes(t);
    await signIn(EMAIL, PASSWORD);
    for (let i = 0; i < 5; i++) await enterCode("000000");
    expireLock(EMAIL, "otp");
    assert.equal((await signIn(EMAIL, PASSWORD)).status, "SUCCESS");
    assert.equal((await enterCode("000000")).attemptsLeft, 4);
    assert.equal((await enterCode("123456")).status, "SUCCESS");
});

test("signing in clears both counts", async t => {
    installFakes(t);
    await signIn(EMAIL, "wrong");
    await signIn(EMAIL, PASSWORD);
    await enterCode("000000");
    assert.equal((await enterCode("123456")).status, "SUCCESS");
    const state = attempts.get(EMAIL);
    assert.equal(state.password.failures, 0);
    assert.equal(state.otp.failures, 0);
});

test("resetting the password ends a sign-in lock", async t => {
    installFakes(t);
    for (let i = 0; i < 5; i++) await signIn(EMAIL, "wrong");
    t.mock.method(PendingPasswordReset, "findOne", async () => ({
        code: 123456,
        updatedAt: new Date(),
        deleteOne: async () => undefined,
    }));
    const res = makeRes();
    await controller.confirmPasswordResetByCode({ body: { email: EMAIL, password: "Brand#New9", code: "123456" } }, res);
    assert.equal(res.body.status, "SUCCESS");
    assert.equal(attempts.get(EMAIL).password.lockUntil, null);
    users.get(EMAIL).password = bcrypt.hashSync("Brand#New9", 4);
    assert.equal((await signIn(EMAIL, "Brand#New9")).status, "SUCCESS");
});

test("LOGIN_ATTEMPT_LIMITS_DISABLED turns the limits off", async t => {
    installFakes(t);
    process.env.LOGIN_ATTEMPT_LIMITS_DISABLED = "true";
    t.after(() => { delete process.env.LOGIN_ATTEMPT_LIMITS_DISABLED; });
    for (let i = 0; i < 7; i++) {
        const reply = await signIn(EMAIL, "wrong");
        assert.equal(reply.error, "Invalid credentials. Please try again.");
        assert.equal(reply.attemptsLeft, undefined);
    }
    assert.equal((await signIn(EMAIL, PASSWORD)).status, "SUCCESS");
});

test("guesses sent all at once still get only five checks: a right password sent 7th is refused", async t => {
    const { sent } = installFakes(t);
    const replies = await Promise.all([
        ...Array.from({ length: 6 }, (_, i) => signIn(EMAIL, `wrong-${i}`)),
        signIn(EMAIL, PASSWORD),
    ]);
    assert.equal(replies[6].status, "FAIL");
    assert.equal(replies[6].lockedStep, "password");
    assert.equal(sent.length, 0);
    assert.equal(replies.filter(r => typeof r.attemptsLeft === "number" && r.attemptsLeft > 0).length, 4);
});

test("codes sent all at once still get only five checks: a right code sent 7th is refused", async t => {
    installFakes(t);
    await signIn(EMAIL, PASSWORD);
    const replies = await Promise.all([
        ...Array.from({ length: 6 }, (_, i) => enterCode(String(200000 + i))),
        enterCode("123456"),
    ]);
    assert.equal(replies[6].status, "FAIL");
    assert.equal(replies[6].lockedStep, "otp");
});

test("a right code clears earlier wrong codes even before the rest of sign-in", async t => {
    installFakes(t);
    await signIn(EMAIL, PASSWORD);
    await enterCode("000000");
    await enterCode("000001");
    assert.equal((await enterCode("123456")).status, "SUCCESS");
    assert.equal(attempts.get(EMAIL).otp.failures, 0);
});

test("tries made during a lock are refused without adding to the count", async t => {
    installFakes(t);
    for (let i = 0; i < 5; i++) await signIn(EMAIL, "wrong");
    for (let i = 0; i < 3; i++) await signIn(EMAIL, "wrong");
    assert.equal(attempts.get(EMAIL).password.failures, 5);
});

test("a right code typed too late still clears the wrong-code count", async t => {
    const { pending } = installFakes(t);
    await signIn(EMAIL, PASSWORD);
    await enterCode("000000");
    await enterCode("000001");
    pending.get(EMAIL).validUntil = new Date(Date.now() - 1000);
    assert.match((await enterCode("123456")).error, /expired/i);
    assert.equal(attempts.get(EMAIL).otp.failures, 0);
});

const BLOCKED_REPLY = {
    status: "FAIL",
    error: "Your profile is blocked. Contact admin for more details.",
    code: "USER_BLOCKED",
};

test("a blocked user with the right password is told so, and no code is emailed", async t => {
    const { sent } = installFakes(t);
    users.get(EMAIL).status = "blocked";
    assert.deepEqual(await signIn(EMAIL, PASSWORD), BLOCKED_REPLY);
    assert.equal(sent.length, 0);
});

test("a blocked user with a wrong password gets the normal reply, so blocked accounts cannot be discovered", async t => {
    installFakes(t);
    users.get(EMAIL).status = "blocked";
    const reply = await signIn(EMAIL, "wrong");
    assert.equal(reply.error, "Incorrect email or password. You have 4 attempts left.");
    assert.equal(reply.code, undefined);
});

test("a user blocked after the password step is refused at the code step", async t => {
    const { pending } = installFakes(t);
    assert.equal((await signIn(EMAIL, PASSWORD)).status, "SUCCESS");
    users.get(EMAIL).status = "blocked";
    assert.deepEqual(await enterCode("123456"), BLOCKED_REPLY);
    assert.equal(pending.has(EMAIL), true);
});

for (const status of ["active", "review"]) {
    test(`a user with status ${status} is not given the blocked reply`, async t => {
        installFakes(t);
        users.get(EMAIL).status = status;
        assert.equal((await signIn(EMAIL, PASSWORD)).status, "SUCCESS");
        const reply = await enterCode("123456");
        assert.equal(reply.status, "SUCCESS");
        assert.equal(reply.code, undefined);
    });
}

test("signing in clears wrong passwords typed elsewhere after the code was sent", async t => {
    installFakes(t);
    await signIn(EMAIL, PASSWORD);
    await signIn(EMAIL, "wrong");
    await signIn(EMAIL, "wrong");
    assert.equal((await enterCode("123456")).status, "SUCCESS");
    assert.equal(attempts.get(EMAIL).password.failures, 0);
});
