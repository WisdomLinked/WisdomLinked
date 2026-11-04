import test from "node:test";
import assert from "node:assert/strict";

const termsService = require("../services/termsAgreement");
const publishedTerms: any[] = [];
termsService.publishTermsVersion = async (args: any) => {
    publishedTerms.push(args);
    return { audience: args.audience, version: 3, originalFilename: args.filename, publishedAt: new Date() };
};

const mongoose = require("mongoose");
const AdminAuditLog = require("../models/AdminAuditLog");
const AppState = require("../models/AppState");
const User = require("../models/User");
const Service = require("../models/Service");
const {
    AUDIT_STRUCTURE_LIMIT,
    AUDIT_TEXT_LIMIT,
    auditAmount,
    auditChanges,
    auditDate,
    flattenForAudit,
    profileAuditSnapshot,
} = require("../utils/adminAuditChanges");
const { normalizePricingRates } = require("../utils/bookingPrice");
const { setSeminarApprovalDeadline, setPaymentWindow, setPricingSettings } = require("../controllers/stripe.controller");
const { publishTerms } = require("../controllers/terms.controller");
const { getUserBlockReason, updateProfileOfUser } = require("../controllers/admin.controller");

const ADMIN = { userId: "507f1f77bcf86cd799439011", email: "admin@example.com" };

const makeRes = () => ({
    statusCode: 200,
    body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    send(body: any) { this.body = body; return this; },
    json(body: any) { this.body = body; return this; },
});

const captureAudits = (t: any) => {
    const audits: any[] = [];
    t.mock.method(AdminAuditLog, "create", async (doc: any) => { audits.push(doc); return doc; });
    return audits;
};

test("auditChanges records only fields whose value really changed", () => {
    assert.deepEqual(auditChanges({ a: 1, b: "x", c: null }, { a: 1, b: "y", c: undefined }), {
        b: { from: "x", to: "y" },
    });
    assert.deepEqual(auditChanges({ a: "" }, { a: null }), {});
    assert.deepEqual(auditChanges({}, { a: undefined }), {});
    assert.deepEqual(auditChanges({ a: "set" }, {}), { a: { from: "set", to: null } });
    assert.deepEqual(auditChanges(null, { a: 2 }), { a: { from: null, to: 2 } });
    assert.deepEqual(auditChanges({ list: ["a", "b"] }, { list: ["a", "b"] }), {});
    assert.deepEqual(auditChanges({ list: ["a"] }, { list: ["a", "b"] }), { list: { from: ["a"], to: ["a", "b"] } });
    assert.deepEqual(auditChanges({ n: 0 }, { n: null }), { n: { from: 0, to: null } });
    assert.deepEqual(auditChanges({ on: false }, { on: true }), { on: { from: false, to: true } });
});

test("auditChanges stores dates and ids as plain strings", () => {
    const id = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
    const changes = auditChanges(
        { when: new Date("2026-01-01T00:00:00.000Z"), who: id },
        { when: new Date("2026-01-02T00:00:00.000Z"), who: id },
    );
    assert.deepEqual(changes, {
        when: { from: "2026-01-01T00:00:00.000Z", to: "2026-01-02T00:00:00.000Z" },
    });
    assert.deepEqual(auditChanges({ who: id }, { who: String(id) }), {});
});

test("auditChanges compares long text in full but keeps the entry short", () => {
    const long = "x".repeat(AUDIT_TEXT_LIMIT + 50);
    const edited = `${long.slice(0, -1)}y`;
    const changes = auditChanges({ note: long }, { note: edited });
    assert.ok(changes.note, "an edit past the cut-off is still recorded");
    assert.equal((changes.note.from as string).length, AUDIT_TEXT_LIMIT + 1);
    assert.ok((changes.note.to as string).endsWith("…"));
    assert.deepEqual(auditChanges({ note: long }, { note: long }), {});
});

