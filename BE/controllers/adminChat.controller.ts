import { Response } from 'express';
import mongoose from 'mongoose';
import {
    kickUserFromGroupChannel,
    syncRocketGroupChannelMembers,
} from '../services/rocketchat.service';
import { safeErrorMessage } from '../utils/httpUserFacingCopy';
import {
    ADMIN_ROOM_TYPE,
    adminRoomBaseFilter,
    adminRoomNameFilter,
    collapseSeriesRooms,
    parseAdminRoomKind,
} from '../utils/adminChatAccess';

const GroupChat = require('../models/GroupChat');

const PERSON_FIELDS = 'email username image role status';
const SEARCH_LIMIT = 20;
const ROOM_TYPES = Object.values(ADMIN_ROOM_TYPE);

const idOf = (value: any): string => String(value?._id ?? value ?? '').trim();

const populateRoom = (query: any) =>
    query
        .populate('admin', PERSON_FIELDS)
        .populate('participants', PERSON_FIELDS)
        .populate('coModerators', PERSON_FIELDS)
        .populate('chatAdmins', PERSON_FIELDS)
        .populate('createdBy', PERSON_FIELDS)
        .populate('keywords')
        .populate('services');

const seriesFilter = (room: any) => (room?.seriesId ? { seriesId: room.seriesId } : { _id: room._id });

const channelKeyOf = (room: any): string => (room?.seriesId ? String(room.seriesId) : String(room._id));

const isMemberOf = (room: any, userId: string): boolean =>
    idOf(room?.admin) === userId
    || (room?.participants || []).some((p: any) => idOf(p) === userId)
    || (room?.coModerators || []).some((p: any) => idOf(p) === userId);

const withJoinFlags = (room: any, userId: string) => ({
    ...room,
    isJoined: true,
    participantCount: Array.isArray(room?.participants) ? room.participants.length : 0,
    joinedAsChatAdmin: (room?.chatAdmins || []).some((a: any) => idOf(a) === userId),
});

export const searchAdminChatRooms = async (req: any, res: Response) => {
    try {
        const userId = String(req.user?.userId ?? '');
        const kind = parseAdminRoomKind(req.query?.type);
        if (!kind) return res.status(400).json({ status: 'FAIL', error: 'type must be appointment, seminar or community' });
        const nameFilter = adminRoomNameFilter(req.query?.q);
        if (!nameFilter) return res.status(200).json({ status: 'SUCCESS', rooms: [] });

        const found = await GroupChat.find({ ...adminRoomBaseFilter(kind), ...nameFilter })
            .select('name type status start end seriesId admin participants coModerators chatAdmins rcChannelId titleLine description isOpenToAll')
            .populate('admin', 'username email')
            .populate('participants', 'username email')
            .sort({ start: 1, name: 1 })
            .limit(SEARCH_LIMIT * 5)
            .lean();

        const rooms = collapseSeriesRooms(found).slice(0, SEARCH_LIMIT).map((room: any) => ({
            _id: String(room._id),
            name: room.name,
            type: room.type,
            start: room.start ?? null,
            end: room.end ?? null,
            seriesId: room.seriesId ? String(room.seriesId) : null,
            titleLine: room.titleLine ?? '',
            isOpenToAll: Boolean(room.isOpenToAll),
            host: room.admin ? { _id: idOf(room.admin), username: room.admin.username, email: room.admin.email } : null,
            people: (room.participants || []).map((p: any) => ({ _id: idOf(p), username: p?.username, email: p?.email })),
            participantCount: (room.participants || []).length,
            joined: (room.chatAdmins || []).some((a: any) => idOf(a) === userId) || isMemberOf(room, userId),
        }));

        return res.status(200).json({ status: 'SUCCESS', rooms });
    } catch (err: any) {
        console.error('[adminChat.search]', err?.message);
        return res.status(500).json({ status: 'FAIL', error: safeErrorMessage(err) });
    }
};

