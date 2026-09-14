import { Request, Response } from 'express';
import { HTTP_GENERIC_ERROR, safeErrorMessage } from '../utils/httpUserFacingCopy';

const mongoose = require('mongoose');
const FeaturedExpert = require('../models/FeaturedExpert');
const { logAdminAction } = require('../utils/adminAudit');

export type FeaturedExpertType = 'academic' | 'industry';

export type PublicFeaturedExpert = {
    id: string;
    name: string;
    title: string;
    organization: string;
    type: FeaturedExpertType;
    photoUrl: string;
    order: number;
    active: boolean;
};

export const DEFAULT_FEATURED_EXPERTS = [
    {
        name: 'Dr. Bruce Wang',
        title: 'Professor of Transportation Engineering',
        organization: 'UC Berkeley',
        type: 'academic' as const,
        photoUrl: '',
        order: 0,
        active: true,
    },
    {
        name: 'Dr. Mei Chen',
        title: 'Associate Professor of Traffic Systems',
        organization: 'MIT',
        type: 'academic' as const,
        photoUrl: '',
        order: 1,
        active: true,
    },
    {
        name: 'Prof. James Okonkwo',
        title: 'Chair of Civil & Transportation',
        organization: 'Imperial College London',
        type: 'academic' as const,
        photoUrl: '',
        order: 2,
        active: true,
    },
    {
        name: 'Dr. Sarah Lindholm',
        title: 'Professor of Transit Planning',
        organization: 'KTH',
        type: 'academic' as const,
        photoUrl: '',
        order: 3,
        active: true,
    },
    {
        name: 'Priya Raman',
        title: 'Principal Transportation Planner',
        organization: 'AECOM',
        type: 'industry' as const,
        photoUrl: '',
        order: 4,
        active: true,
    },
    {
        name: 'Michael Torres',
        title: 'Director of Traffic Operations',
        organization: 'WSP',
        type: 'industry' as const,
        photoUrl: '',
        order: 5,
        active: true,
    },
    {
        name: 'Elena Vasquez',
        title: 'Senior Mobility Engineer',
        organization: 'Arup',
        type: 'industry' as const,
        photoUrl: '',
        order: 6,
        active: true,
    },
    {
        name: 'David Kim',
        title: 'Head of Intelligent Transportation',
        organization: 'HDR',
        type: 'industry' as const,
        photoUrl: '',
        order: 7,
        active: true,
    },
];

function trimStr(value: unknown): string {
    return String(value ?? '').trim();
}

export function parseExpertType(value: unknown): FeaturedExpertType | null {
    const t = trimStr(value).toLowerCase();
    if (t === 'academic' || t === 'industry') return t;
    return null;
}

export function toPublicExpert(raw: any): PublicFeaturedExpert | null {
    if (!raw) return null;
    const id = String(raw.id || raw._id || '').trim();
    const name = trimStr(raw.name);
    const title = trimStr(raw.title);
    const organization = trimStr(raw.organization);
    const type = parseExpertType(raw.type);
    if (!id || !name || !title || !organization || !type) return null;
    return {
        id,
        name,
        title,
        organization,
        type,
        photoUrl: trimStr(raw.photoUrl),
        order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : 0,
        active: raw.active !== false,
    };
}

export async function ensureFeaturedExpertsSeeded() {
    const count = await FeaturedExpert.countDocuments();
    if (count > 0) return;
    await FeaturedExpert.insertMany(DEFAULT_FEATURED_EXPERTS);
}

function invalidId(id: string) {
    return !mongoose.Types.ObjectId.isValid(id);
}

