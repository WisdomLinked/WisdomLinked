import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Mail, MapPin, User } from "lucide-react";
import { profileImageFetch } from "../../../../api/api";
import { getAvatarTitle } from "../../../../actions/common";
import { resolveProfileImageSrc } from "../../../../utils/profileImage";

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    userDetails: Record<string, any>;
    theme?: "light" | "dark";
    /** Shown while profile loads or if API image fetch fails (e.g. RC/chat avatar id). */
    previewImage?: string | null;
}

const ACCENT = "#234C6A";
const ACCENT_SOFT = "#E8EEF4";

function roleLabelFromUser(role: unknown): string {
    const r = String(role ?? "").toLowerCase();
    if (r === "expert") return "Expert";
    if (r === "customer") return "Student";
    if (!r) return "Member";
    return r.charAt(0).toUpperCase() + r.slice(1);
}

/** Majors / keywords + services (e.g. resume, research) from populated User doc. */
function collectInterestLabels(user: Record<string, any> | null | undefined): string[] {
    if (!user) return [];
    const out: string[] = [];
    const push = (s: unknown) => {
        const v = typeof s === "string" ? s.trim() : "";
        if (v && !out.includes(v)) out.push(v);
    };
    (user.keywords ?? []).forEach((k: any) => {
        if (k && typeof k === "object") push(k.value ?? k.label);
    });
    (user.services ?? []).forEach((s: any) => {
        if (s && typeof s === "object") push(s.value ?? s.label);
    });
    return out;
}

function maskEmailForPrivacy(email: unknown): string {
    const raw = typeof email === "string" ? email.trim() : "";
    if (!raw || !raw.includes("@")) return "—";
    const [localPart, domain = ""] = raw.split("@");
    if (!localPart || !domain) return "—";

    const visibleLocal =
        localPart.length <= 2
            ? `${localPart.charAt(0)}*`
            : `${localPart.slice(0, 2)}${"*".repeat(Math.max(2, localPart.length - 2))}`;

    const domainParts = domain.split(".");
    const firstDomain = domainParts[0] ?? "";
    const tld = domainParts.slice(1).join(".");
    const visibleDomain =
        firstDomain.length <= 1
            ? "*"
            : `${firstDomain.charAt(0)}${"*".repeat(Math.max(2, firstDomain.length - 1))}`;

    return `${visibleLocal}@${visibleDomain}${tld ? `.${tld}` : ""}`;
}

