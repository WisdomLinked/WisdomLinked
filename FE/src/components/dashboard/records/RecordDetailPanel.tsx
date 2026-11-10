import React, { useEffect } from 'react';
import { AlertTriangle, MousePointer2, X } from 'lucide-react';
import { OVERLAY_Z_DIALOG } from '../../../utils/overlayLayers';
import { AvatarMark, FOCUS } from './RecordAtoms';

export type RecordHeader = {
  title: string;
  subtitle?: string;
  image?: string;
  unknownUser: boolean;
};

/**
 * Details of the selected row: a column beside the list on large screens,
 * a sheet from the bottom on phones. Render it twice, once per variant.
 */
export default function RecordDetailPanel({
  header,
  status,
  actions,
  children,
  onClose,
  variant,
}: {
  /** null when nothing is selected. */
  header: RecordHeader | null;
  status?: React.ReactNode;
  /** Buttons for the selected record, shown under the header. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
  onClose: () => void;
  variant: 'column' | 'sheet';
}) {
  const open = Boolean(header);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const body = (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      {header ? (
        <>
          <div className="shrink-0 border-b border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {header.unknownUser ? (
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn">
                    <AlertTriangle size={22} aria-hidden />
                  </span>
                ) : (
                  <AvatarMark name={header.title} image={header.image} size={48} />
                )}
                <div className="min-w-0">
                  <div className="break-words text-lg font-semibold text-ink">{header.title}</div>
                  {header.subtitle ? <div className="mt-0.5 break-words text-sm text-muted">{header.subtitle}</div> : null}
                  {status ? <div className="mt-1.5">{status}</div> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`rounded-md p-1 text-muted hover:bg-sunken hover:text-ink ${FOCUS}`}
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>
            {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">{children}</div>
        </>
      ) : (
        <div className="flex h-full min-w-0 flex-col items-center justify-center px-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sunken text-muted">
            <MousePointer2 size={20} aria-hidden />
          </div>
          <p className="font-medium text-ink">Nothing selected</p>
          <p className="mt-1 text-sm text-muted">Select a row to see details.</p>
        </div>
      )}
    </div>
  );

  if (variant === 'column') {
    return <aside className="hidden min-h-0 min-w-0 flex-col border-l border-line bg-surface lg:flex">{body}</aside>;
  }

  if (!header) return null;
  return (
    <div className="fixed inset-0 lg:hidden" style={{ zIndex: OVERLAY_Z_DIALOG }} role="dialog" aria-modal="true" aria-label="Record details">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close details" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-xl bg-surface shadow-[0_-8px_32px_rgba(35,76,106,0.16)]">
        <div className="h-[min(85vh,640px)]">{body}</div>
      </div>
    </div>
  );
}
