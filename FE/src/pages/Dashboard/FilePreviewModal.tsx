import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

/** Above `ProfileModal` and similar overlays that use z-[200]. */
const PREVIEW_OVERLAY_Z = 500;

interface FilePreviewModalProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}

function extensionFromUrl(fileUrl: string): string {
  try {
    const u = new URL(fileUrl, typeof window !== "undefined" ? window.location.href : "http://localhost");
    const base = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const dot = base.lastIndexOf(".");
    if (dot <= 0) return "";
    return base.slice(dot + 1).toLowerCase();
  } catch {
    const seg =
      fileUrl
        .split("?")[0]
        .split("#")[0]
        .split("/")
        .filter(Boolean)
        .pop() ?? "";
    const dot = seg.lastIndexOf(".");
    if (dot <= 0) return "";
    return seg.slice(dot + 1).toLowerCase();
  }
}

function pdfIframeSrc(displaySrc: string): string {
  if (!displaySrc) return displaySrc;
  if (displaySrc.startsWith("blob:")) return displaySrc;
  return displaySrc.includes("#") ? displaySrc : `${displaySrc}#view=FitH`;
}

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

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ fileUrl, fileName, onClose }) => {
  const extension = useMemo(() => extensionFromUrl(fileUrl || ""), [fileUrl]);
  const isPdf = extension === "pdf";
  /** Paths without an extension (common for stored resumes) — try blob preview for inline viewing. */
  const isExtensionless = !extension && !!fileUrl && fileUrl.length > 0;
  const useBlobPdf = isPdf || isExtensionless;

  const pdfDisplaySrc = useInlinePdfSrc(fileUrl, useBlobPdf);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!fileUrl || fileUrl === "") {
    return createPortal(
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
        style={{ zIndex: PREVIEW_OVERLAY_Z }}
        role="presentation"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-3xl rounded-lg bg-white p-4 shadow-lg"
          role="dialog"
          aria-modal="true"
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-3 text-xl text-gray-500 hover:text-red-500"
            aria-label="Close"
          >
            &times;
          </button>
          <h2 className="mb-4 text-lg font-semibold text-black">No file exists for preview</h2>
        </div>
      </div>,
      document.body,
    );
  }

  const renderPreview = () => {
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension || "")) {
      return <img src={fileUrl} alt={fileName} className="mx-auto max-h-[80vh] rounded-md" />;
    }

    if (isPdf || isExtensionless) {
      const src = pdfIframeSrc(pdfDisplaySrc);
      return (
        <iframe
          src={src}
          title="PDF Preview"
          className="h-[min(80vh,800px)] w-full rounded-md border border-slate-200 bg-slate-100"
        />
      );
    }

    if (["txt", "md", "json", "csv"].includes(extension || "")) {
      return (
        <iframe
          src={fileUrl}
          title="Text Preview"
          className="h-[60vh] w-full rounded-md border border-slate-200 bg-white"
        />
      );
    }

    if (["docx", "doc", "pptx", "ppt", "xlsx", "xls"].includes(extension || "")) {
      const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;

      return (
        <iframe
          src={officeViewerUrl}
          title={`${(extension || "unknown").toUpperCase()} Preview`}
          className="h-[80vh] w-full rounded-md border border-slate-200"
          frameBorder={0}
        />
      );
    }

    return <div className="text-sm text-gray-400">Preview not available for this file type.</div>;
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      style={{ zIndex: PREVIEW_OVERLAY_Z }}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative max-h-[95vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white p-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-preview-title"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-lg bg-white/90 px-2 py-1 text-xl leading-none text-gray-600 shadow-sm hover:bg-white hover:text-red-600"
          aria-label="Close preview"
        >
          &times;
        </button>
        <h2 id="file-preview-title" className="mb-3 pr-10 text-lg font-semibold break-all text-slate-900">
          {fileName}
        </h2>
        <div className="max-h-[calc(95vh-5rem)] overflow-auto">{renderPreview()}</div>
      </div>
    </div>,
    document.body,
  );
};

export default FilePreviewModal;
