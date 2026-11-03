import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { OVERLAY_Z_DIALOG } from '../../utils/overlayLayers';

type AccessibleDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** alertdialog for confirmations */
  role?: 'dialog' | 'alertdialog';
  /** Disable Escape / backdrop while a request is in flight */
  busy?: boolean;
  /** Mobile bottom sheet */
  sheetOnMobile?: boolean;
  danger?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
};

export default function AccessibleDialog({
  open,
  onClose,
  title,
  children,
  footer,
  role = 'dialog',
  busy = false,
  sheetOnMobile = false,
  initialFocusRef,
  className = '',
}: AccessibleDialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTarget =
      initialFocusRef?.current
      || panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
    focusTarget?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose, busy, initialFocusRef]);

  if (!open) return null;

  const panelClass = sheetOnMobile
    ? `relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-wl-line bg-white shadow-xl sm:max-w-lg sm:rounded-xl ${className}`
    : `relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-wl-line bg-white shadow-xl ${className}`;

  return createPortal(
    <div
      className={`fixed inset-0 flex ${
        sheetOnMobile ? 'items-end sm:items-center' : 'items-center'
      } justify-center p-0 sm:p-4`}
      style={{ zIndex: OVERLAY_Z_DIALOG }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[4px]"
        aria-label="Close dialog"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={panelClass}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-wl-line px-5 py-4">
          <h2 id={titleId} className="pr-2 text-sm font-semibold tracking-wide text-wl-ink sm:text-base">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
            className="rounded-md p-1.5 text-wl-muted hover:bg-wl-pageAlt hover:text-wl-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50 disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-wl-line bg-white px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
