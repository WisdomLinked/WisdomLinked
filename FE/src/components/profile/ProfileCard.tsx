import React, { useEffect, useMemo, useState } from "react";
import {
    AlignLeft,
    BadgeCheck,
    CalendarClock,
    Check,
    FileText,
    GraduationCap,
    Mail,
    MapPin,
    Percent,
    Star,
    type LucideIcon,
} from "lucide-react";
import { profileImageFetch } from "../../api/api";
import { getAvatarTitle } from "../../actions/common";
import { resolveProfileImageSrc } from "../../utils/profileImage";
import { hasResumeForPreview } from "../../utils/resumeUrl";
import { profileOptionLabel } from "../../utils/chatProfileModal";
import { isBaselineMajor } from "../../constants/majorOptions";
import {
    SERVICE_LABELS,
    canonicalLabelsFromMixedServiceEntries,
} from "../../constants/serviceOptions";

/**
 * ProfileCard — the fixed "person background" card, shared by every surface.
 *
 * It renders ONLY intrinsic, event-invariant information about a person (the
 * "card" in the spec). Anything about a specific session, request, or list row
 * (title, time, status, price, action buttons, the per-event note) belongs to
 * the host screen's "frame" around the card — never inside it.
 *
 * Data in, nothing out: the card does not fetch, edit, or know about sessions.
 * Actions (opening a résumé) are delegated up via callbacks.
 */

const NAVY = "#1A3A4A";
const NAVY_DEEP = "#122732";
const GOLD = "#B8912F";
const GOLD_BRIGHT = "#C9A84C";

const RANKING_OPTIONS = ["Top 10%", "Top 25%", "Top 50%", "Other"];

export function maskEmailForPrivacy(email: unknown): string {
    const raw = typeof email === "string" ? email.trim() : "";
    if (!raw || !raw.includes("@")) return "Not shared";
    const [localPart, domain = ""] = raw.split("@");
    if (!localPart || !domain) return "Not shared";

    const visibleLocal =
        localPart.length <= 2
            ? `${localPart.charAt(0)}••`
            : `${localPart.slice(0, 3)}${"•".repeat(Math.min(6, Math.max(2, localPart.length - 3)))}`;

    const domainParts = domain.split(".");
    const firstDomain = domainParts[0] ?? "";
    const tld = domainParts.slice(1).join(".");
    const visibleDomain =
        firstDomain.length <= 1
            ? "•••"
            : `${firstDomain.slice(0, 2)}${"•".repeat(Math.min(5, Math.max(2, firstDomain.length - 2)))}`;

    return `${visibleLocal}@${visibleDomain}${tld ? `.${tld}` : ""}`;
}

/** Full email domain (not PII on its own) — used for the "Verified · domain" trust line. */
function emailDomain(email: unknown): string {
    const raw = typeof email === "string" ? email.trim() : "";
    const at = raw.lastIndexOf("@");
    return at >= 0 ? raw.slice(at + 1) : "";
}

/** bookingNoticeHours (24 / 48 / 72) → "3 days advance notice". */
function bookingLeadLabel(hours: unknown): string {
    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0) return "";
    const days = Math.round(h / 24);
    if (days >= 1) return `${days} day${days === 1 ? "" : "s"} advance notice`;
    return `${h} hour${h === 1 ? "" : "s"} advance notice`;
}

