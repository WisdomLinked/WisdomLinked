import React, { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import { useDispatch, useSelector } from 'react-redux';
import { addParticipantsToCommunityChat, doFilterCustomers } from '../../../../api/api';
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
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [rows, setRows] = useState<Row[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());

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
            <div className="max-h-[min(60vh,420px)] overflow-y-auto px-3 py-2">
                {loading ? (
                    <p className="px-2 py-6 text-center text-sm text-slate-500">Loading…</p>
                ) : rows.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-slate-500">No one to add.</p>
                ) : (
                    <ul className="space-y-1">
                        {rows.map((r) => {
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
