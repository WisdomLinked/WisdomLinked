import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeAdminDemographics } from '../utils/adminDemographics';

test('computeAdminDemographics groups countries, services, and missing counts for the join range', async () => {
    const from = new Date('2026-08-01T00:00:00.000Z');
    const to = new Date('2026-11-01T00:00:00.000Z');
    const serviceIds = {
        study: { toString: () => 'svc-study' },
        work: { toString: () => 'svc-work' },
        research: { toString: () => 'svc-research' },
        other: { toString: () => 'svc-other' },
    };
    const users = [
        { role: 'expert', country: 'USA', services: [], createdAt: new Date('2026-09-01') },
        { role: 'expert', country: { name: 'Canada' }, services: [], createdAt: new Date('2026-09-02') },
        { role: 'expert', country: '  ', services: [], createdAt: new Date('2026-09-03') },
        { role: 'customer', country: 'us', services: [serviceIds.study, serviceIds.work], createdAt: new Date('2026-09-04') },
        { role: 'customer', country: 'India', services: [serviceIds.study], createdAt: new Date('2026-09-05') },
        { role: 'customer', country: null, services: [], createdAt: new Date('2026-09-06') },
        { role: 'customer', country: 'n/a', services: [serviceIds.other], createdAt: new Date('2026-09-07') },
        { role: 'admin', country: 'USA', services: [], createdAt: new Date('2026-09-08') },
        // Outside range — must be excluded by the find filter the helper receives.
    ];

    const models = {
        User: {
            find: (filter: any) => ({
                select: () => ({
                    lean: async () =>
                        users.filter((u) => {
                            if (!['expert', 'customer'].includes(u.role)) return false;
                            const created = (u as any).createdAt as Date;
                            if (filter.createdAt?.$gte && created < filter.createdAt.$gte) return false;
                            if (filter.createdAt?.$lt && created >= filter.createdAt.$lt) return false;
                            return true;
                        }),
                }),
            }),
        },
        Service: {
            find: () => ({
                lean: async () => [
                    { _id: serviceIds.study, value: 'study_abroad', label: 'Study Abroad' },
                    { _id: serviceIds.work, value: 'work_abroad', label: 'Work Abroad' },
                    { _id: serviceIds.research, value: 'research_guidance', label: 'Research Guidance' },
                    { _id: serviceIds.other, value: 'Overseas life sharing', label: 'Overseas life sharing' },
                ],
            }),
        },
    };

    const out = await computeAdminDemographics(models, from.toISOString(), to.toISOString(), to);
    assert.deepEqual(out.totals, { experts: 3, students: 4 });
    assert.deepEqual(out.locationMissing, { experts: 1, students: 2 });
    assert.equal(out.servicesMissing, 1, 'only the student with an empty services array');
    assert.deepEqual(
        out.locations.map((r) => [r.country, r.experts, r.students]),
        [
            ['United States', 1, 1],
            ['Canada', 1, 0],
            ['India', 0, 1],
        ],
    );
    const byKey = Object.fromEntries(out.services.map((s) => [s.key, s.students]));
    assert.equal(byKey.study_abroad, 2);
    assert.equal(byKey.work_abroad, 1);
    assert.equal(byKey.research_guidance, 0);
});

test('computeAdminDemographics returns empty zeros when nobody joined in range', async () => {
    const models = {
        User: { find: () => ({ select: () => ({ lean: async () => [] }) }) },
        Service: { find: () => ({ lean: async () => [] }) },
    };
    const out = await computeAdminDemographics(models, null, null);
    assert.equal(out.totals.experts, 0);
    assert.equal(out.totals.students, 0);
    assert.equal(out.locations.length, 0);
    assert.equal(out.servicesMissing, 0);
    assert.equal(out.services.length, 3);
});
