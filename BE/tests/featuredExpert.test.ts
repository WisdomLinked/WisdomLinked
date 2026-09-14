import test from 'node:test';
import assert from 'node:assert/strict';
import {
    toPublicExpert,
    parseExpertType,
    listPublicFeaturedExperts,
    listAdminFeaturedExperts,
    reorderFeaturedExpert,
    DEFAULT_FEATURED_EXPERTS,
} from '../controllers/featuredExpert.controller';

const FeaturedExpert = require('../models/FeaturedExpert');
const AdminAuditLog = require('../models/AdminAuditLog');

const originalCount = FeaturedExpert.countDocuments;
const originalInsertMany = FeaturedExpert.insertMany;
const originalFind = FeaturedExpert.find;
const originalFindOne = FeaturedExpert.findOne;
const originalCreate = FeaturedExpert.create;
const originalAuditCreate = AdminAuditLog.create;

AdminAuditLog.create = async () => ({});

const ID_A = '507f1f77bcf86cd799439011';
const ID_B = '507f1f77bcf86cd799439012';
const ID_C = '507f1f77bcf86cd799439013';

type StoreDoc = {
    _id: string;
    id?: string;
    name: string;
    title: string;
    organization: string;
    type: string;
    photoUrl: string;
    order: number;
    active: boolean;
    save: () => Promise<void>;
};

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

function installStore(initial: Omit<StoreDoc, 'save'>[]) {
    const store: StoreDoc[] = initial.map((row) => {
        const doc: StoreDoc = {
            ...row,
            save: async () => {},
        };
        return doc;
    });

    FeaturedExpert.countDocuments = async () => store.length;
    FeaturedExpert.insertMany = async (rows: any[]) => {
        rows.forEach((row, i) => {
            store.push({
                _id: `507f1f77bcf86cd7994390${String(20 + i).padStart(2, '0')}`,
                name: row.name,
                title: row.title,
                organization: row.organization,
                type: row.type,
                photoUrl: row.photoUrl || '',
                order: row.order,
                active: row.active !== false,
                save: async () => {},
            });
        });
        return store;
    };
    FeaturedExpert.find = (query: any = {}) => {
        const getRows = () => {
            let rows = store;
            if (query && query.active === true) {
                rows = store.filter((d) => d.active === true);
            }
            return [...rows].sort((a, b) => a.order - b.order || String(a._id).localeCompare(String(b._id)));
        };
        const q: any = {
            sort() {
                return q;
            },
            lean: async () => getRows().map((d) => ({ ...d })),
            then(resolve: any, reject: any) {
                return Promise.resolve(getRows()).then(resolve, reject);
            },
        };
        return q;
    };
    FeaturedExpert.findOne = () => ({
        sort: () => ({
            select: () => ({
                lean: async () => {
                    if (!store.length) return null;
                    return [...store].sort((a, b) => b.order - a.order)[0];
                },
            }),
        }),
    });
    FeaturedExpert.create = async (row: any) => {
        const created: StoreDoc = {
            _id: `507f1f77bcf86cd799439099`,
            name: row.name,
            title: row.title,
            organization: row.organization,
            type: row.type,
            photoUrl: row.photoUrl || '',
            order: row.order,
            active: row.active !== false,
            save: async () => {},
        };
        store.push(created);
        return created;
    };

    return store;
}

function restoreModel() {
    FeaturedExpert.countDocuments = originalCount;
    FeaturedExpert.insertMany = originalInsertMany;
    FeaturedExpert.find = originalFind;
    FeaturedExpert.findOne = originalFindOne;
    FeaturedExpert.create = originalCreate;
}

test('toPublicExpert serializes _id as id and trims fields', () => {
    assert.deepEqual(
        toPublicExpert({
            _id: ID_A,
            name: '  Dr. Bruce Wang  ',
            title: ' Professor ',
            organization: ' UC Berkeley ',
            type: 'academic',
            photoUrl: '  ',
            order: 0,
            active: true,
        }),
        {
            id: ID_A,
            name: 'Dr. Bruce Wang',
            title: 'Professor',
            organization: 'UC Berkeley',
            type: 'academic',
            photoUrl: '',
            order: 0,
            active: true,
        },
    );
    assert.equal(parseExpertType('Industry'), 'industry');
    assert.equal(parseExpertType('nope'), null);
    assert.equal(toPublicExpert({ name: 'A', title: 'B', organization: 'C', type: 'academic' }), null);
});

test('public GET seeds the mock experts when the collection is empty', async () => {
    try {
        const store = installStore([]);
        const res = createRes();
        await listPublicFeaturedExperts({} as any, res);
        assert.equal(res.statusCode, 200);
        assert.equal(store.length, DEFAULT_FEATURED_EXPERTS.length);
        assert.equal(res.body.experts.length, DEFAULT_FEATURED_EXPERTS.length);
        assert.equal(res.body.experts[0].name, 'Dr. Bruce Wang');
        assert.equal(res.body.experts[4].type, 'industry');
    } finally {
        restoreModel();
    }
});

test('public list hides inactive experts while admin list includes them', async () => {
    try {
        installStore([
            {
                _id: ID_A,
                name: 'Visible Mentor',
                title: 'Professor',
                organization: 'MIT',
                type: 'academic',
                photoUrl: '',
                order: 0,
                active: true,
            },
            {
                _id: ID_B,
                name: 'Hidden Mentor',
                title: 'Director',
                organization: 'WSP',
                type: 'industry',
                photoUrl: '',
                order: 1,
                active: false,
            },
        ]);

        const pub = createRes();
        await listPublicFeaturedExperts({} as any, pub);
        assert.deepEqual(
            pub.body.experts.map((e: { name: string }) => e.name),
            ['Visible Mentor'],
        );

        const admin = createRes();
        await listAdminFeaturedExperts({} as any, admin);
        assert.deepEqual(
            admin.body.experts.map((e: { name: string }) => e.name),
            ['Visible Mentor', 'Hidden Mentor'],
        );
    } finally {
        restoreModel();
    }
});

test('reorder down swaps order with the next neighbor', async () => {
    try {
        const store = installStore([
            {
                _id: ID_A,
                name: 'First',
                title: 'A',
                organization: 'Org A',
                type: 'academic',
                photoUrl: '',
                order: 0,
                active: true,
            },
            {
                _id: ID_B,
                name: 'Second',
                title: 'B',
                organization: 'Org B',
                type: 'industry',
                photoUrl: '',
                order: 1,
                active: true,
            },
            {
                _id: ID_C,
                name: 'Third',
                title: 'C',
                organization: 'Org C',
                type: 'academic',
                photoUrl: '',
                order: 2,
                active: true,
            },
        ]);

        const res = createRes();
        await reorderFeaturedExpert(
            { body: { id: ID_A, direction: 'down' }, user: { email: 'admin@x.com' } } as any,
            res,
        );
        assert.equal(res.body.result, 'SUCCESS');
        assert.deepEqual(
            res.body.experts.map((e: { name: string }) => e.name),
            ['Second', 'First', 'Third'],
        );
        assert.equal(store.find((d) => d._id === ID_A)?.order, 1);
        assert.equal(store.find((d) => d._id === ID_B)?.order, 0);
    } finally {
        restoreModel();
    }
});

test.after(() => {
    AdminAuditLog.create = originalAuditCreate;
});
