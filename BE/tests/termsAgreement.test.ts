import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

process.env.SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || 'SG.test-key';

const TermsVersion = require('../models/TermsVersion');
const TermsAcceptance = require('../models/TermsAcceptance');
const User = require('../models/User');
const { sanitizeTermsHtml } = require('../utils/termsHtml');
const {
    publishTermsVersion,
    acceptTermsForUser,
    listRequiredContracts,
    searchTermsUsers,
    gateSignupAgreement,
} = require('../services/termsAgreement');
const { register } = require('../controllers/auth.controller');

const versions: any[] = [];
const acceptances: any[] = [];

const original = {
    versionFindOne: TermsVersion.findOne,
    versionFind: TermsVersion.find,
    versionCreate: TermsVersion.create,
    acceptanceFindOne: TermsAcceptance.findOne,
    acceptanceFind: TermsAcceptance.find,
    acceptanceCreate: TermsAcceptance.create,
    userFind: User.find,
    userFindOne: User.findOne,
};

function chain(produce: () => any) {
    const query: any = {
        sort() { return query; },
        select() { return query; },
        limit() { return query; },
        populate() { return query; },
        lean() { return Promise.resolve(produce()); },
    };
    return query;
}

function matches(doc: any, filter: Record<string, any>) {
    return Object.entries(filter || {}).every(([key, expected]) => {
        if (expected && typeof expected === 'object' && Array.isArray(expected.$in)) {
            return expected.$in.map(String).includes(String(doc[key]));
        }
        if (expected instanceof RegExp) return expected.test(String(doc[key] ?? ''));
        return String(doc[key]) === String(expected);
    });
}

function installMemory() {
    versions.length = 0;
    acceptances.length = 0;
    TermsVersion.findOne = (filter: any) => chain(() => {
        const hits = versions.filter((row) => matches(row, filter));
        hits.sort((a, b) => b.version - a.version);
        if (!hits[0]) return null;
        const { docx: _docx, ...rest } = hits[0];
        return rest;
    });
    TermsVersion.find = (filter: any) => chain(() => {
        return versions
            .filter((row) => matches(row, filter))
            .sort((a, b) => a.version - b.version)
            .map(({ docx: _docx, ...rest }) => rest);
    });
    TermsVersion.create = async (doc: any) => {
        const row = { ...doc, _id: `v${versions.length + 1}` };
        versions.push(row);
        return row;
    };
    TermsAcceptance.findOne = (filter: any) => chain(() => {
        return acceptances.find((row) => matches(row, filter)) || null;
    });
    TermsAcceptance.find = (filter: any) => chain(() => acceptances.filter((row) => matches(row, filter)));
    TermsAcceptance.create = async (doc: any) => {
        const row = { ...doc, _id: `a${acceptances.length + 1}` };
        acceptances.push(row);
        return row;
    };
}

function restoreMemory() {
    TermsVersion.findOne = original.versionFindOne;
    TermsVersion.find = original.versionFind;
    TermsVersion.create = original.versionCreate;
    TermsAcceptance.findOne = original.acceptanceFindOne;
    TermsAcceptance.find = original.acceptanceFind;
    TermsAcceptance.create = original.acceptanceCreate;
    User.find = original.userFind;
    User.findOne = original.userFindOne;
}

function docx(name: string) {
    return fs.readFileSync(path.join(__dirname, 'fixtures', name));
}

