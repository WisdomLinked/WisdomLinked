import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { FOCUS } from './termsModel';
import { OVERLAY_Z_DIALOG } from '../../../../utils/overlayLayers';

export default function TermsDialog({
  title,
  subtitle,
  titleAction,
  escapeCloses = true,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Shown beside the title, e.g. "View document" on an agreement preview. */
  titleAction?: React.ReactNode;
  /** False while something opened on top (the document viewer) should take Escape instead. */
  escapeCloses?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const escapeClosesRef = useRef(escapeCloses);
  escapeClosesRef.current = escapeCloses;

  useEffect(() => {
    const id = window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && escapeClosesRef.current) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: OVERLAY_Z_DIALOG }}
      role="presentation"
    >
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Dismiss dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-dialog-title"
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 id="terms-dialog-title" className="text-base font-semibold text-slate-900">
                {title}
              </h2>
              {titleAction}
            </div>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={`${FOCUS} rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900`}
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
