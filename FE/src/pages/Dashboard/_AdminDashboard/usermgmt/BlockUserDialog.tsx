import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { OVERLAY_Z_DIALOG } from '../../../../utils/overlayLayers';

const REASON_MAX_LENGTH = 500;

export default function BlockUserDialog({
  user,
  onCancel,
  onConfirm,
}: {
  user: { email?: string; username?: string };
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const trimmedReason = reason.trim();

  const cancel = () => {
    if (!saving) onCancel();
  };

  const submit = async () => {
    setSaving(true);
    setFailed(false);
    if (!(await onConfirm(trimmedReason))) {
      setSaving(false);
      setFailed(true);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4"
      style={{ zIndex: OVERLAY_Z_DIALOG }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wl-block-user-title"
      onClick={e => {
        if (e.target === e.currentTarget) cancel();
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') cancel();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-wl-line bg-white p-5 shadow-xl">
        <h2 id="wl-block-user-title" className="text-base font-semibold text-wl-ink">
          Please state the reason for blocking this user
        </h2>
        <p className="mt-1 break-words text-sm text-wl-muted">{user.email || user.username}</p>
        <textarea
          autoFocus
          rows={3}
          maxLength={REASON_MAX_LENGTH}
          value={reason}
          onChange={e => setReason(e.target.value)}
          aria-labelledby="wl-block-user-title"
          placeholder="Enter the reason"
          className="mt-3 w-full resize-none rounded-lg border border-wl-line px-3 py-2 text-sm text-wl-ink outline-none focus:border-wl-brand focus:ring-1 focus:ring-wl-brand"
        />
        {failed ? (
          <p role="alert" className="mt-1 text-xs font-medium text-rose-600">
            Could not block this user. Please try again.
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            className="rounded-lg border border-wl-line bg-white px-4 py-2 text-sm font-semibold text-wl-muted hover:bg-wl-pageAlt disabled:cursor-not-allowed disabled:opacity-50"
            onClick={cancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!trimmedReason || saving}
            className="rounded-lg bg-red px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={submit}
          >
            Block user
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
