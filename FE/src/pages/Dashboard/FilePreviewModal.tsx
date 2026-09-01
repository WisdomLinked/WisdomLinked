import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, X } from "lucide-react";
import { notifyExpertResumeFormat } from "../../api/chatApi";
import {
  STUDENT_RESUME_BLOCKED_MESSAGE,
  STUDENT_RESUME_PREVIEW_UNAVAILABLE_MESSAGE,
  extensionFromUrl,
  isDocxZipMagic,
  isOleDocMagic,
  isPdfMagic,
  shouldBlockStudentResumeByExtension,
  shouldSendResumeFormatNotifyOnce,
} from "../../utils/resumePreviewHelpers";
import { OVERLAY_Z_DOCUMENT_PREVIEW } from "../../utils/overlayLayers";

const PREVIEW_OVERLAY_Z = OVERLAY_Z_DOCUMENT_PREVIEW;

export interface DocumentPreviewModalProps {
  /** When `false`, the modal renders nothing. Omit or `true` when parent mounts conditionally. */
  isOpen?: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  /** Shown as the modal title (e.g. "Resume", "File Preview"). */
  documentType?: string;
  /**
   * When set (student viewing an expert's resume): `.pdf` → inline PDF; `.doc`/`.docx` → Word viewer;
   * extensionless URLs are sniffed for PDF/Word bytes. Any other format shows a message (and may email the expert).
   */
  resumeStudentViewContext?: { expertId: string };
}

/** @deprecated Use `DocumentPreviewModalProps` — kept as alias for existing imports. */
export type FilePreviewModalProps = DocumentPreviewModalProps;

function pdfIframeSrc(displaySrc: string): string {
  if (!displaySrc) return displaySrc;
  if (displaySrc.startsWith("blob:")) return displaySrc;
  return displaySrc.includes("#") ? displaySrc : `${displaySrc}#view=FitH`;
}

/** Absolute http(s) URL for Google Docs Viewer (viewer cannot fetch blob/data URLs). */
function toAbsolutePublicDocumentUrl(u: string): string | null {
  if (!u || u.startsWith("blob:") || u.startsWith("data:")) return null;
  try {
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (typeof window !== "undefined" && u.startsWith("/")) {
      return `${window.location.origin}${u}`;
    }
    if (typeof window !== "undefined") {
      return new URL(u, window.location.href).href;
    }
  } catch {
    return null;
  }
  return null;
}

