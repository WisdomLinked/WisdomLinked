import React, { useEffect, useRef, useState } from "react";
import { formatDateYYYY_MM_DD_h_m } from "../../actions/common";
import Avatar from "../../components/Avatar";
import GroupParticipantsDialog from "./Messenger/Messages/GroupParticipantsDialog";
import { useAppSelector } from "../../store";
import { Calendar, Clock3, DollarSign, Users, Sparkles, UserRound, Repeat } from "lucide-react";
import { SERVICE_OPTIONS, matchesServiceOption } from "../../constants/serviceOptions";
import { resolveProfileImageSrc } from "../../utils/profileImage";
import { profileImageFetch } from "../../api/api";

const RECURRENCE_LABEL: Record<string, string> = {
    weekly: "Weekly",
    biweekly: "Biweekly",
    monthly: "Monthly",
};

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
    purposeOther?: string;
    type?: string;
    createdAt?: string;
    isRecurring?: boolean;
    recurrenceFrequency?: string;
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
    purposeOther,
    type,
    createdAt,
    isRecurring,
    recurrenceFrequency,
    canDeleteCommunityChat = false,
    onDeleteCommunityChat,
    theme = "dark",
}: SeminarDetailsProps) => {
    const recurrenceLabel =
        isRecurring && recurrenceFrequency ? RECURRENCE_LABEL[recurrenceFrequency] : undefined;

    const serviceChipLabel = (service: any): string => {
        const doc = { value: service?.value, name: service?.name, label: service?.label };
        for (const opt of SERVICE_OPTIONS) {
            if (matchesServiceOption(doc, opt)) return opt.label;
        }
        return String(service?.value ?? service?.label ?? "");
    };

    const [showParticipants, set_showParticipants] = useState(false);
    const { auth: { userDetails } } = useAppSelector((state) => state);
    const isCommunityChat = type === "community";
    const isLight = theme === "light";
    const participantCount = Math.max((participants?.length || 0) - 1, 0);

    const [resolvedImages, setResolvedImages] = useState<Map<string, string>>(new Map());
    const imageCacheRef = useRef(new Map<string, string>());

    useEffect(() => {
        let cancelled = false;
        const people = [admin, ...(participants || [])].filter(Boolean);
        const needed = new Map<string, string>();
        for (const person of people) {
            const ref = typeof person?.image === "string" ? person.image.trim() : "";
            if (ref && !imageCacheRef.current.has(ref)) needed.set(ref, ref);
        }
        if (needed.size === 0) return;

        void Promise.all(
            Array.from(needed.keys()).map(async (ref) => {
                const resolved = await resolveProfileImageSrc(ref, "small", profileImageFetch as any);
                if (resolved) imageCacheRef.current.set(ref, resolved);
            }),
        ).then(() => {
            if (!cancelled) setResolvedImages(new Map(imageCacheRef.current));
        });

        return () => {
            cancelled = true;
        };
    }, [admin, participants]);

    const avatarImage = (person: any): string | undefined => {
        const ref = typeof person?.image === "string" ? person.image.trim() : "";
        return ref ? resolvedImages.get(ref) : undefined;
    };

    const sessionStats = [
        { Icon: Calendar, label: "Date", value: start ? formatDateYYYY_MM_DD_h_m(start) : "N/A" },
        { Icon: Clock3, label: "Duration", value: `${duration ?? 0} min` },
        { Icon: DollarSign, label: "Price", value: `$${price ?? 0}` },
    ];

    return (
        <div className={`w-full ${isLight ? "text-slate-900" : "text-white"}`}>
            <div className="space-y-2.5">
                <div className={`overflow-hidden rounded-xl border ${isLight ? "border-slate-200 bg-gradient-to-br from-[#EEF3F8] to-slate-50" : "border-slate-700 bg-[#141414]"}`}>
                    <div className="p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 text-base font-bold leading-snug break-words">{title}</div>
                            {recurrenceLabel ? (
                                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${isLight ? "bg-[#234C6A] text-white" : "bg-[#234C6A]/60 text-slate-100"}`}>
                                    <Repeat className="h-3 w-3" aria-hidden />
                                    {recurrenceLabel}
                                </span>
                            ) : null}
                        </div>
                        <div className={`mt-1.5 border-t pt-1.5 text-[13px] leading-relaxed ${isLight ? "border-slate-200/70 text-slate-600" : "border-slate-700 text-lightgrey"}`}>
                            {description || "No description provided."}
                        </div>
                    </div>
                </div>

                {!isCommunityChat ? (
                    <div className={`rounded-xl border p-3 ${isLight ? "border-slate-200 bg-white" : "border-slate-700 bg-[#141414]"}`}>
                        <div className={`mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${isLight ? "text-[#234C6A]" : "text-slate-300"}`}>
                            <Calendar className="h-3.5 w-3.5" />
                            Session info
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {sessionStats.map(({ Icon, label, value }) => (
                                <div
                                    key={label}
                                    className={`flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center ${isLight ? "border-slate-200 bg-slate-50" : "border-slate-700 bg-[#1c1c1c]"}`}
                                >
                                    <Icon className={`h-3.5 w-3.5 ${isLight ? "text-[#234C6A]" : "text-slate-400"}`} />
                                    <span className={`text-[9px] font-semibold uppercase tracking-[0.1em] ${isLight ? "text-slate-400" : "text-slate-500"}`}>{label}</span>
                                    <span className={`text-[12px] font-semibold ${isLight ? "text-slate-800" : "text-slate-200"}`}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className={`rounded-xl border p-3 ${isLight ? "border-slate-200 bg-white" : "border-slate-700 bg-[#141414]"}`}>
                        <div className={`mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${isLight ? "text-[#234C6A]" : "text-slate-300"}`}>
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

                {(keywords?.length || services?.length || (purposeOther && purposeOther.trim())) ? (
                    <div className={`rounded-xl border p-3 ${isLight ? "border-slate-200 bg-white" : "border-slate-700 bg-[#141414]"}`}>
                        <div className={`mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${isLight ? "text-[#234C6A]" : "text-slate-300"}`}>
                            <Sparkles className="h-3.5 w-3.5" />
                            {type === "individual" ? "Purpose & interests" : "Interests"}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {purposeOther && purposeOther.trim() ? (
                                <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                        isLight
                                            ? "border border-slate-200 bg-slate-100 text-slate-700"
                                            : "border border-slate-700 bg-slate-800 text-slate-200"
                                    }`}
                                >
                                    {purposeOther.trim()}
                                </span>
                            ) : null}
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
                                    {serviceChipLabel(service)}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : null}

                <div className={`rounded-xl border p-3 ${isLight ? "border-slate-200 bg-white" : "border-slate-700 bg-[#141414]"}`}>
                    <div className={`mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${isLight ? "text-[#234C6A]" : "text-slate-300"}`}>
                        <UserRound className="h-3.5 w-3.5" />
                        Admin
                    </div>
                    <div className="flex space-x-3 items-center">
                        <Avatar username={admin?.username || "Admin"} isOnline={false} image={avatarImage(admin)} />
                        <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{admin?.username || "Unknown"}</div>
                            <div className={`text-[13px] truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>{admin?.email || "N/A"}</div>
                        </div>
                    </div>
                </div>

                <div className={`rounded-xl border p-3 ${isLight ? "border-slate-200 bg-white" : "border-slate-700 bg-[#141414]"}`}>
                    <div className={`mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${isLight ? "text-[#234C6A]" : "text-slate-300"}`}>
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
                                        <Avatar username={participant.username} isOnline={false} image={avatarImage(participant)} />
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
                resolvedImages={resolvedImages}
            />
        </div>
    );
};

export default SeminarDetails;
