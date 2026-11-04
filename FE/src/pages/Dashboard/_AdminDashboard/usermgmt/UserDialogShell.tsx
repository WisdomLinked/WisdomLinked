import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { OVERLAY_Z_DIALOG } from '../../../../utils/overlayLayers';

/** The second click of a double click lands on the backdrop of the popup the first click opened. */
const IGNORE_BACKDROP_MS = 500;

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)';

export default function UserDialogShell({
  labelledBy,
  onDismiss,
  children,
}: {
  labelledBy: string;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const openedAt = useRef(Date.now());
  const pressedBackdrop = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const keepTabInside = (e: React.KeyboardEvent) => {
    const panel = panelRef.current;
    const items = Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4"
      style={{ zIndex: OVERLAY_Z_DIALOG }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onMouseDown={e => {
        pressedBackdrop.current = e.target === e.currentTarget;
        // Pressing the backdrop must not pull the cursor out of the popup.
        if (pressedBackdrop.current) e.preventDefault();
      }}
      onClick={e => {
        // A drag that starts inside and ends outside also clicks the backdrop; only a press on it counts.
        if (e.target !== e.currentTarget || !pressedBackdrop.current) return;
        if (Date.now() - openedAt.current >= IGNORE_BACKDROP_MS) onDismiss();
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') onDismiss();
        if (e.key === 'Tab') keepTabInside(e);
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="flex max-h-full w-full max-w-sm flex-col overflow-y-auto rounded-2xl border border-wl-line bg-white p-5 shadow-xl outline-none"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