test("auditChanges keeps a large old-format object from bloating the entry", () => {
    const country = {
        name: "United States",
        timezones: Array.from({ length: 40 }, (_, i) => ({ zoneName: `America/Zone_${i}`, gmtOffset: -18000 })),
    };
    const changes = auditChanges({ country }, { country: "United States" });
    assert.equal(typeof changes.country.from, "string");
    assert.equal((changes.country.from as string).length, AUDIT_STRUCTURE_LIMIT + 1);
    assert.ok((changes.country.from as string).startsWith('{"name":"United States"'));
    assert.equal(changes.country.to, "United States");
    assert.deepEqual(auditChanges({ list: ["a"] }, { list: ["a", "b"] }), { list: { from: ["a"], to: ["a", "b"] } });
});

test("flattenForAudit turns nested settings into dotted keys", () => {
    assert.deepEqual(flattenForAudit({ seminar: { fee: 3, rule: "full" }, oneToOne: { fee: 4 } }), {
        "seminar.fee": 3,
        "seminar.rule": "full",
        "oneToOne.fee": 4,
    });
    assert.deepEqual(flattenForAudit(null), {});
    assert.deepEqual(flattenForAudit({ list: [1, 2] }), { list: [1, 2] });
});

test("profileAuditSnapshot names majors and services in a stable order", () => {
    const snapshot = profileAuditSnapshot({
        username: "Ada",
        keywords: [{ value: "Physics" }, { value: "Biology" }, null],
        customKeywords: ["Astro"],
        services: [{ value: "Mentoring" }, { value: "Admissions" }],
        price: [25],
    });
    assert.deepEqual(snapshot.majors, ["Astro", "Biology", "Physics"]);
    assert.deepEqual(snapshot.services, ["Admissions", "Mentoring"]);
    assert.deepEqual(snapshot.price, [25]);
    assert.equal(snapshot.joinPopupBlocked, false);
    assert.deepEqual(
        auditChanges(snapshot, profileAuditSnapshot({
            username: "Ada",
            keywords: [{ value: "Biology" }, { value: "Physics" }],
            customKeywords: ["Astro"],
            services: [{ value: "Admissions" }, { value: "Mentoring" }],
            price: [25],
            joinPopupBlocked: false,
        })),
        {},
    );
    assert.deepEqual(profileAuditSnapshot(null), {});
    assert.deepEqual(profileAuditSnapshot({ price: 30 }).price, [30]);
});

test("auditDate and auditAmount format cheque and payment values", () => {
    assert.equal(auditDate(new Date("2026-10-31T00:00:00.000Z")), "2026-10-31");
    assert.equal(auditDate("2026-11-02"), "2026-11-02");
    assert.equal(auditDate(null), null);
    assert.equal(auditDate("not a date"), null);
    assert.equal(auditAmount(800), "8.00 USD");
    assert.equal(auditAmount(4000, "eur"), "40.00 EUR");
    assert.equal(auditAmount(undefined), "0.00 USD");
});

const appStateDoc = (fields: Record<string, unknown> = {}): any => ({
    ...fields,
    saved: 0,
    async save() { this.saved += 1; return this; },
    markModified() {},
});

test("changing the seat-request approval deadline is audited with old and new hours", async t => {
    const audits = captureAudits(t);
    const state = appStateDoc({ seminarApprovalDeadlineHours: 24 });
    t.mock.method(AppState, "findOne", async () => state);

    const res = makeRes();
    await setSeminarApprovalDeadline({ user: ADMIN, body: { seminarApprovalDeadlineHours: 36 } }, res);
    assert.equal(res.body.result, "SUCCESS");
    assert.equal(state.seminarApprovalDeadlineHours, 36);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "set_seminar_approval_deadline");
    assert.equal(audits[0].actorEmail, "admin@example.com");
    assert.equal(audits[0].targetType, "appState");
    assert.deepEqual(audits[0].meta, { from: 24, to: 36 });

    const bad = makeRes();
    await setSeminarApprovalDeadline({ user: ADMIN, body: { seminarApprovalDeadlineHours: 500 } }, bad);
    assert.equal(bad.statusCode, 400);
    assert.equal(audits.length, 1);
});

