import { describe, expect, it } from 'vitest';
import { chatReducer } from './chatReducer';
import { actionTypes } from '../actions/types';

describe('chatReducer', () => {
    it('replaces unread map with positive values only', () => {
        const next = chatReducer(undefined as any, {
            type: actionTypes.setDmUnreadByRidBulk,
            payload: {
                rid1: 2,
                rid2: 0,
                rid3: -4,
            },
        } as any);

        expect(next.dmUnreadByRid).toEqual({ rid1: 2 });
    });

    it('patches single room unread count and removes when zero', () => {
        const withUnread = chatReducer(undefined as any, {
            type: actionTypes.patchDmUnreadRid,
            payload: { rid: 'room-1', unread: 3 },
        } as any);
        expect(withUnread.dmUnreadByRid).toEqual({ 'room-1': 3 });

        const cleared = chatReducer(withUnread as any, {
            type: actionTypes.patchDmUnreadRid,
            payload: { rid: 'room-1', unread: 0 },
        } as any);
        expect(cleared.dmUnreadByRid).toEqual({});
    });

    it('resetChat clears the active thread but keeps unread counts', () => {
        const state = chatReducer(undefined as any, {
            type: actionTypes.patchDmUnreadRid,
            payload: { rid: 'room-2', unread: 4 },
        } as any);
        const reset = chatReducer(state as any, { type: actionTypes.resetChat } as any);
        expect(reset.messages).toEqual([]);
        expect(reset.chosenChatDetails).toBeNull();
        expect(reset.chosenGroupChatDetails).toBeNull();
        expect(reset.dmUnreadByRid).toEqual({ 'room-2': 4 });
    });

    it('a room read after hydration stays cleared across a resetChat', () => {
        let state = chatReducer(undefined as any, {
            type: actionTypes.setDmUnreadByRidBulk,
            payload: { 'room-a': 3, 'room-b': 2 },
        } as any);

        state = chatReducer(state as any, {
            type: actionTypes.clearDmUnreadRid,
            payload: 'room-a',
        } as any);
        expect(state.dmUnreadByRid).toEqual({ 'room-b': 2 });

        state = chatReducer(state as any, {
            type: actionTypes.clearDmUnreadRid,
            payload: 'room-b',
        } as any);
        expect(state.dmUnreadByRid).toEqual({});

        state = chatReducer(state as any, { type: actionTypes.resetChat } as any);
        expect(state.dmUnreadByRid).toEqual({});
    });
});

