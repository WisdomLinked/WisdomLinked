import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import FilePreviewModal from "../../FilePreviewModal";
import { hasResumeForPreview, resolveResumePublicUrl } from "../../../../utils/resumeUrl";
import ProfileCard from "../../../../components/profile/ProfileCard";

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    userDetails: Record<string, any>;
    theme?: "light" | "dark";
    /** Shown while profile loads or if API image fetch fails (e.g. RC/chat avatar id). */
    previewImage?: string | null;
    /** Current user role — used to show expert resume to students only. */
    viewerRole?: string;
}

const ACCENT = "#234C6A";

const ProfileModal: React.FC<ProfileModalProps> = ({
    isOpen,
    onClose,
    userDetails,
    theme = "light",
    previewImage,
    viewerRole,
}) => {
    const [resumePreviewOpen, setResumePreviewOpen] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const isLight = theme === "light";

    const handleCloseClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClose();
    };

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) setResumePreviewOpen(false);
    }, [isOpen]);

    const hasUploadedResume = hasResumeForPreview(userDetails?.resume);
    useEffect(() => {
        if (!hasUploadedResume && resumePreviewOpen) setResumePreviewOpen(false);
    }, [hasUploadedResume, resumePreviewOpen]);

    if (!isOpen) return null;

    const resumeUrl = resolveResumePublicUrl(userDetails?.resume);

    const overlay = (
        <div
            className={`fixed inset-0 z-[200] flex items-center justify-center p-4 ${
                isLight ? "bg-slate-900/45 backdrop-blur-[6px]" : "bg-black/70 backdrop-blur-sm"
            }`}
            role="presentation"
        >
            <div
                ref={modalRef}
                className={`relative w-full max-w-[400px] max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl ${
                    isLight ? "border border-slate-200/95 bg-white text-slate-900" : "border border-slate-700 bg-slate-900 text-slate-100"
                }`}
                role="dialog"
                aria-modal="true"
                aria-label="Profile"
                onClick={e => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={handleCloseClick}
                    className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                    aria-label="Close profile"
                >
                    <X className="h-4 w-4" strokeWidth={2.25} />
                </button>

                <ProfileCard
                    person={userDetails}
                    viewerRole={viewerRole}
                    theme={theme}
                    previewImage={previewImage}
                    onViewResume={hasUploadedResume ? () => setResumePreviewOpen(true) : undefined}
                />

                <div className="px-6 pb-6">
                    <button
                        type="button"
                        onClick={handleCloseClick}
                        className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-[1.03] active:brightness-95"
                        style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #456882 100%)`, boxShadow: "0 8px 24px rgba(35, 76, 106, 0.28)" }}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {createPortal(overlay, document.body)}
            {resumePreviewOpen && hasUploadedResume ? (
                <FilePreviewModal
                    fileUrl={resumeUrl}
                    fileName="Resume"
                    documentType="Resume"
                    onClose={() => setResumePreviewOpen(false)}
                    resumeStudentViewContext={
                        userDetails?._id ? { expertId: String(userDetails._id) } : undefined
                    }
                />
            ) : null}
        </>
    );
};

export default ProfileModal;