test("the approval deadline audit starts from the 24-hour default when nothing was saved", async t => {
    const audits = captureAudits(t);
    t.mock.method(AppState, "findOne", async () => null);
    t.mock.method(AppState, "create", async (doc: any) => doc);
    await setSeminarApprovalDeadline({ user: ADMIN, body: { seminarApprovalDeadlineHours: 12 } }, makeRes());
    assert.deepEqual(audits[0].meta, { from: 24, to: 12 });
});

test("changing the booking payment window is audited with old and new hours", async t => {
    const audits = captureAudits(t);
    const state = appStateDoc({});
    t.mock.method(AppState, "findOne", async () => state);

    const res = makeRes();
    await setPaymentWindow({ user: ADMIN, body: { paymentWindowHours: 72 } }, res);
    assert.equal(res.body.result, "SUCCESS");
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "set_payment_window");
    assert.deepEqual(audits[0].meta, { from: 48, to: 72 });

    await setPaymentWindow({ user: ADMIN, body: { paymentWindowHours: 24 } }, makeRes());
    assert.deepEqual(audits[1].meta, { from: 72, to: 24 });

    const bad = makeRes();
    await setPaymentWindow({ user: ADMIN, body: { paymentWindowHours: 0 } }, bad);
    assert.equal(bad.statusCode, 400);
    assert.equal(audits.length, 2);
});

test("saving pricing settings audits only the rates that changed, as old → new", async t => {
    const audits = captureAudits(t);
    const state: any = appStateDoc({});
    t.mock.method(AppState, "findOne", async () => state);
    const seminar = normalizePricingRates(undefined, "seminar");
    const oneToOne = normalizePricingRates(undefined, "oneToOne");

    const res = makeRes();
    await setPricingSettings({
        user: ADMIN,
        body: { seminar: { ...seminar, expertCommissionPercent: 25 }, oneToOne },
    }, res);
    assert.equal(res.body.result, "SUCCESS");
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "set_pricing_settings");
    assert.deepEqual(audits[0].meta, {
        changes: { "seminar.expertCommissionPercent": { from: seminar.expertCommissionPercent, to: 25 } },
    });

    await setPricingSettings({ user: ADMIN, body: { seminar: { ...seminar, expertCommissionPercent: 25 }, oneToOne } }, makeRes());
    assert.deepEqual(audits[1].meta, { changes: {} });

    const bad = makeRes();
    await setPricingSettings({ user: ADMIN, body: { seminar: { ...seminar, taxPercent: 400 }, oneToOne } }, bad);
    assert.equal(bad.statusCode, 400);
    assert.equal(audits.length, 2);
});