export const listAdminChatRooms = async (req: any, res: Response) => {
    try {
        const userId = String(req.user?.userId ?? '');
        const rooms = await populateRoom(
            GroupChat.find({ chatAdmins: userId, status: 'active', type: { $in: ROOM_TYPES } }),
        ).lean();
        return res.status(200).json({
            status: 'SUCCESS',
            rooms: collapseSeriesRooms(rooms).map((room: any) => withJoinFlags(room, userId)),
        });
    } catch (err: any) {
        console.error('[adminChat.list]', err?.message);
        return res.status(500).json({ status: 'FAIL', error: safeErrorMessage(err) });
    }
};

export const joinAdminChatRoom = async (req: any, res: Response) => {
    try {
        const userId = String(req.user?.userId ?? '');
        const groupChatId = String(req.body?.groupChatId ?? '').trim();
        if (!mongoose.isValidObjectId(groupChatId)) {
            return res.status(400).json({ status: 'FAIL', error: 'groupChatId is required' });
        }
        const room = await GroupChat.findById(groupChatId)
            .select('type status seriesId admin participants rcChannelId')
            .populate('admin', 'email')
            .populate('participants', 'email')
            .lean();
        if (!room) return res.status(404).json({ status: 'FAIL', error: 'Chat not found' });
        if (room.status !== 'active' || !ROOM_TYPES.includes(room.type)) {
            return res.status(400).json({ status: 'FAIL', error: 'This chat is not available to join' });
        }

        await GroupChat.updateMany(seriesFilter(room), { $addToSet: { chatAdmins: userId } }, { timestamps: false }).exec();

        try {
            const emails = [
                ...(room.participants || []).map((p: any) => p?.email),
                room.admin?.email,
                req.user?.email,
            ].filter(Boolean).map((e: string) => String(e).toLowerCase());
            const rcChannelId = await syncRocketGroupChannelMembers(channelKeyOf(room), emails);
            if (rcChannelId && !room.rcChannelId) {
                await GroupChat.updateOne({ _id: room._id }, { $set: { rcChannelId } }, { timestamps: false }).exec();
            }
        } catch (rcErr: any) {
            console.warn('[adminChat.join] Rocket.Chat sync failed:', rcErr?.message);
        }

        const fresh = await populateRoom(GroupChat.findById(room._id)).lean();
        return res.status(200).json({ status: 'SUCCESS', room: withJoinFlags(fresh, userId) });
    } catch (err: any) {
        console.error('[adminChat.join]', err?.message);
        return res.status(500).json({ status: 'FAIL', error: safeErrorMessage(err) });
    }
};

export const leaveAdminChatRoom = async (req: any, res: Response) => {
    try {
        const userId = String(req.user?.userId ?? '');
        const groupChatId = String(req.body?.groupChatId ?? '').trim();
        if (!mongoose.isValidObjectId(groupChatId)) {
            return res.status(400).json({ status: 'FAIL', error: 'groupChatId is required' });
        }
        const room = await GroupChat.findById(groupChatId)
            .select('seriesId admin participants coModerators rcChannelId')
            .lean();
        if (!room) return res.status(404).json({ status: 'FAIL', error: 'Chat not found' });

        await GroupChat.updateMany(seriesFilter(room), { $pull: { chatAdmins: userId } }, { timestamps: false }).exec();

        if (room.rcChannelId && req.user?.email && !isMemberOf(room, userId)) {
            try {
                await kickUserFromGroupChannel(String(room.rcChannelId), String(req.user.email));
            } catch (rcErr: any) {
                console.warn('[adminChat.leave] Rocket.Chat kick failed:', rcErr?.message);
            }
        }
        return res.status(200).json({ status: 'SUCCESS' });
    } catch (err: any) {
        console.error('[adminChat.leave]', err?.message);
        return res.status(500).json({ status: 'FAIL', error: safeErrorMessage(err) });
    }
};
