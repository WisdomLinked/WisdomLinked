import React, { useState } from "react";
import { formatDateYYYY_MM_DD_h_m } from "../../actions/common";
import Avatar from "../../components/Avatar";
import GroupParticipantsDialog from "./Messenger/Messages/GroupParticipantsDialog";
import { useAppSelector } from "../../store";
import { Calendar, Clock3, DollarSign, Users, Sparkles, UserRound } from "lucide-react";

interface SeminarDetailsProps {
    title: string;
    description?: string;
    start?: string;
    duration?: number;
    price?: number;
    admin: any;
    participants: any[];
    keywords?: any[];
    services?: any[];
    type?: string;
    createdAt?: string;
    canDeleteCommunityChat?: boolean;
    onDeleteCommunityChat?: () => void;
    theme?: "light" | "dark";
}

const SeminarDetails = ({
    title,
    description,
    start,
    duration,
    price, 
    admin,
    participants,
    keywords,
    services,
    type,
    createdAt,
    canDeleteCommunityChat = false,
    onDeleteCommunityChat,
    theme = "dark",
}: SeminarDetailsProps) => {

    const [showParticipants, set_showParticipants] = useState(false);
    const { auth: { userDetails } } = useAppSelector((state) => state);
    const isCommunityChat = type === "community";
    const isLight = theme === "light";
    const participantCount = Math.max((participants?.length || 0) - 1, 0);

    return (
        <div className={`w-full ${isLight ? "text-slate-900" : "text-white"}`}>
            <div className="space-y-4">
                <div className={`rounded-xl border p-4 ${isLight ? "border-slate-200 bg-slate-50/70" : "border-slate-700 bg-[#141414]"}`}>
                    <div className="text-xl font-bold">{title}</div>
                    <div className={`mt-1 text-sm leading-relaxed ${isLight ? "text-slate-600" : "text-lightgrey"}`}>
                        {description || "No description provided."}
                    </div>
                </div>

                {!isCommunityChat ? (
                    <div className={`rounded-xl border p-4 ${isLight ? "border-slate-200 bg-white" : "border-slate-700 bg-[#141414]"}`}>
                        <div className={`mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] ${isLight ? "text-[#234C6A]" : "text-slate-300"}`}>
                            <Calendar className="h-3.5 w-3.5" />
                            Session info
                        </div>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                                <Calendar className={`h-4 w-4 ${isLight ? "text-slate-500" : "text-slate-400"}`} />
                                <span className={isLight ? "text-slate-700" : "text-slate-300"}>{start ? formatDateYYYY_MM_DD_h_m(start) : "N/A"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock3 className={`h-4 w-4 ${isLight ? "text-slate-500" : "text-slate-400"}`} />
                                <span className={isLight ? "text-slate-700" : "text-slate-300"}>{duration ?? 0} min</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <DollarSign className={`h-4 w-4 ${isLight ? "text-slate-500" : "text-slate-400"}`} />
                                <span className={isLight ? "text-slate-700" : "text-slate-300"}>${price ?? 0}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={`rounded-xl border p-4 ${isLight ? "border-slate-200 bg-white" : "border-slate-700 bg-[#141414]"}`}>
                        <div className={`mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] ${isLight ? "text-[#234C6A]" : "text-slate-300"}`}>
                            <Sparkles className="h-3.5 w-3.5" />
                            Community info
                        </div>
                        <div className={`text-sm ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                            Created on: {createdAt ? formatDateYYYY_MM_DD_h_m(createdAt) : "N/A"}
                        </div>
                        {canDeleteCommunityChat && onDeleteCommunityChat && (
                            <button
                                className={`mt-4 w-full font-semibold py-2.5 rounded-xl transition ${
                                    isLight
                                        ? "bg-rose-600 text-white hover:bg-rose-700"
                                        : "bg-rose-700 text-white hover:bg-rose-800"
                                }`}
                                onClick={onDeleteCommunityChat}
                            >
                                Delete Community Chat
                            </button>
                        )}
                    </div>
                )}

                {(keywords?.length || services?.length) ? (
                    <div className={`rounded-xl border p-4 ${isLight ? "border-slate-200 bg-white" : "border-slate-700 bg-[#141414]"}`}>
                        <div className={`mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] ${isLight ? "text-[#234C6A]" : "text-slate-300"}`}>
                            <Sparkles className="h-3.5 w-3.5" />
                            Interests
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {(keywords || []).map((keyword: any) => (
                                <span
                                    key={keyword._id || keyword.value}
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                        isLight
                                            ? "border border-slate-200 bg-[#E8EEF4] text-[#234C6A]"
                                            : "border border-slate-700 bg-slate-800 text-slate-200"
                                    }`}
                                >
                                    {keyword.value}
                                </span>
                            ))}
                            {(services || []).map((service: any) => (
                                <span
                                    key={service._id || service.value}
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                        isLight
                                            ? "border border-slate-200 bg-slate-100 text-slate-700"
                                            : "border border-slate-700 bg-slate-800 text-slate-200"
                                    }`}
                                >
                                    {service.value}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : null}

                <div className={`rounded-xl border p-4 ${isLight ? "border-slate-200 bg-white" : "border-slate-700 bg-[#141414]"}`}>
                    <div className={`mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] ${isLight ? "text-[#234C6A]" : "text-slate-300"}`}>
                        <UserRound className="h-3.5 w-3.5" />
                        Admin
                    </div>
                    <div className="flex space-x-3 items-center">
                        <Avatar username={admin?.username || "Admin"} isOnline={false} image={admin?.image} />
                        <div className="min-w-0">
                            <div className="text-base font-semibold truncate">{admin?.username || "Unknown"}</div>
                            <div className={`text-sm truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>{admin?.email || "N/A"}</div>
                        </div>
                    </div>
                </div>

                <div className={`rounded-xl border p-4 ${isLight ? "border-slate-200 bg-white" : "border-slate-700 bg-[#141414]"}`}>
                    <div className={`mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] ${isLight ? "text-[#234C6A]" : "text-slate-300"}`}>
                        <Users className="h-3.5 w-3.5" />
                        Participants ({participantCount})
                    </div>
                    {(participants?.length || 0) > 1 ? (
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex -space-x-3">
                                {participants.slice(1, 5).map((participant: any, index: number) => (
                                    <div
                                        key={participant._id || index}
                                        className={`rounded-full ${isLight ? "bg-white" : "bg-black"}`}
                                        style={{ zIndex: 20 - index }}
                                    >
                                        <Avatar username={participant.username} isOnline={false} image={participant.image} />
                                    </div>
                                ))}
                            </div>
                            <button
                                className={`font-semibold text-sm ${isLight ? "text-[#234C6A] hover:text-[#1b3c53]" : "text-green hover:opacity-80"}`}
                                onClick={() => set_showParticipants(true)}
                            >
                                View All
                            </button>
                        </div>
                    ) : (
                        <div className={`text-sm ${isLight ? "text-slate-500" : "text-grey"}`}>No participants</div>
                    )}
                </div>
            </div>

            <GroupParticipantsDialog
                isDialogOpen={showParticipants}
                closeDialogHandler={() => set_showParticipants(false)}
                groupDetails={{
                    groupName: title,
                    participants: participants,
                    admin: participants[0],
                    type,
                }}
                currentUserId={userDetails._id}
                currentUserRole={userDetails?.role}
                theme={theme}
            />
        </div>
    );
};

export default SeminarDetails;