const ProfileModal: React.FC<ProfileModalProps> = ({
    isOpen,
    onClose,
    userDetails,
    theme = "light",
    previewImage,
}) => {
    const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const isLight = theme === "light";

    const handleCloseClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClose();
    };

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            const resolved = await resolveProfileImageSrc(
                userDetails?.image,
                "medium",
                profileImageFetch as any,
            );
            if (!cancelled) setAvatarSrc(resolved || previewImage || null);
        };
        if (isOpen) void run();
        return () => {
            cancelled = true;
        };
    }, [isOpen, userDetails?.image, previewImage]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const name = userDetails?.username ?? "—";
    const email = maskEmailForPrivacy(userDetails?.email);
    const countryName = userDetails?.country?.name ?? "—";
    const roleLine = roleLabelFromUser(userDetails?.role);
    const expertTitle =
        String(userDetails?.role ?? "").toLowerCase() === "expert" && userDetails?.title
            ? String(userDetails.title).trim()
            : "";
    const interests = collectInterestLabels(userDetails);

    const overlay = (
        <div
            className={`fixed inset-0 z-[200] flex items-center justify-center p-4 ${
                isLight
                    ? "bg-slate-900/45 backdrop-blur-[6px]"
                    : "bg-black/70 backdrop-blur-sm"
            }`}
            role="presentation"
        >
            <div
                ref={modalRef}
                className={`relative w-full max-w-[400px] overflow-hidden rounded-2xl shadow-2xl ${
                    isLight
                        ? "border border-slate-200/95 bg-white text-slate-900 shadow-slate-900/10"
                        : "border border-slate-700 bg-slate-900 text-slate-100 shadow-black/40"
                }`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="profile-modal-title"
                onClick={e => e.stopPropagation()}
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
                    onClick={handleCloseClick}
                    className={`absolute right-3 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                        isLight
                            ? "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                    aria-label="Close profile"
                >
                    <X className="h-4 w-4" strokeWidth={2.25} />
                </button>

                <div className="px-6 pb-6 pt-8">
                    <div className="mb-6 flex flex-col items-center text-center">
                        <div
                            className={`mb-4 flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-2xl text-2xl font-bold shadow-inner ring-2 ring-[#E8EEF4] ring-offset-2 ${
                                isLight ? "bg-slate-100 text-slate-600 ring-offset-white" : "bg-slate-800 text-slate-200 ring-slate-600 ring-offset-slate-900"
                            }`}
                        >
                            {avatarSrc ? (
                                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <span className="select-none">{getAvatarTitle(name)}</span>
                            )}
                        </div>
                        <h2 id="profile-modal-title" className="text-xl font-bold tracking-tight">
                            {name}
                        </h2>
                        <p
                            className={`mt-1 text-[13px] font-semibold tracking-wide ${isLight ? "text-[#234C6A]" : "text-sky-200"}`}
                        >
                            {roleLine}
                        </p>
                        {expertTitle ? (
                            <p
                                className={`mt-0.5 max-w-[320px] text-[12px] leading-snug ${isLight ? "text-slate-600" : "text-slate-400"}`}
                            >
                                {expertTitle}
                            </p>
                        ) : null}
                        <div className="mt-3 w-full max-w-[340px]">
                            {interests.length > 0 ? (
                                <div className="flex flex-wrap justify-center gap-1.5">
                                    {interests.map(label => (
                                        <span
                                            key={label}
                                            className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                                isLight
                                                    ? "border border-slate-200 bg-[#E8EEF4] text-[#234C6A]"
                                                    : "border border-slate-600 bg-slate-800/90 text-slate-100"
                                            }`}
                                            title={label}
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p
                                    className={`text-center text-[11px] ${isLight ? "text-slate-400" : "text-slate-500"}`}
                                >
                                    No majors or services listed yet.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        <InfoRow
                            theme={theme}
                            icon={Mail}
                            label="Email"
                            value={email}
                            mono
                        />
                        <InfoRow
                            theme={theme}
                            icon={MapPin}
                            label="Country"
                            value={countryName}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleCloseClick}
                        className="mt-6 w-full rounded-xl py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-[1.03] active:brightness-95"
                        style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #456882 100%)`, boxShadow: "0 8px 24px rgba(35, 76, 106, 0.28)" }}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
};

function InfoRow({
    theme,
    icon: Icon,
    label,
    value,
    mono,
}: {
    theme?: "light" | "dark";
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    label: string;
    value: string;
    mono?: boolean;
}) {
    const isLight = theme === "light";
    return (
        <div
            className={`flex gap-3 rounded-xl px-3 py-3 ${
                isLight ? "bg-slate-50/95" : "bg-slate-800/70"
            }`}
        >
            <div
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: isLight ? ACCENT_SOFT : "rgba(35, 76, 106, 0.35)" }}
            >
                <Icon className="h-[18px] w-[18px]" style={{ color: isLight ? ACCENT : "#D9EAFD" }} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 text-left">
                <div
                    className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        isLight ? "text-slate-500" : "text-slate-400"
                    }`}
                >
                    {label}
                </div>
                <div
                    className={`mt-1 text-[14px] leading-snug ${
                        isLight ? "text-slate-900" : "text-slate-100"
                    } ${mono ? "break-all font-mono text-[13px]" : "break-words"}`}
                >
                    {value}
                </div>
            </div>
        </div>
    );
}

export default ProfileModal;