export const listPublicFeaturedExperts = async (_req: Request, res: Response) => {
    try {
        await ensureFeaturedExpertsSeeded();
        const rows = await FeaturedExpert.find({ active: true }).sort({ order: 1, createdAt: 1 }).lean();
        return res.json({
            experts: rows.map(toPublicExpert).filter(Boolean),
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};

export const listAdminFeaturedExperts = async (_req: Request, res: Response) => {
    try {
        await ensureFeaturedExpertsSeeded();
        const rows = await FeaturedExpert.find().sort({ order: 1, createdAt: 1 }).lean();
        return res.json({
            experts: rows.map(toPublicExpert).filter(Boolean),
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};

function readRequiredFields(body: any) {
    const name = trimStr(body?.name);
    const title = trimStr(body?.title);
    const organization = trimStr(body?.organization);
    const type = parseExpertType(body?.type);
    const errors: Record<string, string> = {};
    if (!name) errors.name = 'Name is required.';
    if (!title) errors.title = 'Title is required.';
    if (!organization) errors.organization = 'Organization is required.';
    if (!type) errors.type = 'Type must be Academic or Industry.';
    return { name, title, organization, type, photoUrl: trimStr(body?.photoUrl), errors };
}

export const createFeaturedExpert = async (req: Request, res: Response) => {
    try {
        const parsed = readRequiredFields(req.body);
        if (Object.keys(parsed.errors).length) {
            return res.status(400).json({ status: 'FAIL', errors: parsed.errors });
        }
        const last = await FeaturedExpert.findOne().sort({ order: -1 }).select('order').lean();
        const lastOrder = Number(last?.order);
        const nextOrder = last && Number.isFinite(lastOrder) ? lastOrder + 1 : 0;
        const created = await FeaturedExpert.create({
            name: parsed.name,
            title: parsed.title,
            organization: parsed.organization,
            type: parsed.type,
            photoUrl: parsed.photoUrl,
            order: nextOrder,
            active: req.body?.active === false ? false : true,
        });
        logAdminAction({
            actor: (req as any).user,
            action: 'create_featured_expert',
            targetType: 'featuredExpert',
            targetId: String(created._id),
            meta: { name: created.name },
        });
        return res.json({ result: 'SUCCESS', expert: toPublicExpert(created) });
    } catch (err) {
        console.error(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

export const updateFeaturedExpert = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id || '');
        if (invalidId(id)) {
            return res.status(400).json({ status: 'FAIL', error: 'Invalid expert id.' });
        }
        const parsed = readRequiredFields(req.body);
        if (Object.keys(parsed.errors).length) {
            return res.status(400).json({ status: 'FAIL', errors: parsed.errors });
        }
        const updated = await FeaturedExpert.findByIdAndUpdate(
            id,
            {
                name: parsed.name,
                title: parsed.title,
                organization: parsed.organization,
                type: parsed.type,
                photoUrl: parsed.photoUrl,
                ...(req.body?.active !== undefined ? { active: Boolean(req.body.active) } : {}),
            },
            { new: true },
        );
        if (!updated) {
            return res.status(404).json({ status: 'FAIL', error: 'Expert not found.' });
        }
        logAdminAction({
            actor: (req as any).user,
            action: 'update_featured_expert',
            targetType: 'featuredExpert',
            targetId: id,
        });
        return res.json({ result: 'SUCCESS', expert: toPublicExpert(updated) });
    } catch (err) {
        console.error(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

export const deleteFeaturedExpert = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id || '');
        if (invalidId(id)) {
            return res.status(400).json({ status: 'FAIL', error: 'Invalid expert id.' });
        }
        const deleted = await FeaturedExpert.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ status: 'FAIL', error: 'Expert not found.' });
        }
        logAdminAction({
            actor: (req as any).user,
            action: 'delete_featured_expert',
            targetType: 'featuredExpert',
            targetId: id,
            meta: { name: deleted.name },
        });
        return res.json({ result: 'SUCCESS' });
    } catch (err) {
        console.error(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

export const reorderFeaturedExpert = async (req: Request, res: Response) => {
    try {
        const id = trimStr(req.body?.id);
        const direction = trimStr(req.body?.direction).toLowerCase();
        if (invalidId(id) || (direction !== 'up' && direction !== 'down')) {
            return res.status(400).json({ status: 'FAIL', error: 'id and direction (up or down) are required.' });
        }
        const rows = await FeaturedExpert.find().sort({ order: 1, createdAt: 1 });
        const index = rows.findIndex((row: any) => String(row._id) === id);
        if (index < 0) {
            return res.status(404).json({ status: 'FAIL', error: 'Expert not found.' });
        }
        const swapWith = direction === 'up' ? index - 1 : index + 1;
        if (swapWith < 0 || swapWith >= rows.length) {
            return res.json({
                result: 'SUCCESS',
                experts: rows.map(toPublicExpert).filter(Boolean),
            });
        }
        const a = rows[index];
        const b = rows[swapWith];
        const tmp = a.order;
        a.order = b.order;
        b.order = tmp;
        await a.save();
        await b.save();
        logAdminAction({
            actor: (req as any).user,
            action: 'reorder_featured_expert',
            targetType: 'featuredExpert',
            targetId: id,
            meta: { direction },
        });
        const next = await FeaturedExpert.find().sort({ order: 1, createdAt: 1 }).lean();
        return res.json({
            result: 'SUCCESS',
            experts: next.map(toPublicExpert).filter(Boolean),
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

module.exports = {
    DEFAULT_FEATURED_EXPERTS,
    parseExpertType,
    toPublicExpert,
    ensureFeaturedExpertsSeeded,
    listPublicFeaturedExperts,
    listAdminFeaturedExperts,
    createFeaturedExpert,
    updateFeaturedExpert,
    deleteFeaturedExpert,
    reorderFeaturedExpert,
};