test("publishing a terms version is audited with its audience and version", async t => {
    const audits = captureAudits(t);
    publishedTerms.length = 0;
    const res = makeRes();
    await publishTerms({
        user: ADMIN,
        params: { audience: "shared" },
        file: { buffer: Buffer.from("docx"), originalname: "terms-2026.docx" },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(publishedTerms.length, 1);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "publish_terms");
    assert.equal(audits[0].targetType, "terms");
    assert.equal(audits[0].targetId, "shared v3");
    assert.deepEqual(audits[0].meta, { audience: "shared", version: 3, file: "terms-2026.docx" });

    const refused = makeRes();
    await publishTerms({ user: ADMIN, params: { audience: "shared" }, file: { buffer: Buffer.from("x"), originalname: "terms.pdf" } }, refused);
    assert.equal(refused.statusCode, 400);
    assert.equal(audits.length, 1);
});

const profileUser = () => ({
    _id: "507f191e810c19729de860ea",
    email: "expert@example.com",
    role: "expert",
    status: "active",
    username: "Ada",
    title: "Dr",
    description: "Bio",
    keywords: [{ value: "Physics" }],
    customKeywords: [],
    services: [{ value: "Mentoring" }],
    country: "US",
    state: "TX",
    city: "Austin",
    phoneNumber: "+15125550100",
    price: [25],
    joinPopupBlocked: false,
    specialNote: "",
});

// One stored user behind User.findOne, whichever query shape the controller uses.
const installUserStore = (t: any, user: any, { failAfterRead = 0 } = {}) => {
    let reads = 0;
    const query = () => {
        reads += 1;
        const failing = failAfterRead && reads > failAfterRead;
        const value = () => (failing ? Promise.reject(new Error("read failed")) : Promise.resolve(JSON.parse(JSON.stringify(user))));
        const q: any = {
            select() { return q; },
            populate() { return q; },
            lean: value,
            then(resolve: any, reject: any) { return value().then(resolve, reject); },
        };
        return q;
    };
    t.mock.method(User, "findOne", query);
    t.mock.method(User, "findOneAndUpdate", async (_filter: any, updates: any) => {
        Object.assign(user, updates);
        return user;
    });
    return { reads: () => reads };
};

test("an admin profile edit is audited with only the fields that changed", async t => {
    const audits = captureAudits(t);
    const user = profileUser();
    installUserStore(t, user);

    const res = makeRes();
    await updateProfileOfUser({
        user: ADMIN,
        body: {
            email: "expert@example.com",
            username: "Ada",
            title: "Dr",
            description: "Bio",
            country: "US",
            state: "TX",
            city: "Dallas",
            phoneNumber: "+15125550100",
            price: [40],
        },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "update_user_profile");
    assert.equal(audits[0].actorEmail, "admin@example.com");
    assert.equal(audits[0].targetType, "user");
    assert.equal(audits[0].targetId, "507f191e810c19729de860ea");
    assert.equal(audits[0].targetEmail, "expert@example.com");
    assert.deepEqual(audits[0].meta, {
        role: "expert",
        changes: {
            city: { from: "Austin", to: "Dallas" },
            price: { from: [25], to: [40] },
        },
    });
});

test("re-saving a profile with no real change writes no profile audit entry", async t => {
    const audits = captureAudits(t);
    installUserStore(t, profileUser());
    await updateProfileOfUser({
        user: ADMIN,
        body: { email: "expert@example.com", username: "Ada", city: "Austin", price: [25] },
    }, makeRes());
    assert.equal(audits.length, 0);
});

test("a status-only change keeps its own audit entry and adds no profile read", async t => {
    const audits = captureAudits(t);
    const store = installUserStore(t, profileUser());
    await updateProfileOfUser({ user: ADMIN, body: { email: "expert@example.com", status: "review" } }, makeRes());
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "user_status_change");
    assert.deepEqual(audits[0].meta, { from: "active", to: "review", role: "expert" });
    assert.equal(store.reads(), 2);
});

const stubEmail = (t: any) => {
    const sent: any[] = [];
    const original = (globalThis as any).sendNotificationEmail;
    (globalThis as any).sendNotificationEmail = async (...args: any[]) => { sent.push(args); };
    t.after(() => { (globalThis as any).sendNotificationEmail = original; });
    return sent;
};

for (const [from, to, statusReason] of [
    ["active", "blocked", "Spamming students"],
    ["review", "blocked", "Fake profile"],
    ["blocked", "active", undefined],
    ["review", "active", undefined],
    ["active", "review", undefined],
    ["blocked", "review", undefined],
] as const) {
    test(`moving a user from ${from} to ${to} is audited with who, whom and what`, async t => {
        stubEmail(t);
        const audits = captureAudits(t);
        const user = { ...profileUser(), status: from };
        installUserStore(t, user);
        const res = makeRes();
        await updateProfileOfUser({ user: ADMIN, body: { email: "expert@example.com", status: to, statusReason } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(user.status, to);
        assert.equal(audits.length, 1);
        assert.equal(audits[0].action, "user_status_change");
        assert.equal(audits[0].actorEmail, ADMIN.email);
        assert.equal(audits[0].targetEmail, "expert@example.com");
        assert.deepEqual(audits[0].meta, {
            from,
            to,
            role: "expert",
            ...(statusReason ? { reason: statusReason } : {}),
        });
    });
}

for (const statusReason of [undefined, null, "", "    ", 42, "\u200b\u200b", "\u00a0", "\u200f\u200d "]) {
    test(`blocking with the reason ${JSON.stringify(statusReason)} is refused, changing and recording nothing`, async t => {
        const audits = captureAudits(t);
        const user = profileUser();
        installUserStore(t, user);
        const res = makeRes();
        await updateProfileOfUser({ user: ADMIN, body: { email: "expert@example.com", status: "blocked", statusReason } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.status, "FAIL");
        assert.equal(user.status, "active");
        assert.equal(audits.length, 0);
    });
}

test("the block reason is stored trimmed, cut at 500 characters, and only in the audit log", async t => {
    const audits = captureAudits(t);
    const user: any = profileUser();
    installUserStore(t, user);
    const statusReason = `  ${"x".repeat(600)}  `;
    await updateProfileOfUser({ user: ADMIN, body: { email: "expert@example.com", status: "blocked", statusReason } }, makeRes());
    assert.equal(audits[0].meta.reason, "x".repeat(500));
    assert.equal(user.statusReason, undefined);
});

const askBlockReason = async (t: any, entry: any) => {
    const asked: any = {};
    t.mock.method(AdminAuditLog, "findOne", (filter: any) => {
        asked.filter = filter;
        return {
            sort(order: any) { asked.sort = order; return this; },
            lean: async () => entry,
        };
    });
    const res = makeRes();
    await getUserBlockReason({ user: ADMIN, params: { userId: "64b000000000000000000009" } }, res);
    return { asked, res };
};

test("the block reason comes from that user's newest block entry", async t => {
    const { asked, res } = await askBlockReason(t, { meta: { from: "active", to: "blocked", reason: "Spamming students" } });
    assert.deepEqual(asked.filter, {
        action: "user_status_change",
        targetId: "64b000000000000000000009",
        "meta.to": "blocked",
    });
    assert.deepEqual(asked.sort, { createdAt: -1 });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { status: "SUCCESS", reason: "Spamming students" });
});

for (const [label, entry] of [
    ["a block from before reasons existed", { meta: { from: "active", to: "blocked" } }],
    ["no block entry at all", null],
] as const) {
    test(`${label} has no block reason`, async t => {
        const { res } = await askBlockReason(t, entry);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { status: "SUCCESS", reason: null });
    });
}

test("a failed block reason lookup answers with an error, not an empty reason", async t => {
    t.mock.method(AdminAuditLog, "findOne", () => ({
        sort() { return this; },
        lean: async () => { throw new Error("read failed"); },
    }));
    const res = makeRes();
    await getUserBlockReason({ user: ADMIN, params: { userId: "x" } }, res);
    assert.equal(res.statusCode, 500);
});

test("an emoji joined with an invisible character still counts as a reason", async t => {
    const audits = captureAudits(t);
    installUserStore(t, profileUser());
    const res = makeRes();
    await updateProfileOfUser({ user: ADMIN, body: { email: "expert@example.com", status: "blocked", statusReason: "\u200d🚫" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(audits[0].meta.reason, "\u200d🚫");
});

test("blocking someone already blocked says so, keeps the first reason and records nothing", async t => {
    const audits = captureAudits(t);
    installUserStore(t, { ...profileUser(), status: "blocked" });
    const res = makeRes();
    await updateProfileOfUser({ user: ADMIN, body: { email: "expert@example.com", status: "blocked", statusReason: "Second reason" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.alreadyBlocked, true);
    assert.equal(res.body.result.status, "blocked");
    assert.equal(audits.length, 0);
});

for (const body of [{ status: "blocked", statusReason: "First block" }, { status: "active" }, { city: "Dallas" }]) {
    test(`${JSON.stringify(body)} on an active user is not reported as already blocked`, async t => {
        stubEmail(t);
        captureAudits(t);
        installUserStore(t, profileUser());
        const res = makeRes();
        await updateProfileOfUser({ user: ADMIN, body: { email: "expert@example.com", ...body } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.alreadyBlocked, undefined);
    });
}

for (const body of [{ status: "active" }, { status: "review" }, { city: "Dallas" }]) {
    test(`${JSON.stringify(body)} on a blocked user is not reported as already blocked`, async t => {
        stubEmail(t);
        captureAudits(t);
        installUserStore(t, { ...profileUser(), status: "blocked" });
        const res = makeRes();
        await updateProfileOfUser({ user: ADMIN, body: { email: "expert@example.com", ...body } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.alreadyBlocked, undefined);
    });
}

test("a reason sent with any other status is ignored", async t => {
    const audits = captureAudits(t);
    installUserStore(t, profileUser());
    await updateProfileOfUser({
        user: ADMIN,
        body: { email: "expert@example.com", status: "review", statusReason: "Not for this" },
    }, makeRes());
    assert.deepEqual(audits[0].meta, { from: "active", to: "review", role: "expert" });
});

test("a status change together with a profile edit writes both entries", async t => {
    const audits = captureAudits(t);
    installUserStore(t, profileUser());
    await updateProfileOfUser({
        user: ADMIN,
        body: { email: "expert@example.com", status: "blocked", statusReason: "Fake profile", specialNote: "Paid offline" },
    }, makeRes());
    assert.deepEqual(audits.map((row) => row.action), ["user_status_change", "update_user_profile"]);
    assert.deepEqual(audits[1].meta.changes, { specialNote: { from: null, to: "Paid offline" } });
});

test("the profile save still succeeds when the audit read fails", async t => {
    const audits = captureAudits(t);
    installUserStore(t, profileUser(), { failAfterRead: 2 });
    const res = makeRes();
    await updateProfileOfUser({ user: ADMIN, body: { email: "expert@example.com", city: "Dallas" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.result.city, "Dallas");
    assert.equal(audits.length, 0);
});

// The Manage dialog sends services by name; User.services holds Service ids.
const STUDY = { _id: new mongoose.Types.ObjectId("64b000000000000000000001"), value: "Study abroad consultation" };
const WORK = { _id: new mongoose.Types.ObjectId("64b000000000000000000002"), value: "Work Abroad" };
const installServices = (t: any) => {
    const created: any[] = [];
    t.mock.method(Service, "findOne", async (filter: any) => {
        const rx: RegExp = filter?.value?.$regex;
        return [STUDY, WORK].find(s => rx && rx.test(s.value)) || null;
    });
    t.mock.method(Service, "findById", async (id: any) => [STUDY, WORK].find(s => String(s._id) === String(id)) || null);
    t.mock.method(Service, "create", async (doc: any) => {
        const made = { _id: new mongoose.Types.ObjectId(), ...doc };
        created.push(made);
        return made;
    });
    return created;
};

test("an admin edit saves when the user has services, storing them as Service ids", async t => {
    captureAudits(t);
    const created = installServices(t);
    const updates: any[] = [];
    const user = profileUser();
    installUserStore(t, user);
    t.mock.method(User, "findOneAndUpdate", async (_filter: any, u: any) => { updates.push(u); Object.assign(user, u); return user; });

    const res = makeRes();
    await updateProfileOfUser({
        user: ADMIN,
        body: { email: "expert@example.com", title: "Professor", services: ["Study Abroad", "Work Abroad"] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].title, "Professor");
    assert.deepEqual(updates[0].services.map(String), [String(STUDY._id), String(WORK._id)]);
    assert.ok(updates[0].services.every((id: any) => mongoose.isValidObjectId(id)));
    assert.equal(created.length, 0);
});

test("an admin edit resolves services like the user's own save: unknown names are created, ids are kept", async t => {
    captureAudits(t);
    const created = installServices(t);
    const updates: any[] = [];
    const user = profileUser();
    installUserStore(t, user);
    t.mock.method(User, "findOneAndUpdate", async (_filter: any, u: any) => { updates.push(u); return user; });

    const res = makeRes();
    await updateProfileOfUser({
        user: ADMIN,
        body: { email: "expert@example.com", services: [String(WORK._id), { value: "Research Guidance" }, "", null] },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(created.length, 1);
    assert.equal(created[0].value, "Research Guidance");
    assert.deepEqual(updates[0].services.map(String), [String(WORK._id), String(created[0]._id)]);
});

test("an admin edit can clear a user's services", async t => {
    captureAudits(t);
    installServices(t);
    const updates: any[] = [];
    const user = profileUser();
    installUserStore(t, user);
    t.mock.method(User, "findOneAndUpdate", async (_filter: any, u: any) => { updates.push(u); return user; });

    const res = makeRes();
    await updateProfileOfUser({ user: ADMIN, body: { email: "expert@example.com", services: [] } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(updates[0].services, []);
});

