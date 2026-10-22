import { useEffect, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../store';
import { fetchDmUnreadSnapshot } from '../api/chatApi';
import { onSubscriptionChanged } from '../services/rcRealtime';
import { patchDmUnreadRid, setDmUnreadByRidBulk } from '../actions/chatActions';
import { updateMe } from '../actions/authActions';
import { adminDmUnread, isUnknownDmRoom, type AdminDmUnread } from '../utils/adminDmUnread';

export function useAdminDmUnread(enabled: boolean): AdminDmUnread {
    const dispatch = useDispatch();
    const directConversations = useAppSelector((s: any) => s.auth?.userDetails?.directConversations);
    const storeUnreadByRid = useAppSelector((s: any) => s.chat?.dmUnreadByRid);

    const conversationsRef = useRef(directConversations);
    useEffect(() => {
        conversationsRef.current = directConversations;
    }, [directConversations]);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        const hydrate = async () => {
            const snapshot = await fetchDmUnreadSnapshot();
            if (cancelled) return;
            dispatch(setDmUnreadByRidBulk(snapshot?.success && snapshot.unreadByRid ? snapshot.unreadByRid : {}));
        };
        const onVisible = () => {
            if (document.visibilityState === 'visible') void hydrate();
        };
        void hydrate();
        window.addEventListener('focus', hydrate);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            cancelled = true;
            window.removeEventListener('focus', hydrate);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [enabled, dispatch]);

    useEffect(() => {
        if (!enabled) return;
        let lastRefreshAt = 0;
        return onSubscriptionChanged(({ roomId, type, unread }) => {
            if (type && !['d', 'c', 'p'].includes(type)) return;
            const rid = String(roomId || '');
            if (!rid) return;
            const n = Number(unread || 0);
            dispatch(patchDmUnreadRid(rid, n));
            // A reply in a DM whose room id the loaded profile lacks would never be counted.
            if (type === 'd' && n > 0 && isUnknownDmRoom(conversationsRef.current, rid)) {
                const now = Date.now();
                if (now - lastRefreshAt < 3000) return;
                lastRefreshAt = now;
                dispatch(updateMe() as any);
            }
        });
    }, [enabled, dispatch]);

    return useMemo(
        () => (enabled ? adminDmUnread(directConversations, storeUnreadByRid) : { total: 0, bySection: {} }),
        [enabled, directConversations, storeUnreadByRid],
    );
}
