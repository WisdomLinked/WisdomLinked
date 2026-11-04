import React, { useEffect, useState } from 'react';
import { doGetUserBlockReason } from '../../../../api/api';
import UserDialogShell from './UserDialogShell';

export default function BlockReasonDialog({
  user,
  onClose,
}: {
  user: { _id?: string; email?: string; username?: string };
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    void doGetUserBlockReason(String(user._id)).then((res: any) => {
      if (res?.status === 'SUCCESS') setReason(res.reason ?? null);
      else setFailed(true);
      setLoading(false);
    });
  }, [user._id]);

  return (
    <UserDialogShell labelledBy="wl-block-reason-title" onDismiss={onClose}>
      <h2 id="wl-block-reason-title" className="shrink-0 text-base font-semibold text-wl-ink">
        Reason for blocking this user
      </h2>
      <p className="mt-1 shrink-0 break-words text-sm text-wl-muted">{user.email || user.username}</p>
      <div className="mt-3 max-h-60 min-h-0 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-wl-muted">Loading…</p>
        ) : failed ? (
          <p role="alert" className="text-sm font-medium text-rose-600">
            Could not load the reason. Please try again.
          </p>
        ) : reason ? (
          <p className="whitespace-pre-wrap break-words text-sm text-wl-ink">{reason}</p>
        ) : (
          <p className="text-sm text-wl-muted">No reason was recorded for this block.</p>
        )}
      </div>
      <div className="mt-4 flex shrink-0 justify-end">
        <button
          type="button"
          autoFocus
          className="rounded-lg border border-wl-line bg-white px-4 py-2 text-sm font-semibold text-wl-muted hover:bg-wl-pageAlt"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </UserDialogShell>
  );
}
