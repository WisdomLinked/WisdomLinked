import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { OVERLAY_Z_DIALOG } from '../../utils/overlayLayers';

export const paymentDialogLabelClass = 'mb-1 block text-sm font-medium text-slate-600';

export const paymentDialogHintClass = 'mt-1 text-xs text-slate-500';

export const paymentDialogFieldClass =
  'h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-wl-brand focus:ring-2 focus:ring-wl-brand/40';

export const paymentDialogTextareaClass =
  'w-full resize-none rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-wl-brand focus:ring-2 focus:ring-wl-brand/40';

export const paymentDialogDisabledFieldClass =
  'h-12 w-full cursor-not-allowed rounded-lg border border-slate-300 bg-slate-100 px-4 text-sm text-slate-500 outline-none';

export const paymentDialogSecondaryButtonClass =
  'flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/40';

export const paymentDialogPrimaryButtonClass =
  'flex-1 rounded-lg bg-wl-brand px-4 py-2.5 text-sm font-medium text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50';

export const paymentDialogDangerButtonClass =
  'flex-1 rounded-lg bg-red px-4 py-2.5 text-sm font-medium text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/50';

type AdminPaymentDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export default function AdminPaymentDialog({
  isOpen,
  onClose,
  title,
  titleId,
  children,
  footer,
}: AdminPaymentDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: OVERLAY_Z_DIALOG }}>
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[4px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-lg"
      >
        <button
          type="button"
          className="absolute right-3 top-3 z-10 rounded-md p-1 text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        <h2 id={titleId} className="shrink-0 px-6 pt-6 pr-12 text-xl font-bold text-slate-900">
          {title}
        </h2>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pt-6">{children}</div>
        <div className="mt-0 flex shrink-0 gap-3 border-t border-slate-200 bg-white px-6 py-4">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}