function memberSinceLabel(createdAt: unknown): string {
    if (!createdAt) return "";
    const d = new Date(createdAt as string);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/**
 * Splits a person's majors into official (approved keyword or baseline) and
 * "other" (unapproved keywords + free-text customs). Officials render as normal
 * chips; others collapse into one "Other (…)" chip until an admin consolidates
 * them, at which point they graduate to official chips automatically.
 */
function splitMajors(person: Record<string, any>): { officialMajors: string[]; otherMajors: string[] } {
    const officialMajors: string[] = [];
    const otherMajors: string[] = [];
    const push = (label: string, isOfficial: boolean) => {
        if (!label) return;
        const bucket = isOfficial ? officialMajors : otherMajors;
        if (!bucket.includes(label)) bucket.push(label);
    };

    const keywords = Array.isArray(person?.keywords) ? person.keywords : [];
    for (const k of keywords) {
        const label = profileOptionLabel(k);
        const approved = k && typeof k === "object" ? Boolean((k as any).approved) : false;
        push(label, approved || isBaselineMajor(label));
    }

    const customs = Array.isArray(person?.customKeywords) ? person.customKeywords : [];
    for (const c of customs) {
        const label = profileOptionLabel(c);
        push(label, isBaselineMajor(label));
    }

    return { officialMajors, otherMajors };
}

export interface ProfileCardProps {
    person: Record<string, any>;
    /** Role of the viewer — used for masking / résumé visibility. */
    viewerRole?: string;
    theme?: "light" | "dark";
    /** Fallback avatar while the profile image loads / if fetch fails. */
    previewImage?: string | null;
    /** Called when the résumé row is clicked. If omitted, the row is view-only. */
    onViewResume?: () => void;
    className?: string;
}

const ProfileCard: React.FC<ProfileCardProps> = ({
    person,
    viewerRole,
    theme = "light",
    previewImage,
    onViewResume,
    className = "",
}) => {
    const isLight = theme === "light";
    const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            const resolved = await resolveProfileImageSrc(
                person?.image,
                "medium",
                profileImageFetch as any,
            );
            if (!cancelled) setAvatarSrc(resolved || previewImage || null);
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [person?.image, previewImage]);

    const role = String(person?.role ?? "").toLowerCase();
    const isExpert = role === "expert";
    const viewerRoleLc = String(viewerRole ?? "").toLowerCase();
    const viewerIsStudent = viewerRoleLc === "customer";

    // On a student card, GPA / ranking / self-description / notes are private
    // academic details: visible to experts (who need context to accept 1:1s) and
    // admins, but hidden from other students viewing the card (e.g. a seminar
    // participant list). Unknown viewers are treated as unprivileged.
    const viewerCanSeeStudentPrivate = viewerRoleLc === "expert" || viewerRoleLc === "admin";
    const hideStudentPrivate = !isExpert && !viewerCanSeeStudentPrivate;

    const name = person?.username ?? "—";
    const title = String(person?.title ?? "").trim();
    const roleLabel = isExpert ? "Expert" : role === "customer" ? "Student" : role ? role.charAt(0).toUpperCase() + role.slice(1) : "Member";
    const roleLine = isExpert && title ? `${roleLabel} · ${title}` : roleLabel;

    const isVerified = String(person?.status ?? "").toLowerCase() === "active";
    const domain = emailDomain(person?.email);

    // Majors split into official (approved keyword or baseline) vs. everything
    // else — unapproved keywords + free-text customs — which collapse into
    // a single "Other (…)" chip until an admin consolidates them official.
    const { officialMajors, otherMajors } = useMemo(
        () => splitMajors(person),
        [person?.keywords, person?.customKeywords],
    );
    const hasMajors = officialMajors.length > 0 || otherMajors.length > 0;
    const offeredServices = useMemo(
        () => new Set(canonicalLabelsFromMixedServiceEntries(person?.services)),
        [person?.services],
    );

    const followers = Array.isArray(person?.followers) ? person.followers.length : Number(person?.followersCount ?? 0);
    const oneOnOneCount = person?.oneOnOneCount;
    const seminarCount = person?.seminarCount;
    const ratingValue = Number(person?.rating ?? 0);
    const ratingCount = Array.isArray(person?.feedbacks) ? person.feedbacks.length : Number(person?.ratingCount ?? 0);

    const requestedCount = person?.requestedCount;
    const completedCount = person?.completedCount;
    const memberSince = memberSinceLabel(person?.createdAt);

    const priceValue = Array.isArray(person?.price) ? Number(person.price[0]) : Number(person?.price);
    const hasPrice = Number.isFinite(priceValue) && priceValue > 0;
    const leadLabel = bookingLeadLabel(person?.bookingNoticeHours);

    const selfDescription = String((isExpert ? person?.description : person?.specialNote) ?? "").trim();
    const countryName = person?.country?.name ?? (typeof person?.country === "string" ? person.country : "") ?? "";
    const hasResume = hasResumeForPreview(person?.resume);
    const showResume = hasResume && (!isExpert || viewerIsStudent || !viewerRole);

    // Student-specific fields (some are not yet captured at registration —
    // rendered here with placeholders until the profile/registration form adds them).
    const currentSchool = String(person?.currentUniversity ?? "").trim();
    const gpaValue = String(person?.gpa ?? "").trim();
    const rankingPercentile = String(person?.rankingPercentile ?? "").trim();
    const targetUniversities: string[] = Array.isArray(person?.targetUniversities)
        ? person.targetUniversities.map((u: any) => String(u).trim()).filter(Boolean)
        : String(person?.targetUniversities ?? "")
              .split(",")
              .map(s => s.trim())
              .filter(Boolean);
    const servicesRequested = canonicalLabelsFromMixedServiceEntries(person?.services);
    const applicationStage =
        String(person?.applicationStage ?? "").trim() ||
        [person?.intendedIntake, person?.degreeSought]
            .map(s => String(s ?? "").trim())
            .filter(Boolean)
            .join(" — ");

    const softBg = isLight ? "bg-slate-50/95" : "bg-slate-800/70";
    const labelCls = `text-[10px] font-semibold uppercase tracking-[0.16em] ${isLight ? "text-slate-500" : "text-slate-400"}`;
    const valueCls = `mt-1 text-[13.5px] leading-snug ${isLight ? "text-slate-900" : "text-slate-100"}`;

    return (
        <div className={`overflow-hidden ${className}`}>
            {/* ---------- Navy header + avatar ---------- */}
            <div className="relative">
                <div
                    className="h-[96px] w-full"
                    style={{
                        background: `linear-gradient(160deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)`,
                        borderRadius: "0 0 50% 50% / 0 0 28px 28px",
                    }}
                />
                <div className="absolute left-1/2 top-[48px] -translate-x-1/2">
                    <div
                        className={`flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full text-2xl font-bold ring-4 ${
                            isLight ? "bg-slate-100 text-slate-600 ring-white" : "bg-slate-800 text-slate-200 ring-slate-900"
                        }`}
                    >
                        {avatarSrc ? (
                            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <span className="select-none">{getAvatarTitle(name)}</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="px-6 pb-6 pt-[52px] text-center">
                <h2 className="font-serif text-xl font-semibold tracking-tight" style={{ color: isLight ? NAVY_DEEP : "#EDE7DA" }}>
                    {name}
                </h2>
                <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: GOLD }}>
                    {roleLine}
                </p>
                {isVerified && (isExpert ? domain : true) ? (
                    <p className={`mt-1 inline-flex items-center gap-1 text-[12px] ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                        <BadgeCheck className="h-3.5 w-3.5" style={{ color: "#2F7D5B" }} strokeWidth={2.25} />
                        {isExpert ? `Verified · ${domain}` : "Verified Student Email"}
                    </p>
                ) : null}

                {/* ---------- Trust stats ---------- */}
                <div className={`mt-5 flex items-stretch justify-center rounded-2xl ${softBg}`}>
                    {isExpert ? (
                        <>
                            <Stat isLight={isLight} value={followers} label="Followers" />
                            <StatDivider isLight={isLight} />
                            <Stat isLight={isLight} value={oneOnOneCount ?? "—"} label="1:1 Sessions" />
                            <StatDivider isLight={isLight} />
                            <Stat isLight={isLight} value={seminarCount ?? "—"} label="Seminars" />
                        </>
                    ) : (
                        <>
                            <Stat isLight={isLight} value={requestedCount ?? "—"} label="Requested" />
                            <StatDivider isLight={isLight} />
                            <Stat isLight={isLight} value={completedCount ?? "—"} label="Completed" />
                            <StatDivider isLight={isLight} />
                            <Stat isLight={isLight} value={memberSince || "—"} label="Member since" />
                        </>
                    )}
                </div>

                {isExpert && (ratingValue > 0 || ratingCount > 0) ? (
                    <div className="mt-3 flex items-center justify-center gap-2">
                        <div className="flex">
                            {[0, 1, 2, 3, 4].map(i => (
                                <Star
                                    key={i}
                                    className="h-4 w-4"
                                    style={{ color: GOLD_BRIGHT }}
                                    fill={i < Math.round(ratingValue) ? GOLD_BRIGHT : "none"}
                                    strokeWidth={1.75}
                                />
                            ))}
                        </div>
                        <span className={`text-[13px] font-semibold ${isLight ? "text-slate-800" : "text-slate-100"}`}>
                            {ratingValue.toFixed(1)}
                        </span>
                        {ratingCount > 0 ? (
                            <span className={`text-[12px] ${isLight ? "text-slate-400" : "text-slate-500"}`}>({ratingCount})</span>
                        ) : null}
                    </div>
                ) : null}

                {/* ---------- Majors ---------- */}
                <Section label="Majors" isLight={isLight}>
                    {hasMajors ? (
                        <div className="flex flex-wrap justify-center gap-1.5">
                            {officialMajors.map(label => (
                                <span
                                    key={label}
                                    title={label}
                                    className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                        isLight ? "border border-[#BCD6EA] bg-[#E8EEF4] text-[#234C6A]" : "border border-slate-600 bg-slate-800/90 text-slate-100"
                                    }`}
                                >
                                    {label}
                                </span>
                            ))}
                            {otherMajors.length > 0 ? (
                                <span
                                    title={`Pending approval: ${otherMajors.join(", ")}`}
                                    className={`inline-flex max-w-full items-center rounded-full border border-dashed px-2.5 py-1 text-[11px] font-medium ${
                                        isLight ? "border-slate-300 text-slate-500" : "border-slate-600 text-slate-400"
                                    }`}
                                >
                                    Other ({otherMajors.join(", ")})
                                </span>
                            ) : null}
                        </div>
                    ) : (
                        <p className={`text-[11px] ${isLight ? "text-slate-400" : "text-slate-500"}`}>No majors selected yet.</p>
                    )}
                </Section>

                {/* ---------- Expert: services offered + price ---------- */}
                {isExpert ? (
                    <>
                        <Section label="Services offered" isLight={isLight}>
                            <div className="flex flex-col gap-1.5">
                                {SERVICE_LABELS.map(label => {
                                    const offered = offeredServices.has(label);
                                    return offered ? (
                                        <div
                                            key={label}
                                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold text-white"
                                            style={{ background: NAVY }}
                                        >
                                            <Check className="h-4 w-4 shrink-0" style={{ color: GOLD_BRIGHT }} strokeWidth={2.5} />
                                            {label}
                                        </div>
                                    ) : (
                                        <div
                                            key={label}
                                            className={`flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-[12.5px] italic ${
                                                isLight ? "border-slate-300 text-slate-400" : "border-slate-600 text-slate-500"
                                            }`}
                                        >
                                            <span className="shrink-0">—</span>
                                            {label} — not offered
                                        </div>
                                    );
                                })}
                            </div>
                        </Section>

                        {hasPrice ? (
                            <div className="mt-5">
                                <div className="text-center">
                                    <span className="text-lg font-bold" style={{ color: isLight ? NAVY_DEEP : "#EDE7DA" }}>
                                        ${priceValue}
                                    </span>
                                    <span className={`text-sm ${isLight ? "text-slate-500" : "text-slate-400"}`}> / hour</span>
                                </div>
                                <p className={`mt-0.5 text-center text-[11px] italic ${isLight ? "text-slate-400" : "text-slate-500"}`}>
                                    Flat rate for all services
                                </p>
                            </div>
                        ) : null}
                    </>
                ) : null}

                {/* ---------- Student: academic detail ---------- */}
                {!isExpert ? (
                    <div className="mt-5 flex flex-col gap-2.5">
                        <InfoRow isLight={isLight} icon={GraduationCap} label="Current school / university" value={currentSchool || "Not provided"} />
                        {!hideStudentPrivate ? (
                            <InfoRow isLight={isLight} icon={Percent} label="GPA" value={gpaValue || "Not provided"} />
                        ) : null}

                        {!hideStudentPrivate ? (
                            <div className={`rounded-xl px-3 py-3 text-left ${softBg}`}>
                                <div className={labelCls}>Ranking percentile</div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {RANKING_OPTIONS.map(opt => {
                                        const selected = rankingPercentile.toLowerCase() === opt.toLowerCase();
                                        return (
                                            <span
                                                key={opt}
                                                className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${
                                                    selected
                                                        ? "text-white"
                                                        : isLight
                                                          ? "border border-slate-300 text-slate-500"
                                                          : "border border-slate-600 text-slate-400"
                                                }`}
                                                style={selected ? { background: NAVY } : undefined}
                                            >
                                                {opt}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}

                        <Section label="Target universities" isLight={isLight}>
                            {targetUniversities.length > 0 ? (
                                <div className="flex flex-wrap justify-center gap-1.5">
                                    {targetUniversities.map(u => (
                                        <span
                                            key={u}
                                            title={u}
                                            className="inline-flex max-w-full truncate rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                                            style={{ borderColor: GOLD, color: GOLD }}
                                        >
                                            {u}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className={`text-[11px] ${isLight ? "text-slate-400" : "text-slate-500"}`}>Not provided</p>
                            )}
                        </Section>

                        <Section label="Services requested" isLight={isLight}>
                            {servicesRequested.length > 0 ? (
                                <div className="flex flex-wrap justify-center gap-1.5">
                                    {servicesRequested.map(label => (
                                        <span
                                            key={label}
                                            title={label}
                                            className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                                isLight ? "border border-[#BCD6EA] bg-[#E8EEF4] text-[#234C6A]" : "border border-slate-600 bg-slate-800/90 text-sky-300"
                                            }`}
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className={`text-[11px] ${isLight ? "text-slate-400" : "text-slate-500"}`}>None requested yet.</p>
                            )}
                        </Section>
                    </div>
                ) : null}
            </div>

            {/* ---------- About (info rows) ---------- */}
            <div className="flex flex-col gap-2.5 px-6 pb-6">
                <InfoRow isLight={isLight} icon={MapPin} label="Country" value={countryName || "Not specified"} />
                <InfoRow isLight={isLight} icon={Mail} label="Email" value={maskEmailForPrivacy(person?.email)} mono />
                {isExpert ? (
                    leadLabel ? <InfoRow isLight={isLight} icon={CalendarClock} label="Booking lead time" value={leadLabel} /> : null
                ) : (
                    <InfoRow isLight={isLight} icon={CalendarClock} label="Application stage" value={applicationStage || "Not provided"} />
                )}
                {!hideStudentPrivate ? (
                    <InfoRow isLight={isLight} icon={AlignLeft} label="Self description" value={selfDescription || "Not provided"} />
                ) : null}

                {showResume ? (
                    <button
                        type="button"
                        disabled={!onViewResume}
                        onClick={onViewResume}
                        className={`flex items-center gap-3 rounded-xl border-2 px-3 py-3 text-left transition ${
                            isLight ? "border-[#234C6A]/25 bg-[#F5F3EF] hover:bg-[#eee9df]" : "border-slate-600 bg-slate-800/80 hover:bg-slate-800"
                        } disabled:cursor-default disabled:hover:bg-transparent`}
                    >
                        <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                            style={{ backgroundColor: isLight ? "#E8EEF4" : "rgba(35,76,106,0.35)" }}
                        >
                            <FileText className="h-[18px] w-[18px]" style={{ color: isLight ? "#234C6A" : "#D9EAFD" }} strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className={labelCls}>Résumé</div>
                            <div className={`mt-0.5 text-sm font-semibold ${isLight ? "text-[#234C6A]" : "text-sky-200"} ${onViewResume ? "underline underline-offset-2" : ""}`}>
                                View résumé
                            </div>
                        </div>
                    </button>
                ) : null}
            </div>
        </div>
    );
};

function Stat({ isLight, value, label }: { isLight: boolean; value: React.ReactNode; label: string }) {
    return (
        <div className="flex flex-1 flex-col items-center px-2 py-3">
            <div className={`text-base font-bold ${isLight ? "text-slate-900" : "text-slate-100"}`}>{value}</div>
            <div className={`mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                {label}
            </div>
        </div>
    );
}

function StatDivider({ isLight }: { isLight: boolean }) {
    return <div className={`my-3 w-px ${isLight ? "bg-slate-200" : "bg-slate-700"}`} />;
}

function Section({ label, isLight, children }: { label: string; isLight: boolean; children: React.ReactNode }) {
    return (
        <div className="mt-5">
            <p className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                {label}
            </p>
            {children}
        </div>
    );
}

function InfoRow({
    isLight,
    icon: Icon,
    label,
    value,
    mono,
}: {
    isLight: boolean;
    icon: LucideIcon;
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div className={`flex gap-3 rounded-xl px-3 py-3 ${isLight ? "bg-slate-50/95" : "bg-slate-800/70"}`}>
            <div
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: isLight ? "#E8EEF4" : "rgba(35,76,106,0.35)" }}
            >
                <Icon className="h-[18px] w-[18px]" style={{ color: isLight ? "#234C6A" : "#D9EAFD" }} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 text-left">
                <div className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                    {label}
                </div>
                <div className={`mt-1 text-[14px] leading-snug ${isLight ? "text-slate-900" : "text-slate-100"} ${mono ? "break-all font-mono text-[13px]" : "break-words"}`}>
                    {value}
                </div>
            </div>
        </div>
    );
}

export default ProfileCard;
