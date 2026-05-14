import { Request, Response, NextFunction } from 'express';
import { verifyMeetingChatToken } from '../utils/meetingChatSyncToken';

const { requireAuth } = require('./requireAuth');

/**
 * Allows `POST /api/meeting/chat-sync` with either:
 * - `Authorization: Bearer <meeting-chat JWT>` (Jitsi tab, cross-origin), or
 * - WisdomLinked session cookie via `requireAuth(false)`.
 */
export const meetingChatSyncGate = (req: Request, res: Response, next: NextFunction) => {
    const auth = String(req.headers.authorization || '').trim();
    if (auth.toLowerCase().startsWith('bearer ')) {
        const raw = auth.slice(7).trim();
        if (!raw) {
            return res.status(401).json({ error: 'Invalid meeting chat token' });
        }
        const claims = verifyMeetingChatToken(raw);
        if (!claims) {
            return res.status(401).json({ error: 'Invalid or expired meeting chat token' });
        }
        (req as any).meetingChatClaims = claims;
        return next();
    }
    return requireAuth(false)(req, res, next);
};
