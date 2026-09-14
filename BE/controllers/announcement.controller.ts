import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { HTTP_GENERIC_ERROR, safeErrorMessage } from '../utils/httpUserFacingCopy';

const AppState = require('../models/AppState');
const { logAdminAction } = require('../utils/adminAudit');

export type PublicAnnouncement = {
    id: string;
    message: string;
    link: string;
    linkLabel: string;
    active: boolean;
};

function trimStr(value: unknown): string {
    return String(value ?? '').trim();
}

export function toPublicAnnouncement(raw: unknown): PublicAnnouncement | null {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;
    if (rec.active !== true) return null;
    const id = trimStr(rec.id);
    const message = trimStr(rec.message);
    if (!id || !message) return null;
    return {
        id,
        message,
        link: trimStr(rec.link),
        linkLabel: trimStr(rec.linkLabel),
        active: true,
    };
}

export const getActiveAnnouncement = async (_req: Request, res: Response) => {
    try {
        const appState = await AppState.findOne().select('announcement').lean();
        return res.json(toPublicAnnouncement(appState?.announcement) || null);
    } catch (err) {
        console.error(err);
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};

export const setAnnouncement = async (req: Request, res: Response) => {
    try {
        const isActive = Boolean(req.body?.active);
        const message = trimStr(req.body?.message);
        const link = trimStr(req.body?.link);
        const linkLabel = trimStr(req.body?.linkLabel);

        if (isActive && !message) {
            return res.status(400).json({
                status: 'FAIL',
                error: 'Announcement message is required.',
            });
        }

        let appState = await AppState.findOne();
        if (!appState) {
            appState = await AppState.create({});
        }

        const previous = appState.announcement
            ? {
                  id: trimStr(appState.announcement.id),
                  active: Boolean(appState.announcement.active),
              }
            : null;

        if (isActive) {
            appState.announcement = {
                id: randomUUID(),
                message,
                link,
                linkLabel,
                active: true,
            };
        } else {
            const existing = appState.announcement || {};
            appState.announcement = {
                id: trimStr(existing.id),
                message: message || trimStr(existing.message),
                link: req.body?.link !== undefined ? link : trimStr(existing.link),
                linkLabel: req.body?.linkLabel !== undefined ? linkLabel : trimStr(existing.linkLabel),
                active: false,
            };
        }

        await appState.save();

        logAdminAction({
            actor: (req as any).user,
            action: 'set_announcement',
            targetType: 'appState',
            meta: {
                from: previous,
                to: {
                    id: trimStr(appState.announcement?.id),
                    active: Boolean(appState.announcement?.active),
                },
            },
        });

        const publicAnnouncement = toPublicAnnouncement(appState.announcement);
        return res.json({
            result: 'SUCCESS',
            announcement: publicAnnouncement || {
                id: trimStr(appState.announcement?.id),
                message: trimStr(appState.announcement?.message),
                link: trimStr(appState.announcement?.link),
                linkLabel: trimStr(appState.announcement?.linkLabel),
                active: false,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

module.exports = {
    toPublicAnnouncement,
    getActiveAnnouncement,
    setAnnouncement,
};
