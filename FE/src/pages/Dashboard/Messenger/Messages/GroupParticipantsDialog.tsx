import React, { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Avatar from "../../../../components/Avatar";
import { Crown, Mail, UserMinus, Users, X } from "lucide-react";
import { useDispatch } from "react-redux";
import { removeCommunityMember } from "../../../../api/api";
import { showErrorAlert, showSuccessAlert, showWarningAlert } from '../../../../actions/alertActions';
import { setChosenGroupChatDetails } from "../../../../actions/chatActions";
import { updateMe } from "../../../../actions/authActions";

interface Props {
    isDialogOpen: boolean;
    closeDialogHandler: () => void;
    groupDetails: any;
    currentUserId: string;
    currentUserRole?: string;
    theme?: "light" | "dark";
    resolvedImages?: Map<string, string>;
}

const GroupParticipantsDialog = ({
    isDialogOpen,
    closeDialogHandler,
    groupDetails,
    currentUserId,
    theme = "light",
    resolvedImages,
}: Props) => {
    const dispatch = useDispatch();
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [removeReasonOpen, setRemoveReasonOpen] = useState(false);
    const [removeReason, setRemoveReason] = useState("");
    const [pendingRemoveMemberId, setPendingRemoveMemberId] = useState<string | null>(null);
    const [pendingRemoveMemberName, setPendingRemoveMemberName] = useState<string>("");
    const handleCloseDialog = () => {
        closeDialogHandler();
    };

    const isLight = theme === "light";
    const adminId =
        typeof groupDetails?.admin === "string"
            ? groupDetails.admin
            : groupDetails?.admin?._id || groupDetails?.admin?.id;
    const isCommunity = groupDetails?.type === "community";
    const coModeratorIds = new Set(
        (groupDetails?.coModerators || []).map((c: any) => String(c?._id ?? c?.id ?? c)).filter(Boolean),
    );
    const canManageMembers = isCommunity && (
        String(adminId || "") === String(currentUserId || "")
        || coModeratorIds.has(String(currentUserId || ""))
    );
    const handleRemove = async (memberUserId: string, reason: string) => {
        const gid = String(groupDetails?.groupId || groupDetails?._id || "");
        if (!gid || !memberUserId) return;
        setRemovingId(memberUserId);
        try {
            const res: any = await removeCommunityMember(gid, memberUserId, reason);
            if (res?.success) {
                const nextParticipants = (groupDetails?.participants || []).filter(
                    (p: any) => String(p?._id ?? p?.id ?? p) !== String(memberUserId),
                );
                dispatch(
                    setChosenGroupChatDetails({
                        ...groupDetails,
                        participants: nextParticipants,
                    }),
                );
                dispatch(showSuccessAlert("Member removed from the community"));
                dispatch(updateMe() as any);
            } else {
                dispatch(showErrorAlert(res?.error || "Could not remove member"));
            }
        } catch (e: any) {
            dispatch(showErrorAlert(e?.response?.data?.error || e?.message || "Could not remove member"));
        } finally {
            setRemovingId(null);
        }
    };

    const openRemoveReasonDialog = (memberUserId: string, username: string) => {
        setPendingRemoveMemberId(memberUserId);
        setPendingRemoveMemberName(username || "this user");
        setRemoveReason("");
        setRemoveReasonOpen(true);
    };

    const confirmRemoveWithReason = async () => {
        if (!pendingRemoveMemberId) return;
        const reason = removeReason.trim();
        if (!reason) return;
        setRemoveReasonOpen(false);
        const memberId = pendingRemoveMemberId;
        setPendingRemoveMemberId(null);
        await handleRemove(memberId, reason);
    };
    const paperClass = isLight
        ? "rounded-2xl border border-slate-200 bg-white shadow-2xl"
        : "rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl";

    return (
        <div>
            <Dialog
                open={isDialogOpen}
                onClose={handleCloseDialog}
                maxWidth="sm"
                fullWidth
                PaperProps={{ className: paperClass }}
            >
                <div className={`border-b px-5 pt-5 pb-3 ${isLight ? "border-slate-100" : "border-slate-700"}`}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className={`text-base font-semibold ${isLight ? "text-slate-900" : "text-slate-100"}`}>
                                {groupDetails.groupName}
                            </h2>
                            <p className={`mt-1 text-sm ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                {groupDetails.participants.length}{" "}
                                {groupDetails.participants.length > 1 ? "participants" : "participant"}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleCloseDialog}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${isLight ? "text-slate-500 hover:bg-slate-100 hover:text-slate-800" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
                            aria-label="Close participants"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <DialogContent className="px-4 pb-4 pt-3">
                    <div className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${isLight ? "bg-[#E8EEF4] text-[#234C6A]" : "bg-slate-800 text-slate-200"}`}>
                        <Users className="h-3.5 w-3.5" />
                        Members
                    </div>
                    <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                        {(groupDetails.participants || []).map((participant: any) => {
                            const pid = String(participant?._id ?? participant?.id ?? "");
                            const isMe = pid === String(currentUserId);
                            const isAdmin = pid === String(adminId || "");
                            const isCoModerator = coModeratorIds.has(pid);
                            const canRemove = canManageMembers && !isMe && !isAdmin;
                            return (
                                <div
                                    key={pid}
                                    className={`rounded-xl border px-3 py-2.5 ${isLight ? "border-slate-200 bg-white" : "border-slate-700 bg-slate-800/70"}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <Avatar
                                            username={participant.username}
                                            image={
                                                (typeof participant.image === "string"
                                                    ? resolvedImages?.get(participant.image.trim())
                                                    : undefined) ?? participant.image
                                            }
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <p className={`truncate text-sm font-semibold ${isLight ? "text-slate-900" : "text-slate-100"}`}>
                                                    {participant.username}
                                                </p>
                                                {isMe ? (
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isLight ? "bg-sky-50 text-sky-700 border border-sky-200" : "bg-sky-900/50 text-sky-200 border border-sky-700"}`}>
                                                        You
                                                    </span>
                                                ) : null}
                                                {isAdmin ? (
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isLight ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-amber-900/40 text-amber-200 border border-amber-700"}`}>
                                                        <Crown className="h-3 w-3" />
                                                        Admin
                                                    </span>
                                                ) : null}
                                                {!isAdmin && isCoModerator ? (
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isLight ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-indigo-900/40 text-indigo-200 border border-indigo-700"}`}>
                                                        Co-moderator
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className={`mt-1 flex items-center gap-1.5 text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                                <Mail className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">{participant.email}</span>
                                            </div>
                                        </div>
                                        {canRemove ? (
                                            <button
                                                type="button"
                                                disabled={removingId === pid}
                                                onClick={() => openRemoveReasonDialog(pid, participant.username)}
                                                className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                                                    isLight
                                                        ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                                        : "border border-rose-700 bg-rose-900/30 text-rose-200 hover:bg-rose-900/50"
                                                } disabled:opacity-60`}
                                            >
                                                <UserMinus className="h-3.5 w-3.5" />
                                                {removingId === pid ? "Removing..." : "Remove"}
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog
                open={removeReasonOpen}
                onClose={() => setRemoveReasonOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Decline participant from call?</DialogTitle>
                <DialogContent>
                    <p className="text-sm text-slate-600 mb-3">
                        {`The following message will be sent to ${pendingRemoveMemberName}:`}
                    </p>
                    <textarea
                        value={removeReason}
                        onChange={(e) => setRemoveReason(e.target.value)}
                        rows={4}
                        placeholder="Reason (e.g., being disruptive, unpaid seminar, stranger account)"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                        {`The expert declined you from participating in the video call because ${removeReason.trim() || "[reason]"}. Later communication with you will ensue when needed.`}
                    </p>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRemoveReasonOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        disabled={!removeReason.trim()}
                        onClick={() => void confirmRemoveWithReason()}
                    >
                        Remove participant
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default GroupParticipantsDialog;
