import { createdAtFilter, resolveSnapshotRange } from './adminSnapshot';
import { normalizeCountry } from './normalizeCountry';
import { matchesServiceOption, SERVICE_OPTIONS } from './serviceOptions';

export type DemographicsLocationRow = {
    country: string;
    experts: number;
    students: number;
};

export type DemographicsServiceRow = {
    key: string;
    label: string;
    students: number;
};

export type DemographicsPayload = {
    totals: { experts: number; students: number };
    locations: DemographicsLocationRow[];
    locationMissing: { experts: number; students: number };
    services: DemographicsServiceRow[];
    servicesMissing: number;
};

type LeanUser = {
    role?: string;
    country?: unknown;
    services?: unknown[];
};

type ServiceDoc = {
    _id?: { toString(): string };
    value?: string;
    name?: string;
    label?: string;
};

type DemographicsModels = {
    User: {
        find: (filter: Record<string, unknown>) => {
            select: (fields: string) => {
                lean: () => Promise<LeanUser[]>;
            };
        };
    };
    Service: {
        find: (filter?: Record<string, unknown>) => {
            lean: () => Promise<ServiceDoc[]>;
        };
    };
};

function emptyPayload(): DemographicsPayload {
    return {
        totals: { experts: 0, students: 0 },
        locations: [],
        locationMissing: { experts: 0, students: 0 },
        services: SERVICE_OPTIONS.map((o) => ({ key: o.value, label: o.label, students: 0 })),
        servicesMissing: 0,
    };
}

function mapServiceIdToCanonical(
    services: ServiceDoc[],
): Map<string, (typeof SERVICE_OPTIONS)[number]['value']> {
    const byId = new Map<string, (typeof SERVICE_OPTIONS)[number]['value']>();
    for (const doc of services) {
        const id = doc?._id?.toString?.();
        if (!id) continue;
        for (const opt of SERVICE_OPTIONS) {
            if (matchesServiceOption(doc, opt)) {
                byId.set(id, opt.value);
                break;
            }
        }
    }
    return byId;
}

/**
 * Demographics for users who joined in [dateFrom, dateTo) (same bounds as Activity snapshot).
 * Roles: expert + customer only. No status filter (matches dashboard people counts).
 */
export async function computeAdminDemographics(
    models: DemographicsModels,
    dateFrom: unknown,
    dateTo: unknown,
    now: Date = new Date(),
): Promise<DemographicsPayload> {
    const range = resolveSnapshotRange(dateFrom, dateTo, now);
    const filter: Record<string, unknown> = {
        role: { $in: ['expert', 'customer'] },
        ...createdAtFilter(range.from, range.to),
    };

    const [users, serviceDocs] = await Promise.all([
        models.User.find(filter).select('role country services').lean(),
        models.Service.find({}).lean(),
    ]);

    if (!users.length) return emptyPayload();

    const serviceById = mapServiceIdToCanonical(serviceDocs);
    const locationMap = new Map<string, { experts: number; students: number }>();
    const serviceCounts: Record<string, number> = Object.fromEntries(
        SERVICE_OPTIONS.map((o) => [o.value, 0]),
    );

    let experts = 0;
    let students = 0;
    let missingExpertLoc = 0;
    let missingStudentLoc = 0;
    let servicesMissing = 0;

    for (const user of users) {
        const isExpert = String(user.role || '').toLowerCase() === 'expert';
        const isStudent = String(user.role || '').toLowerCase() === 'customer';
        if (!isExpert && !isStudent) continue;

        if (isExpert) experts += 1;
        else students += 1;

        const country = normalizeCountry(user.country);
        if (!country) {
            if (isExpert) missingExpertLoc += 1;
            else missingStudentLoc += 1;
        } else {
            const row = locationMap.get(country) || { experts: 0, students: 0 };
            if (isExpert) row.experts += 1;
            else row.students += 1;
            locationMap.set(country, row);
        }

        if (isStudent) {
            const ids = Array.isArray(user.services) ? user.services : [];
            const canonicalHit = new Set<string>();
            let anyService = false;
            for (const raw of ids) {
                if (raw == null) continue;
                anyService = true;
                const id =
                    typeof raw === 'object' && raw !== null && 'toString' in raw
                        ? String((raw as { toString(): string }).toString())
                        : String(raw);
                const key = serviceById.get(id);
                if (key) canonicalHit.add(key);
            }
            if (!anyService || ids.length === 0) {
                servicesMissing += 1;
            } else {
                for (const key of canonicalHit) {
                    serviceCounts[key] = (serviceCounts[key] || 0) + 1;
                }
            }
        }
    }

    const locations = [...locationMap.entries()]
        .map(([country, counts]) => ({ country, ...counts }))
        .sort((a, b) => {
            const ta = a.experts + a.students;
            const tb = b.experts + b.students;
            if (tb !== ta) return tb - ta;
            return a.country.localeCompare(b.country);
        });

    const services = SERVICE_OPTIONS.map((o) => ({
        key: o.value,
        label: o.label,
        students: serviceCounts[o.value] || 0,
    })).sort((a, b) => b.students - a.students || a.label.localeCompare(b.label));

    return {
        totals: { experts, students },
        locations,
        locationMissing: { experts: missingExpertLoc, students: missingStudentLoc },
        services,
        servicesMissing,
    };
}
