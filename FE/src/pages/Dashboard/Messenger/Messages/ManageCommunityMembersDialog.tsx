import React, { Fragment, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Button from '@mui/material/Button';
import Avatar from '../../../../components/Avatar';
import { removeCommunityMember, setCommunityCoModerator } from '../../../../api/api';
import { useDispatch } from 'react-redux';
import { showAlert } from '../../../../actions/alertActions';
import { setChosenGroupChatDetails } from '../../../../actions/chatActions';
import { updateMe } from '../../../../actions/authActions';

interface Props {
    isDialogOpen: boolean;
    closeDialogHandler: () => void;
    groupDetails: any;
    currentUserId: string;
    theme?: 'light' | 'dark';
}

const ManageCommunityMembersDialog = ({
    isDialogOpen,
    closeDialogHandler,
    groupDetails,
    currentUserId,
    theme = 'light',
}: Props) => {
    const dispatch = useDispatch();
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [savingCoModId, setSavingCoModId] = useState<string | null>(null);

    const adminId =
        typeof groupDetails?.admin === 'string'
            ? groupDetails.admin
            : groupDetails?.admin?._id || groupDetails?.admin?.id;
    const gid = groupDetails?.groupId || groupDetails?._id;
    const isAdmin = String(adminId || '') === String(currentUserId || '');
    const coModeratorIds = new Set(
        (groupDetails?.coModerators || []).map((c: any) => String(c?._id ?? c?.id ?? c)).filter(Boolean),
    );

    const handleCoModeratorToggle = async (memberUserId: string, isCoModerator: boolean) => {
        if (!gid || !isAdmin) return;
        setSavingCoModId(memberUserId);
        try {
            const res: any = await setCommunityCoModerator(String(gid), String(memberUserId), isCoModerator);
            if (res?.success) {
                dispatch(
                    setChosenGroupChatDetails({
                        ...groupDetails,
                        coModerators: Array.isArray(res?.coModerators) ? res.coModerators : [],
                    }),
                );
                dispatch(showAlert(isCoModerator ? 'Co-moderator granted' : 'Co-moderator revoked'));
                dispatch(updateMe() as any);
            } else {
                dispatch(showAlert(res?.error || 'Could not update co-moderator'));
            }
        } catch (e: any) {
            dispatch(showAlert(e?.response?.data?.error || e?.message || 'Could not update co-moderator'));
        } finally {
            setSavingCoModId(null);
        }
    };

    const handleRemove = async (memberUserId: string) => {
        if (!gid) return;
        setRemovingId(memberUserId);
        try {
            const res: any = await removeCommunityMember(String(gid), String(memberUserId));
            if (res?.success) {
                const next = (groupDetails.participants || []).filter(
                    (p: any) => String(p._id ?? p) !== String(memberUserId),
                );
                dispatch(
                    setChosenGroupChatDetails({
                        ...groupDetails,
                        participants: next,
                    }),
                );
                dispatch(showAlert('Member removed from the community'));
                dispatch(updateMe() as any);
            } else {
                dispatch(showAlert(res?.error || 'Could not remove member'));
            }
        } catch (e: any) {
            dispatch(showAlert(e?.response?.data?.error || e?.message || 'Could not remove member'));
        } finally {
            setRemovingId(null);
        }
    };

    const paperClass =
        theme === 'light' ? 'rounded-2xl border border-slate-200 bg-white shadow-xl' : '';

    return (
        <Dialog
            open={isDialogOpen}
            onClose={closeDialogHandler}
            maxWidth="xs"
            fullWidth
            PaperProps={{ className: paperClass }}
        >
            <div className="border-b border-slate-100 px-5 pt-5 pb-3">
                <h2 className="text-base font-semibold text-slate-900">Remove members</h2>
                <p className="mt-1 text-sm text-slate-500">
                    {groupDetails?.groupName || groupDetails?.name} — remove someone from this community. A short notice
                    appears in chat.
                </p>
            </div>
            <DialogContent className="px-2 pb-4 pt-2">
                <List sx={{ width: '100%', pt: 0 }}>
                    {(groupDetails?.participants || []).map((participant: any) => {
                        const pid = String(participant._id ?? participant.id ?? '');
                        const isSelf = pid === String(currentUserId);
                        const isAdminMember = adminId && pid === String(adminId);
                        const isCoModerator = coModeratorIds.has(pid);
                        const canRemove = !isSelf && !isAdminMember && pid;
                        return (
                            <Fragment key={pid}>
                                <ListItem
                                    alignItems="flex-start"
                                    className="rounded-xl"
                                    secondaryAction={
                                        canRemove ? (
                                            <div className="flex items-center gap-2">
                                                {isAdmin ? (
                                                    <Button
                                                        size="small"
                                                        color="inherit"
                                                        disabled={savingCoModId === pid}
                                                        onClick={() => void handleCoModeratorToggle(pid, !isCoModerator)}
                                                    >
                                                        {savingCoModId === pid
                                                            ? '…'
                                                            : isCoModerator
                                                              ? 'Revoke Co-mod'
                                                              : 'Make Co-mod'}
                                                    </Button>
                                                ) : null}
                                                <Button
                                                    size="small"
                                                    color="error"
                                                    disabled={removingId === pid}
                                                    onClick={() => void handleRemove(pid)}
                                                >
                                                    {removingId === pid ? '…' : 'Remove'}
                                                </Button>
                                            </div>
                                        ) : null
                                    }
                                >
                                    <ListItemAvatar>
                                        <Avatar
                                            username={participant.username}
                                            image={participant.image}
                                        />
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={`${participant.username} ${isSelf ? '(You)' : ''}`}
                                        secondary={
                                            <span className="text-sm text-slate-600">
                                                {participant.email}
                                                {isAdminMember ? ' — Community admin' : ''}
                                                {!isAdminMember && isCoModerator ? ' — Co-moderator' : ''}
                                            </span>
                                        }
                                    />
                                </ListItem>
                            </Fragment>
                        );
                    })}
                </List>
            </DialogContent>
        </Dialog>
    );
};

export default ManageCommunityMembersDialog;
