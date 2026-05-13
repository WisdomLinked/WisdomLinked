import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Users, Sparkles, Globe, Lock, Info } from "lucide-react";
import { collectProfileOptionLabels } from "../../../../utils/chatProfileModal";

interface CommunityProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    communityDetails: Record<string, any>;
    theme?: "light" | "dark";
    onViewMembers?: () => void;
}

const ACCENT = "#234C6A";
const ACCENT_SOFT = "#E8EEF4";

function collectMajorLabels(group: Record<string, any> | null | undefined): string[] {
    return collectProfileOptionLabels(group?.keywords);
}

function collectServiceLabels(group: Record<string, any> | null | undefined): string[] {
    return collectProfileOptionLabels(group?.services);
}

const CommunityProfileModal: React.FC<CommunityProfileModalProps> = ({
    isOpen,
    onClose,
    communityDetails,
    theme = "light",
    onViewMembers,
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const isLight = theme === "light";

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const name =
        communityDetails?.groupName ||
        communityDetails?.name ||
        "Community";
    const description =
        communityDetails?.description?.trim() || "No description yet.";
    const membersCount = Array.isArray(communityDetails?.participants)
        ? communityDetails.participants.length
        : 0;
    const visibility = communityDetails?.isOpenToAll ? "Open to all" : "Invite only";
    const majors = collectMajorLabels(communityDetails);
    const services = collectServiceLabels(communityDetails);

    return createPortal(
        <div
            className={`fixed inset-0 z-[200] flex items-center justify-center p-4 ${
                isLight ? "bg-slate-900/45 backdrop-blur-[6px]" : "bg-black/70 backdrop-blur-sm"
            }`}
        >
            <div
                ref={modalRef}
                className={`relative w-full max-w-[420px] overflow-hidden rounded-2xl shadow-2xl ${
                    isLight
                        ? "border border-slate-200/95 bg-white text-slate-900 shadow-slate-900/10"
                        : "border border-slate-700 bg-slate-900 text-slate-100 shadow-black/40"
                }`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="community-modal-title"
            >
                <div
                    className="h-1.5 w-full"
                    style={{
                        background: `linear-gradient(90deg, ${ACCENT} 0%, #456882 50%, ${ACCENT} 100%)`,
                        backgroundSize: "200% auto",
                    }}
                />
                <button
                    type="button"
                    onClick={onClose}
                    className={`absolute right-3 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                        isLight
                            ? "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                    aria-label="Close community info"
                >
                    <X className="h-4 w-4" strokeWidth={2.25} />
                </button>

                <div className="px-6 pb-6 pt-8">
                    <div className="mb-6 flex flex-col items-center text-center">
                        <div className="mb-4 flex h-[88px] w-[88px] items-center justify-center rounded-2xl ring-2 ring-[#E8EEF4] ring-offset-2 ring-offset-white bg-slate-100 text-[#234C6A]">
                            <Users className="h-10 w-10" />
                        </div>
                        <h2 id="community-modal-title" className="text-xl font-bold tracking-tight">
                            {name}
                        </h2>
                        <p className={`mt-1 text-[13px] font-semibold tracking-wide ${isLight ? "text-[#234C6A]" : "text-sky-200"}`}>
                            Community
                        </p>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        <InfoRow theme={theme} icon={Info} label="Description" value={description} />
                        <button
                            type="button"
                            onClick={() => {
                                onViewMembers?.();
                                onClose();
                            }}
                            className="text-left"
                        >
                            <InfoRow
                                theme={theme}
                                icon={Users}
                                label="Members"
                                value={`${membersCount}${onViewMembers ? " (click to view)" : ""}`}
                            />
                        </button>
                        <InfoRow
                            theme={theme}
                            icon={communityDetails?.isOpenToAll ? Globe : Lock}
                            label="Visibility"
                            value={visibility}
                        />
                    </div>

                    <div className="mt-4 w-full space-y-4">
                        <div>
                            <div className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                Majors
                            </div>
                            {majors.length ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {majors.map(label => (
                                        <span
                                            key={label}
                                            className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                                isLight
                                                    ? "border border-[#BCD6EA] bg-[#E8EEF4] text-[#234C6A]"
                                                    : "border border-slate-600 bg-slate-800/90 text-slate-100"
                                            }`}
                                            title={label}
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <div className={`text-[12px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                    No majors selected yet.
                                </div>
                            )}
                        </div>
                        <div>
                            <div className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                Services
                            </div>
                            {services.length ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {services.map(label => (
                                        <span
                                            key={label}
                                            className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                                isLight
                                                    ? "border border-slate-200 bg-white text-[#234C6A]"
                                                    : "border border-slate-600 bg-slate-800/60 text-slate-100"
                                            }`}
                                            title={label}
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <div className={`text-[12px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                    No services listed yet.
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-6 w-full rounded-xl py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-[1.03] active:brightness-95"
                        style={{
                            background: `linear-gradient(135deg, ${ACCENT} 0%, #456882 100%)`,
                            boxShadow: "0 8px 24px rgba(35, 76, 106, 0.28)",
                        }}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

function InfoRow({
    theme,
    icon: Icon,
    label,
    value,
}: {
    theme?: "light" | "dark";
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    label: string;
    value: string;
}) {
    const isLight = theme === "light";
    return (
        <div className={`flex gap-3 rounded-xl px-3 py-3 ${isLight ? "bg-slate-50/95" : "bg-slate-800/70"}`}>
            <div
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: isLight ? ACCENT_SOFT : "rgba(35, 76, 106, 0.35)" }}
            >
                <Icon className="h-[18px] w-[18px]" style={{ color: isLight ? ACCENT : "#D9EAFD" }} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 text-left">
                <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                    {label}
                </div>
                <div className={`mt-1 text-[14px] leading-snug ${isLight ? "text-slate-900" : "text-slate-100"} break-words`}>
                    {value}
                </div>
            </div>
        </div>
    );
}

export default CommunityProfileModal;
