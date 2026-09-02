import React, { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import { Search, Users } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { addParticipantsToCommunityChat, doFilterCustomers, getMyFollowers } from '../../../../api/api';
import { fetchGroupHistory } from '../../../../api/chatApi';
import { showErrorAlert, showSuccessAlert, showWarningAlert } from '../../../../actions/alertActions';
import { replaceChatMessages, setChatChannelInfo, setChosenGroupChatDetails } from '../../../../actions/chatActions';
import { updateMe } from '../../../../actions/authActions';
import Avatar from '../../../../components/Avatar';

type Row = { id: string; username: string; email: string; image?: string };

interface Props {
    open: boolean;
    onClose: () => void;
    groupDetails: any;
    theme?: 'dark' | 'light';
}

export default function AddCommunityMembersDialog({ open, onClose, groupDetails, theme = 'light' }: Props) {
    const dispatch = useDispatch();
    const friendsList = useSelector((state: any) => state.friends?.friends) as any[] | undefined;
    const myRole = useSelector((state: any) => state.auth?.userDetails?.role);
    const isExpert = String(myRole || '').toLowerCase() === 'expert';
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [rows, setRows] = useState<Row[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [followerIds, setFollowerIds] = useState<Set<string> | null>(null);
    const [followerSkipped, setFollowerSkipped] = useState(0);
    const [followersSelected, setFollowersSelected] = useState(false);
    const [loadingFollowers, setLoadingFollowers] = useState(false);
    const [followerNote, setFollowerNote] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);

    const gid = groupDetails?.groupId || groupDetails?._id;
    const existingIds = useMemo(() => {
        const ids = new Set<string>();
        (groupDetails?.participants || []).forEach((p: any) => {
            const id = String(p?._id ?? p?.id ?? p ?? '');
            if (id) ids.add(id);
        });
        const adm = groupDetails?.admin;
        if (adm && typeof adm === 'object' && adm._id) ids.add(String(adm._id));
        return ids;
    }, [groupDetails]);

    useEffect(() => {
        if (!open || !gid) return;
        let cancelled = false;
        setLoading(true);
        setSelected(new Set());
        setSearch('');
        setFollowerIds(null);
        setFollowerSkipped(0);
        setFollowersSelected(false);
        setFollowerNote(null);
        (async () => {
            try {
                const response: any = await doFilterCustomers({
                    username: '',
                    keywords: [],
                    services: [],
                    sortBy: 'Name in ASC',
                });
                if (cancelled) return;
                const all: Row[] = Array.isArray(response?.result)
                    ? response.result.map((c: any) => ({
                          id: String(c._id),
                          username: c.username || c.email,
                          email: c.email,
                          image: c.image,
                      }))
                    : [];
                setRows(all.filter((u) => !existingIds.has(u.id)));
            } catch {
                const fromFriends: Row[] = Array.isArray(friendsList)
                    ? friendsList.map((f: any) => ({
                          id: String(f._id ?? f.id),
                          username: f.username || f.email,
                          email: f.email,
                          image: f.image,
                      }))
                    : [];
                if (!cancelled) setRows(fromFriends.filter((u) => u.id && !existingIds.has(u.id)));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, gid, existingIds, friendsList]);

    const toggle = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(
            (r) =>
                r.username.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
        );
    }, [rows, search]);

    const toggleFollowers = async () => {
        if (followersSelected) {
            setFollowersSelected(false);
            setFollowerNote(null);
            if (followerIds) {
                setSelected((prev) => {
                    const next = new Set(prev);
                    followerIds.forEach((id) => next.delete(id));
                    return next;
                });
            }
            return;
        }
        let ids = followerIds;
        let skipped = followerSkipped;
        if (!ids) {
            setLoadingFollowers(true);
            try {
                const res: any = await getMyFollowers();
                const followers: any[] = Array.isArray(res?.result) ? res.result : [];
                const withId = followers
                    .map((f) => ({
                        id: String(f?._id ?? f?.id ?? ''),
                        username: f?.username || f?.email || '',
                        email: f?.email || '',
                        image: f?.image,
                    }))
                    .filter((f) => f.id);
                const addable = withId.filter((f) => !existingIds.has(f.id));
                skipped = withId.length - addable.length;
                setRows((prev) => {
                    const have = new Set(prev.map((r) => r.id));
                    const missing = addable.filter((f) => !have.has(f.id));
                    return missing.length ? [...prev, ...missing] : prev;
                });
                ids = new Set(addable.map((f) => f.id));
                setFollowerIds(ids);
                setFollowerSkipped(skipped);
            } catch (e: any) {
                dispatch(showErrorAlert('Could not load your followers.'));
                setLoadingFollowers(false);
                return;
            } finally {
                setLoadingFollowers(false);
            }
        }
        const skippedNote = skipped > 0
            ? ` ${skipped} already in this community ${skipped === 1 ? 'was' : 'were'} skipped.`
            : '';
        if (ids.size === 0) {
            setFollowerNote({
                tone: 'warn',
                text:
                    skipped > 0
                        ? 'All your followers are already in this community — nothing new to add.'
                        : 'No new followers to add.',
            });
        } else {
            setFollowerNote({
                tone: 'ok',
                text: `Selected ${ids.size} new follower${ids.size === 1 ? '' : 's'} to add.${skippedNote}`,
            });
        }
        const followerSet = ids;
        setSelected((prev) => {
            const next = new Set(prev);
            followerSet.forEach((id) => next.add(id));
            return next;
        });
        setFollowersSelected(true);
    };

    const handleAdd = async () => {
        if (!gid || selected.size === 0) {
            dispatch(showErrorAlert('Select at least one person to add.'));
            return;
        }
        setSubmitting(true);
        try {
            const res: any = await addParticipantsToCommunityChat({
                communityChatId: String(gid),
                participantIds: Array.from(selected),
            });
            if (res?.status === 'SUCCESS') {
                dispatch(showSuccessAlert('Members added.'));
                const added = rows.filter((r) => selected.has(r.id));
                const mergedParticipants = [
                    ...(groupDetails.participants || []),
                    ...added.map((r) => ({
                        _id: r.id,
                        username: r.username,
                        email: r.email,
                        image: r.image,
                    })),
                ];
                dispatch(
                    setChosenGroupChatDetails({
                        ...groupDetails,
                        participants: mergedParticipants,
                    }),
                );
                dispatch(updateMe() as any);
                const historyData = await fetchGroupHistory(String(gid), 0);
                if (historyData?.rcChannelId) {
                    dispatch(
                        setChatChannelInfo({
                            conversationId: null,
                            rcChannelId: String(historyData.rcChannelId),
                        }),
                    );
                }
                dispatch(
                    replaceChatMessages(Array.isArray(historyData?.messages) ? historyData.messages : []),
                );
                onClose();
                setSelected(new Set());
            } else {
                dispatch(showErrorAlert(res?.error || 'Could not add members'));
            }
        } catch (e: any) {
            dispatch(showErrorAlert(e?.response?.data?.error || e?.message || 'Could not add members'));
        } finally {
            setSubmitting(false);
        }
    };

    const paperClass = theme === 'light' ? 'rounded-2xl border border-slate-200 bg-white shadow-xl' : '';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{ className: paperClass }}
        >
            <div className="border-b border-slate-100 px-5 pt-5 pb-3">
                <h2 className="text-base font-semibold text-slate-900">Add members</h2>
                <p className="mt-1 text-sm text-slate-500">
                    Choose people to add to <span className="font-medium text-slate-700">{groupDetails?.groupName || groupDetails?.name}</span>.
                    They’ll get access to this community chat in Rocket.Chat.
                </p>
            </div>
            <div className="px-5 pt-3 pb-1">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search members by name or email…"
                        className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#234C6A] focus:ring-2 focus:ring-[#BCD6EA]"
                    />
                </div>
                {isExpert ? (
                    <label className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-xl px-1 py-1.5 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            checked={followersSelected}
                            disabled={loadingFollowers}
                            onChange={() => void toggleFollowers()}
                            className="h-4 w-4 rounded border-slate-300 text-[#234C6A]"
                        />
                        <Users className="h-4 w-4 text-[#234C6A]" />
                        <span className="font-medium">
                            {loadingFollowers ? 'Loading followers…' : 'Add followers'}
                        </span>
                    </label>
                ) : null}
                {isExpert ? (
                    <p className="mt-0.5 pl-1 text-xs text-slate-500">
                        Followers already in this community won’t be added again.
                    </p>
                ) : null}
                {followerNote ? (
                    <p
                        className={`mt-1.5 rounded-lg px-3 py-2 text-xs font-medium ${
                            followerNote.tone === 'ok'
                                ? 'bg-[#E8EEF4] text-[#234C6A]'
                                : 'bg-amber-50 text-amber-700'
                        }`}
                    >
                        {followerNote.text}
                    </p>
                ) : null}
            </div>
            <div className="max-h-[min(60vh,420px)] overflow-y-auto px-3 py-2">
                {loading ? (
                    <p className="px-2 py-6 text-center text-sm text-slate-500">Loading…</p>
                ) : rows.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-slate-500">No one to add.</p>
                ) : filteredRows.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-slate-500">No matches for “{search.trim()}”.</p>
                ) : (
                    <ul className="space-y-1">
                        {filteredRows.map((r) => {
                            const on = selected.has(r.id);
                            return (
                                <li key={r.id}>
                                    <button
                                        type="button"
                                        onClick={() => toggle(r.id)}
                                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                                            on ? 'bg-[#E8EEF4] ring-1 ring-[#BCD6EA]' : 'hover:bg-slate-50'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            readOnly
                                            checked={on}
                                            className="h-4 w-4 rounded border-slate-300 text-[#234C6A]"
                                        />
                                        <Avatar username={r.username} image={r.image} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-medium text-slate-900">{r.username}</span>
                                            <span className="block truncate text-xs text-slate-500">{r.email}</span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-[#234C6A] transition hover:bg-[#E8EEF4] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => void handleAdd()}
                    disabled={submitting || selected.size === 0}
                    className="rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-[1.03] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' }}
                >
                    {submitting ? 'Adding…' : 'Add'}
                </button>
            </div>
        </Dialog>
    );
}