function createRes() {
    const res: any = {
        statusCode: 200,
        body: null,
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
    return res;
}

const meta = { ip: '203.0.113.10', userAgent: 'terms-test' };

test('sanitized agreement HTML drops scripts and event handlers', () => {
    const clean = sanitizeTermsHtml(
        '<h1>Title</h1><p>Hello</p><script>alert(1)</script><p onclick="alert(1)">Safe</p>',
    );
    assert.equal(clean.includes('<script'), false);
    assert.equal(clean.includes('onclick'), false);
    assert.equal(clean.includes('alert(1)'), false);
    assert.equal(clean.includes('Title'), true);
    assert.equal(clean.includes('Hello'), true);
    assert.equal(clean.includes('Safe'), true);
});

test('publishing a second docx keeps version 1 and creates version 2', async () => {
    installMemory();
    try {
        const first = await publishTermsVersion({
            audience: 'shared',
            buffer: docx('terms-v1.docx'),
            filename: 'shared-v1.docx',
            publisherId: 'admin1',
        });
        const second = await publishTermsVersion({
            audience: 'shared',
            buffer: docx('terms-v2.docx'),
            filename: 'shared-v2.docx',
            publisherId: 'admin1',
        });
        assert.equal(first.version, 1);
        assert.equal(second.version, 2);
        assert.equal(versions.length, 2);
        assert.equal(versions[0].version, 1);
        assert.equal(versions[1].version, 2);
        assert.equal(versions[0].html.includes('Version one'), true);
        assert.equal(versions[1].html.includes('Version two'), true);
        assert.notEqual(versions[0].contentHash, versions[1].contentHash);
        assert.equal(Buffer.compare(versions[0].docx, docx('terms-v1.docx')), 0);
        assert.equal(versions[0].docxSha256.length, 64);
    } finally {
        restoreMemory();
    }
});

test('accept rejects a stale or mismatched content hash', async () => {
    installMemory();
    try {
        const published = await publishTermsVersion({
            audience: 'shared',
            buffer: docx('terms-v1.docx'),
            filename: 'shared.docx',
            publisherId: 'admin1',
        });
        await assert.rejects(
            () => acceptTermsForUser({
                userId: 'user1',
                role: 'customer',
                body: {
                    audience: 'shared',
                    version: published.version,
                    contentHash: 'f'.repeat(64),
                    agreed: true,
                    typedName: 'Ada Lovelace',
                },
                meta,
            }),
            (err: any) => err.status === 409,
        );
        assert.equal(acceptances.length, 0);
    } finally {
        restoreMemory();
    }
});

test('a second accept of the same version does not insert a duplicate', async () => {
    installMemory();
    try {
        const published = await publishTermsVersion({
            audience: 'shared',
            buffer: docx('terms-v1.docx'),
            filename: 'shared.docx',
            publisherId: 'admin1',
        });
        const body = {
            audience: 'shared',
            version: published.version,
            contentHash: published.contentHash,
            agreed: true,
            typedName: 'Ada Lovelace',
        };
        const first = await acceptTermsForUser({ userId: 'user1', role: 'customer', body, meta });
        const second = await acceptTermsForUser({ userId: 'user1', role: 'customer', body, meta });
        assert.equal(first.alreadyAccepted, false);
        assert.equal(second.alreadyAccepted, true);
        assert.equal(acceptances.length, 1);
        assert.equal(acceptances[0].typedName, 'Ada Lovelace');
        assert.equal(acceptances[0].ip, meta.ip);
        assert.equal(acceptances[0].contentHash, published.contentHash);
    } finally {
        restoreMemory();
    }
});

test('a customer is not asked for the expert contract and an expert is not asked for the customer contract', async () => {
    installMemory();
    try {
        const add = async (audience: string, text: string) => {
            versions.push({
                _id: audience,
                audience,
                version: 1,
                html: `<p>${text}</p>`,
                contentHash: `hash-${audience}`,
                originalFilename: `${audience}.docx`,
                docxSha256: 'aa',
                publishedAt: new Date(),
                publisher: 'admin1',
            });
        };
        await add('shared', 'SHARED CONTRACT');
        await add('expert', 'EXPERT ONLY');
        await add('customer', 'STUDENT ONLY');

        const customer = await listRequiredContracts({ userId: 'student1', role: 'customer' });
        assert.deepEqual(customer.map((row: any) => row.audience), ['shared', 'customer']);
        assert.equal(customer.some((row: any) => row.html.includes('EXPERT ONLY')), false);

        const expert = await listRequiredContracts({ userId: 'expert1', role: 'expert' });
        assert.deepEqual(expert.map((row: any) => row.audience), ['shared', 'expert']);
        assert.equal(expert.some((row: any) => row.html.includes('STUDENT ONLY')), false);

        const admin = await listRequiredContracts({ userId: 'admin1', role: 'admin' });
        assert.deepEqual(admin, []);
    } finally {
        restoreMemory();
    }
});

test('gate payload lists shared then role when both are unsigned, and is empty when nothing is published', async () => {
    installMemory();
    try {
        const nobody = await listRequiredContracts({ userId: 'student1', role: 'customer' });
        assert.deepEqual(nobody, []);

        versions.push(
            {
                audience: 'shared',
                version: 1,
                html: '<p>Shared</p>',
                contentHash: 'hash-shared',
                originalFilename: 'shared.docx',
            },
            {
                audience: 'customer',
                version: 3,
                html: '<p>Student</p>',
                contentHash: 'hash-customer',
                originalFilename: 'student.docx',
            },
        );
        const pending = await listRequiredContracts({ userId: 'student1', role: 'customer' });
        assert.deepEqual(pending.map((row: any) => row.audience), ['shared', 'customer']);
        assert.equal(pending[0].contentHash, 'hash-shared');
        assert.equal(pending[1].version, 3);
    } finally {
        restoreMemory();
    }
});

test('signup refuses an account when a shared version exists and the signature or hash is missing or wrong', async () => {
    installMemory();
    let lookedUpUser = false;
    User.findOne = () => {
        lookedUpUser = true;
        throw new Error('account lookup should not run');
    };
    try {
        versions.push({
            audience: 'shared',
            version: 1,
            html: '<p>Shared terms</p>',
            contentHash: 'a'.repeat(64),
            originalFilename: 'shared.docx',
        });
        const reqBase = { ip: '198.51.100.20', get: () => 'signup-test', body: {} as any };

        const missing = createRes();
        await register({ ...reqBase, body: { email: 'new@example.com' } } as any, missing);
        assert.equal(missing.statusCode, 200);
        assert.equal(missing.body.status, 'FAIL');
        assert.match(missing.body.error, /Terms and Agreement/);

        const wrongHash = createRes();
        await register({
            ...reqBase,
            body: {
                termsAgreement: JSON.stringify({
                    agreed: true,
                    version: 1,
                    contentHash: 'b'.repeat(64),
                    typedName: 'Ada Lovelace',
                }),
            },
        } as any, wrongHash);
        assert.equal(wrongHash.body.status, 'FAIL');
        assert.match(wrongHash.body.error, /out of date/);

        const noSignature = createRes();
        await register({
            ...reqBase,
            body: {
                termsAgreement: {
                    agreed: true,
                    version: 1,
                    contentHash: 'a'.repeat(64),
                },
            },
        } as any, noSignature);
        assert.equal(noSignature.body.status, 'FAIL');
        assert.match(noSignature.body.error, /legal name|signature/i);

        assert.equal(lookedUpUser, false);
        assert.equal(acceptances.length, 0);
    } finally {
        restoreMemory();
    }
});

test('signup does not require a signature before any shared version is published', async () => {
    installMemory();
    try {
        const open = await gateSignupAgreement({ email: 'new@example.com' }, meta);
        assert.equal(open.ok, true);
        assert.equal(open.acceptance, null);
    } finally {
        restoreMemory();
    }
});

test('admin search matches email, username, and name', async () => {
    installMemory();
    const people = [
        { _id: '1', email: 'Ada@Example.com', username: 'ada', name: 'Ada Lovelace', role: 'customer' },
        { _id: '2', email: 'bea@example.com', username: 'mentor42', name: 'Beatrice', role: 'expert' },
        { _id: '3', email: 'cy@example.com', username: 'cy', name: 'Cy Young', role: 'customer' },
    ];
    User.find = (filter: any) => chain(() => people.filter((person) => (
        filter.$or.some((clause: any) => {
            const [field, rx] = Object.entries(clause)[0] as [string, RegExp];
            return rx.test(String((person as any)[field] ?? ''));
        })
    )));
    try {
        const byEmail = await searchTermsUsers('ada@example');
        assert.deepEqual(byEmail.map((row: any) => row.id), ['1']);

        const byUsername = await searchTermsUsers('mentor42');
        assert.deepEqual(byUsername.map((row: any) => row.id), ['2']);

        const byName = await searchTermsUsers('lovelace');
        assert.deepEqual(byName.map((row: any) => row.id), ['1']);
        assert.equal(byName[0].name, 'Ada Lovelace');
        assert.equal(byName[0].username, 'ada');
    } finally {
        restoreMemory();
    }
});

test('verifyRegistration keeps the pending signature when recording fails and a retry attaches it', async () => {
    installMemory();
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'terms-test-secret';
    const PendingUser = require('../models/PendingUser');
    const { verifyRegistration } = require('../controllers/auth.controller');
    const users: any[] = [];
    let deleted = false;
    const originalSave = User.prototype.save;
    const originalFindById = User.findById;
    const originalPendingFindOne = PendingUser.findOne;
    const memoryCreate = TermsAcceptance.create;
    let failWrites = 1;
    try {
        const published = await publishTermsVersion({
            audience: 'shared',
            buffer: docx('terms-v1.docx'),
            filename: 'shared.docx',
            publisherId: 'admin1',
        });
        const pending: any = {
            email: 'ada@example.com',
            username: 'Ada',
            confirmCode: '123456',
            updatedAt: new Date(),
            password: 'hashed',
            role: 'customer',
            termsAcceptance: {
                agreed: true,
                version: published.version,
                contentHash: published.contentHash,
                typedName: 'Ada Lovelace',
                ip: '203.0.113.9',
                userAgent: 'verify-test',
                signedAt: new Date(),
            },
            async deleteOne() { deleted = true; },
            async save() { return this; },
        };
        PendingUser.findOne = async () => pending;
        User.findOne = async (filter: any) => users.find((row) => row.email === filter.email) || null;
        User.findById = async (id: any) => users.find((row) => String(row._id) === String(id)) || null;
        User.prototype.save = async function (this: any) {
            const email = String(this.email || '').toLowerCase();
            const existing = users.find((row) => row.email === email);
            if (existing && existing !== this) {
                const err: any = new Error('duplicate email');
                err.code = 11000;
                throw err;
            }
            if (!this._id) this._id = 'user-ada';
            if (!existing) users.push(this);
            return this;
        };
        TermsAcceptance.create = async (doc: any) => {
            if (failWrites > 0) {
                failWrites -= 1;
                throw new Error('acceptance write failed');
            }
            return memoryCreate(doc);
        };

        const req = { body: { email: 'Ada@example.com', confirmCode: '123456' } };
        const first = createRes();
        first.cookie = () => first;
        await verifyRegistration(req as any, first);
        assert.equal(first.statusCode, 500);
        assert.notEqual(first.body?.status, 'SUCCESS');
        assert.equal(deleted, false);
        assert.equal(acceptances.length, 0);
        assert.equal(users.length, 1);
        assert.equal(pending.termsAcceptance.typedName, 'Ada Lovelace');

        const second = createRes();
        second.cookie = () => second;
        await verifyRegistration(req as any, second);
        assert.equal(second.statusCode, 200);
        assert.equal(second.body.status, 'SUCCESS');
        assert.equal(deleted, true);
        assert.equal(users.length, 1);
        assert.equal(acceptances.length, 1);
        assert.equal(String(acceptances[0].user), String(users[0]._id));
        assert.equal(acceptances[0].audience, 'shared');
        assert.equal(acceptances[0].typedName, 'Ada Lovelace');
        assert.equal(acceptances[0].contentHash, published.contentHash);
    } finally {
        User.prototype.save = originalSave;
        User.findById = originalFindById;
        PendingUser.findOne = originalPendingFindOne;
        restoreMemory();
    }
});

test('admin conversion copies the signup signature and keeps the pending record when that copy fails', async () => {
    installMemory();
    const PendingUser = require('../models/PendingUser');
    const AdminAuditLog = require('../models/AdminAuditLog');
    const { convertPendingUserToUserByAdmin } = require('../controllers/admin.controller');
    const users: any[] = [];
    let removed = false;
    const originalSave = User.prototype.save;
    const originalUserFindById = User.findById;
    const originalFindById = PendingUser.findById;
    const originalDelete = PendingUser.findByIdAndDelete;
    const originalAudit = AdminAuditLog.create;
    const memoryCreate = TermsAcceptance.create;
    let failWrites = 1;
    try {
        const published = await publishTermsVersion({
            audience: 'shared',
            buffer: docx('terms-v1.docx'),
            filename: 'shared.docx',
            publisherId: 'admin1',
        });
        const pending: any = {
            _id: 'pend1',
            email: 'ada@example.com',
            username: 'Ada',
            password: 'hashed',
            role: 'customer',
            termsAcceptance: {
                agreed: true,
                version: published.version,
                contentHash: published.contentHash,
                typedName: 'Ada Lovelace',
                ip: '203.0.113.9',
                userAgent: 'admin-convert-test',
                signedAt: new Date(),
            },
            async save() { return this; },
        };
        PendingUser.findById = async () => pending;
        PendingUser.findByIdAndDelete = async () => {
            removed = true;
            return pending;
        };
        AdminAuditLog.create = async () => ({});
        User.findOne = async (filter: any) => users.find((row) => row.email === filter.email) || null;
        User.findById = async (id: any) => users.find((row) => String(row._id) === String(id)) || null;
        User.prototype.save = async function (this: any) {
            const email = String(this.email || '').toLowerCase();
            const existing = users.find((row) => row.email === email);
            if (existing && existing !== this) {
                const err: any = new Error('duplicate email');
                err.code = 11000;
                throw err;
            }
            if (!this._id) this._id = 'user-ada';
            if (!existing) users.push(this);
            return this;
        };
        TermsAcceptance.create = async (doc: any) => {
            if (failWrites > 0) {
                failWrites -= 1;
                throw new Error('acceptance write failed');
            }
            return memoryCreate(doc);
        };

        const req = { body: { pendingUserId: 'pend1' }, user: { userId: 'admin1', email: 'admin@example.com' } };
        const first = createRes();
        await convertPendingUserToUserByAdmin(req, first);
        assert.equal(first.statusCode, 500);
        assert.equal(removed, false);
        assert.equal(acceptances.length, 0);
        assert.equal(users.length, 1);
        assert.equal(pending.termsAcceptance.typedName, 'Ada Lovelace');

        const second = createRes();
        await convertPendingUserToUserByAdmin(req, second);
        assert.equal(second.statusCode, 200);
        assert.match(String(second.body.message), /successfully/);
        assert.equal(removed, true);
        assert.equal(users.length, 1);
        assert.equal(acceptances.length, 1);
        assert.equal(String(acceptances[0].user), String(users[0]._id));
        assert.equal(acceptances[0].typedName, 'Ada Lovelace');
        assert.equal(acceptances[0].contentHash, published.contentHash);
    } finally {
        User.prototype.save = originalSave;
        User.findById = originalUserFindById;
        PendingUser.findById = originalFindById;
        PendingUser.findByIdAndDelete = originalDelete;
        AdminAuditLog.create = originalAudit;
        restoreMemory();
    }
});

test('admin conversion refuses a signature that does not match the current shared terms', async () => {
    installMemory();
    const PendingUser = require('../models/PendingUser');
    const { convertPendingUserToUserByAdmin } = require('../controllers/admin.controller');
    const users: any[] = [];
    let removed = false;
    const originalSave = User.prototype.save;
    const originalFindById = PendingUser.findById;
    const originalDelete = PendingUser.findByIdAndDelete;
    try {
        await publishTermsVersion({
            audience: 'shared',
            buffer: docx('terms-v1.docx'),
            filename: 'shared.docx',
            publisherId: 'admin1',
        });
        const pending: any = {
            _id: 'pend-stale',
            email: 'ada@example.com',
            username: 'Ada',
            password: 'hashed',
            role: 'customer',
            termsAcceptance: {
                agreed: true,
                version: 1,
                contentHash: 'f'.repeat(64),
                typedName: 'Ada Lovelace',
            },
            async save() { users.push({ unexpected: true }); return this; },
        };
        PendingUser.findById = async () => pending;
        PendingUser.findByIdAndDelete = async () => {
            removed = true;
            return pending;
        };
        User.prototype.save = async function (this: any) {
            users.push(this);
            return this;
        };
        const res = createRes();
        await convertPendingUserToUserByAdmin(
            { body: { pendingUserId: 'pend-stale' }, user: { userId: 'admin1', email: 'admin@example.com' } },
            res,
        );
        assert.equal(res.statusCode, 400);
        assert.match(String(res.body.message), /out of date/);
        assert.equal(removed, false);
        assert.equal(users.length, 0);
        assert.equal(acceptances.length, 0);
        assert.equal(pending.termsAcceptance.typedName, 'Ada Lovelace');
    } finally {
        User.prototype.save = originalSave;
        PendingUser.findById = originalFindById;
        PendingUser.findByIdAndDelete = originalDelete;
        restoreMemory();
    }
});

test('verifyRegistration does not attach a pending signature to a different account with the same email', async () => {
    installMemory();
    const PendingUser = require('../models/PendingUser');
    const { verifyRegistration } = require('../controllers/auth.controller');
    const oauthUser = { _id: 'oauth-user', email: 'ada@example.com', oauthProvider: 'google' };
    const users: any[] = [oauthUser];
    let deleted = false;
    const originalSave = User.prototype.save;
    const originalFindById = User.findById;
    const originalPendingFindOne = PendingUser.findOne;
    try {
        const published = await publishTermsVersion({
            audience: 'shared',
            buffer: docx('terms-v1.docx'),
            filename: 'shared.docx',
            publisherId: 'admin1',
        });
        const pending: any = {
            email: 'ada@example.com',
            username: 'Ada',
            confirmCode: '123456',
            updatedAt: new Date(),
            password: 'hashed',
            role: 'customer',
            termsAcceptance: {
                agreed: true,
                version: published.version,
                contentHash: published.contentHash,
                typedName: 'Ada Lovelace',
                ip: '203.0.113.9',
                userAgent: 'verify-test',
                signedAt: new Date(),
            },
            async deleteOne() { deleted = true; },
            async save() { return this; },
        };
        PendingUser.findOne = async () => pending;
        User.findById = async (id: any) => users.find((row) => String(row._id) === String(id)) || null;
        User.prototype.save = async function (this: any) {
            const email = String(this.email || '').toLowerCase();
            if (users.some((row) => row.email === email)) {
                const err: any = new Error('duplicate email');
                err.code = 11000;
                throw err;
            }
            users.push(this);
            return this;
        };
        const res = createRes();
        res.cookie = () => res;
        await verifyRegistration({ body: { email: 'ada@example.com', confirmCode: '123456' } } as any, res);
        assert.equal(res.statusCode, 500);
        assert.notEqual(res.body?.status, 'SUCCESS');
        assert.equal(deleted, false);
        assert.equal(pending.createdUserId, undefined);
        assert.equal(users.length, 1);
        assert.equal(users[0]._id, 'oauth-user');
        assert.equal(acceptances.length, 0);
    } finally {
        User.prototype.save = originalSave;
        User.findById = originalFindById;
        PendingUser.findOne = originalPendingFindOne;
        restoreMemory();
    }
});