function googleDocsViewerEmbedUrl(documentUrl: string): string {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(documentUrl)}&embedded=true`;
}

/** `preview_error` = could not verify type (e.g. fetch failed); no expert email. */
type StudentResumeBlockKind = "incompatible_extension" | "incompatible_content" | "preview_error";

type StudentResumeValidation =
  | { status: "loading" }
  | { status: "blocked"; blockKind: StudentResumeBlockKind }
  | { status: "ok"; kind: "pdf"; objectUrl: string }
  | { status: "ok"; kind: "office"; url: string };

function useInlinePdfSrc(fileUrl: string | undefined, wantsBlobPreview: boolean): string {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fileUrl || !wantsBlobPreview) {
      setObjectUrl(null);
      return;
    }

    let cancelled = false;
    let created: string | null = null;

    (async () => {
      try {
        const res = await fetch(fileUrl, { credentials: "include", mode: "cors" });
        if (!res.ok) throw new Error("Failed to fetch file");
        const blob = await res.blob();
        const mime = blob.type || "application/pdf";
        const asPdf =
          mime === "application/pdf" || mime === "application/octet-stream" || !mime
            ? new Blob([blob], { type: "application/pdf" })
            : blob;
        const nextUrl = URL.createObjectURL(asPdf);
        if (cancelled) {
          URL.revokeObjectURL(nextUrl);
          return;
        }
        created = nextUrl;
        setObjectUrl(nextUrl);
      } catch {
        if (!cancelled) setObjectUrl(null);
      }
    })();

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [fileUrl, wantsBlobPreview]);

  return objectUrl || fileUrl || "";
}

function useStudentResumeValidation(fileUrl: string, enabled: boolean): StudentResumeValidation {
  const [state, setState] = useState<StudentResumeValidation>(() =>
    enabled ? { status: "loading" } : { status: "blocked", blockKind: "preview_error" },
  );
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !fileUrl) {
      setState({ status: "blocked", blockKind: "preview_error" });
      return;
    }

    let cancelled = false;

    const revokeHeld = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };

    setState({ status: "loading" });
    revokeHeld();

    (async () => {
      const ext = extensionFromUrl(fileUrl);

      const finalizePdf = (blob: Blob) => {
        const pdfBlob = new Blob([blob], { type: "application/pdf" });
        const ou = URL.createObjectURL(pdfBlob);
        revokeHeld();
        objectUrlRef.current = ou;
        if (!cancelled) setState({ status: "ok", kind: "pdf", objectUrl: ou });
      };

      if (shouldBlockStudentResumeByExtension(ext)) {
        if (!cancelled) setState({ status: "blocked", blockKind: "incompatible_extension" });
        return;
      }

      if (ext === "doc" || ext === "docx") {
        if (!cancelled) setState({ status: "ok", kind: "office", url: fileUrl });
        return;
      }

      // Filename says PDF — do not fetch here. A fetch often fails (CORS / cookies / S3) even when the
      // file is a valid PDF; preview uses Google Docs viewer + direct iframe on the original URL instead.
      if (ext === "pdf") {
        if (!cancelled) setState({ status: "ok", kind: "pdf", objectUrl: fileUrl });
        return;
      }

      if (!ext) {
        try {
          const res = await fetch(fileUrl, { credentials: "include", mode: "cors" });
          if (!res.ok) throw new Error("fetch failed");
          const blob = await res.blob();
          const mime = (blob.type || "").split(";")[0].trim().toLowerCase();
          const headBuf = await blob.slice(0, 8).arrayBuffer();

          const looksPdf =
            mime === "application/pdf" ||
            isPdfMagic(headBuf) ||
            (mime === "application/octet-stream" && isPdfMagic(headBuf));

          if (looksPdf) {
            finalizePdf(blob);
            return;
          }

          const looksWord =
            mime === "application/msword" ||
            mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            isDocxZipMagic(headBuf) ||
            isOleDocMagic(headBuf);

          if (looksWord) {
            if (!cancelled) setState({ status: "ok", kind: "office", url: fileUrl });
            return;
          }
        } catch {
          // Sniffing fetch failed (common with cross-origin resumes). If we have a public URL, still
          // attempt PDF-style preview (Google viewer + direct URL) instead of blocking.
          if (!cancelled && toAbsolutePublicDocumentUrl(fileUrl)) {
            setState({ status: "ok", kind: "pdf", objectUrl: fileUrl });
            return;
          }
        }
        if (!cancelled) setState({ status: "blocked", blockKind: "incompatible_content" });
        return;
      }

      if (!cancelled) setState({ status: "blocked", blockKind: "preview_error" });
    })();

    return () => {
      cancelled = true;
      revokeHeld();
    };
  }, [fileUrl, enabled]);

  return state;
}

function PreviewFallback() {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 px-6 py-12 text-center" style={{ minHeight: "70vh" }}>
      <FileText className="h-10 w-10 shrink-0 text-[#234C6A]" strokeWidth={1.5} aria-hidden />
      <p className="text-base font-medium text-slate-600">Preview not available for this file type</p>
      <p className="max-w-md text-sm text-slate-600">Use the download button below to open the file</p>
    </div>
  );
}

/**
 * Google Docs Viewer first for public http(s) document URLs, then native iframe (blob or direct URL).
 * Loading overlay + "Open in new tab" escape hatch.
 */
function PdfPreviewFrame({
  fileUrlForGoogleAndTab,
  directIframeSrc,
  iframeKey,
}: {
  fileUrlForGoogleAndTab: string;
  directIframeSrc: string;
  iframeKey: number;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [useDirectFallback, setUseDirectFallback] = useState(false);
  const [innerRemount, setInnerRemount] = useState(0);

  const absoluteForGoogle = useMemo(
    () => toAbsolutePublicDocumentUrl(fileUrlForGoogleAndTab),
    [fileUrlForGoogleAndTab],
  );

  useEffect(() => {
    setIsLoading(true);
    setUseDirectFallback(false);
    setInnerRemount(0);
  }, [fileUrlForGoogleAndTab, iframeKey, directIframeSrc]);

  const googleSrc = absoluteForGoogle ? googleDocsViewerEmbedUrl(absoluteForGoogle) : null;
  const useGoogle = Boolean(googleSrc && !useDirectFallback);
  const iframeSrc = useGoogle ? googleSrc! : pdfIframeSrc(directIframeSrc);

  const handleIframeError = () => {
    if (useGoogle) {
      setUseDirectFallback(true);
      setInnerRemount(n => n + 1);
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full bg-[#F5F3EF]">
      <div className="relative w-full" style={{ minHeight: "70vh" }}>
        {isLoading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#F5F3EF]">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-[#234C6A] border-t-transparent"
              aria-hidden
            />
            <p className="mt-3 text-sm text-slate-500">Loading preview...</p>
          </div>
        ) : null}
        <iframe
          key={`${iframeKey}-${innerRemount}-${useDirectFallback ? "d" : "g"}`}
          src={iframeSrc}
          title="Document Preview"
          allowFullScreen
          className="w-full"
          style={{ height: "70vh", border: "none" }}
          onLoad={() => setIsLoading(false)}
          onError={handleIframeError}
        />
      </div>
      <p className="px-6 pb-3 pt-2 text-center text-xs text-slate-400">
        Preview not loading?{" "}
        <a
          href={fileUrlForGoogleAndTab}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#234C6A] underline hover:text-[#1b3c53]"
        >
          Open in new tab
        </a>
      </p>
    </div>
  );
}

/** Office / plain URL iframe with loading overlay (no Google). */
function SimpleEmbedFrame({
  iframeSrc,
  iframeKey,
  openInNewTabUrl,
}: {
  iframeSrc: string;
  iframeKey: number;
  openInNewTabUrl: string;
}) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
  }, [iframeSrc, iframeKey]);

  return (
    <div className="relative w-full bg-[#F5F3EF]">
      <div className="relative w-full" style={{ minHeight: "70vh" }}>
        {isLoading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#F5F3EF]">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-[#234C6A] border-t-transparent"
              aria-hidden
            />
            <p className="mt-3 text-sm text-slate-500">Loading preview...</p>
          </div>
        ) : null}
        <iframe
          key={iframeKey}
          src={iframeSrc}
          title="Document Preview"
          allowFullScreen
          className="w-full"
          style={{ height: "70vh", border: "none" }}
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
        />
      </div>
      <p className="px-6 pb-3 pt-2 text-center text-xs text-slate-400">
        Preview not loading?{" "}
        <a
          href={openInNewTabUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#234C6A] underline hover:text-[#1b3c53]"
        >
          Open in new tab
        </a>
      </p>
    </div>
  );
}

function DocumentPreviewShell({
  documentTypeLabel,
  fileName,
  fileUrl,
  onClose,
  children,
  showDownload,
}: {
  documentTypeLabel: string;
  fileName: string;
  fileUrl: string;
  onClose: () => void;
  children: React.ReactNode;
  showDownload: boolean;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[6px]"
      style={{ zIndex: PREVIEW_OVERLAY_Z }}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative mx-auto max-h-[95vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-preview-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 p-6">
          <h2
            id="document-preview-modal-title"
            className="font-serif text-xl font-medium leading-snug text-slate-800 md:text-2xl"
          >
            {documentTypeLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </header>
        <div className="border-t border-slate-200" />
        <div className="w-full bg-[#F5F3EF]">{children}</div>
        <footer className="flex items-center justify-between gap-4 border-t border-slate-200 p-6">
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-slate-500" title={fileName}>
            {fileName || "—"}
          </span>
          {showDownload && fileUrl ? (
            <a
              href={fileUrl}
              download={fileName || "document"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#234C6A] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              <Download className="h-4 w-4" strokeWidth={2} aria-hidden />
              Download
            </a>
          ) : (
            <span className="shrink-0 text-sm text-slate-400">Download unavailable</span>
          )}
        </footer>
      </div>
    </div>
  );
}

const FilePreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen = true,
  onClose,
  fileUrl,
  fileName,
  documentType = "File Preview",
  resumeStudentViewContext,
}) => {
  const [iframeKey, setIframeKey] = useState(0);
  const legacyExtension = useMemo(() => extensionFromUrl(fileUrl || ""), [fileUrl]);
  const isPdfLegacy = legacyExtension === "pdf";
  const isExtensionlessLegacy = !legacyExtension && !!fileUrl && fileUrl.length > 0;
  const useBlobPdfLegacy = !resumeStudentViewContext && (isPdfLegacy || isExtensionlessLegacy);

  const pdfDisplaySrc = useInlinePdfSrc(fileUrl, useBlobPdfLegacy);

  const studentValidation = useStudentResumeValidation(fileUrl || "", !!resumeStudentViewContext);

  useEffect(() => {
    setIframeKey(k => k + 1);
  }, [fileUrl]);

  useEffect(() => {
    if (!resumeStudentViewContext || studentValidation.status !== "blocked") return;
    if (
      studentValidation.blockKind !== "incompatible_extension" &&
      studentValidation.blockKind !== "incompatible_content"
    ) {
      return;
    }
    if (!shouldSendResumeFormatNotifyOnce(resumeStudentViewContext.expertId, sessionStorage)) return;
    void notifyExpertResumeFormat(resumeStudentViewContext.expertId);
  }, [resumeStudentViewContext, studentValidation]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (isOpen === false) return null;

  if (!fileUrl || fileUrl === "") {
    return createPortal(
      <DocumentPreviewShell
        documentTypeLabel={documentType}
        fileName={fileName || ""}
        fileUrl=""
        onClose={onClose}
        showDownload={false}
      >
        <div className="flex w-full items-center justify-center px-6" style={{ minHeight: "70vh" }}>
          <p className="text-center text-slate-600">No file exists for preview</p>
        </div>
      </DocumentPreviewShell>,
      document.body,
    );
  }

  if (resumeStudentViewContext) {
    if (studentValidation.status === "loading") {
      return createPortal(
        <DocumentPreviewShell
          documentTypeLabel={documentType}
          fileName={fileName}
          fileUrl={fileUrl}
          onClose={onClose}
          showDownload
        >
          <div className="flex w-full flex-col items-center justify-center bg-[#F5F3EF]" style={{ minHeight: "70vh" }} aria-busy="true">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-[#234C6A] border-t-transparent"
              aria-hidden
            />
            <p className="mt-3 text-sm text-slate-500">Loading preview...</p>
          </div>
        </DocumentPreviewShell>,
        document.body,
      );
    }

    if (studentValidation.status === "blocked") {
      const body =
        studentValidation.blockKind === "preview_error"
          ? STUDENT_RESUME_PREVIEW_UNAVAILABLE_MESSAGE
          : STUDENT_RESUME_BLOCKED_MESSAGE;
      return createPortal(
        <DocumentPreviewShell
          documentTypeLabel={documentType}
          fileName={fileName}
          fileUrl={fileUrl}
          onClose={onClose}
          showDownload
        >
          <div className="flex w-full flex-col items-center justify-center overflow-y-auto bg-[#F5F3EF] px-8 py-6" style={{ minHeight: "70vh" }}>
            <p className="max-w-lg text-center text-sm leading-relaxed text-slate-600">{body}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-8 rounded-xl bg-[#234C6A] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              OK
            </button>
          </div>
        </DocumentPreviewShell>,
        document.body,
      );
    }

    if (studentValidation.status === "ok" && studentValidation.kind === "pdf") {
      const directSrc = pdfIframeSrc(studentValidation.objectUrl);
      return createPortal(
        <DocumentPreviewShell
          documentTypeLabel={documentType}
          fileName={fileName}
          fileUrl={fileUrl}
          onClose={onClose}
          showDownload
        >
          <PdfPreviewFrame
            fileUrlForGoogleAndTab={fileUrl}
            directIframeSrc={directSrc}
            iframeKey={iframeKey}
          />
        </DocumentPreviewShell>,
        document.body,
      );
    }

    if (studentValidation.status === "ok" && studentValidation.kind === "office") {
      const officeSrc = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(studentValidation.url)}`;
      return createPortal(
        <DocumentPreviewShell
          documentTypeLabel={documentType}
          fileName={fileName}
          fileUrl={fileUrl}
          onClose={onClose}
          showDownload
        >
          <SimpleEmbedFrame iframeSrc={officeSrc} iframeKey={iframeKey} openInNewTabUrl={fileUrl} />
        </DocumentPreviewShell>,
        document.body,
      );
    }

    return createPortal(
      <DocumentPreviewShell
        documentTypeLabel={documentType}
        fileName={fileName}
        fileUrl={fileUrl}
        onClose={onClose}
        showDownload
      >
        <PreviewFallback />
      </DocumentPreviewShell>,
      document.body,
    );
  }

  const legacyBody = (): React.ReactNode => {
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(legacyExtension || "")) {
      return (
        <div className="flex w-full items-center justify-center bg-[#F5F3EF] p-4" style={{ minHeight: "70vh" }}>
          <img src={fileUrl} alt={fileName} className="max-h-full max-w-full object-contain" />
        </div>
      );
    }

    if (isPdfLegacy || isExtensionlessLegacy) {
      const directSrc = pdfIframeSrc(pdfDisplaySrc);
      return (
        <PdfPreviewFrame fileUrlForGoogleAndTab={fileUrl} directIframeSrc={directSrc} iframeKey={iframeKey} />
      );
    }

    if (["txt", "md", "json", "csv"].includes(legacyExtension || "")) {
      return <SimpleEmbedFrame iframeSrc={fileUrl} iframeKey={iframeKey} openInNewTabUrl={fileUrl} />;
    }

    if (["docx", "doc", "pptx", "ppt", "xlsx", "xls"].includes(legacyExtension || "")) {
      const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
      return <SimpleEmbedFrame iframeSrc={officeViewerUrl} iframeKey={iframeKey} openInNewTabUrl={fileUrl} />;
    }

    return <PreviewFallback />;
  };

  return createPortal(
    <DocumentPreviewShell
      documentTypeLabel={documentType}
      fileName={fileName}
      fileUrl={fileUrl}
      onClose={onClose}
      showDownload
    >
      {legacyBody()}
    </DocumentPreviewShell>,
    document.body,
  );
};

export default FilePreviewModal;
