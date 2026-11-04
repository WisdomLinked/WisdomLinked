import React, { useState } from 'react';
import UserDialogShell from './UserDialogShell';

const REASON_MAX_LENGTH = 500;
const INVISIBLE_CHARACTERS = new RegExp('\\p{Cf}', 'gu');

export type BlockResult = 'blocked' | 'alreadyBlocked' | 'failed';

export default function BlockUserDialog({
  user,
  onCancel,
  onConfirm,
}: {
  user: { email?: string; username?: string };
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<BlockResult>;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [alreadyBlocked, setAlreadyBlocked] = useState(false);
  const trimmedReason = reason.trim();
  const hasVisibleText = trimmedReason.replace(INVISIBLE_CHARACTERS, '').trim().length > 0;

  const cancel = () => {
    if (!saving) onCancel();
  };

  const submit = async () => {
    setSaving(true);
    setFailed(false);
    const result = await onConfirm(trimmedReason);
    if (result === 'blocked') return;
    setSaving(false);
    if (result === 'alreadyBlocked') setAlreadyBlocked(true);
    else setFailed(true);
  };

  return (
    <UserDialogShell labelledBy="wl-block-user-title" onDismiss={cancel}>
      <h2 id="wl-block-user-title" className="text-base font-semibold text-wl-ink">
        Please state the reason for blocking this user
      </h2>
      <p className="mt-1 break-words text-sm text-wl-muted">{user.email || user.username}</p>
      <textarea
        autoFocus
        rows={3}
        maxLength={REASON_MAX_LENGTH}
        value={reason}
        disabled={alreadyBlocked}
        onChange={e => setReason(e.target.value)}
        aria-labelledby="wl-block-user-title"
        placeholder="Enter the reason"
        className="mt-3 w-full shrink-0 resize-none rounded-lg border border-wl-line px-3 py-2 text-sm text-wl-ink outline-none focus:border-wl-brand focus:ring-1 focus:ring-wl-brand disabled:bg-wl-pageAlt disabled:text-wl-muted"
      />
      {failed ? (
        <p role="alert" className="mt-1 text-xs font-medium text-rose-600">
          Could not block this user. Please try again.
        </p>
      ) : null}
      {alreadyBlocked ? (
        <p role="alert" className="mt-1 text-xs font-medium text-rose-600">
          This user is already blocked, so this reason was not saved. The original reason was kept.
        </p>
      ) : null}
      <div className="mt-4 flex shrink-0 justify-end gap-2">
        <button
          type="button"
          disabled={saving}
          className="rounded-lg border border-wl-line bg-white px-4 py-2 text-sm font-semibold text-wl-muted hover:bg-wl-pageAlt disabled:cursor-not-allowed disabled:opacity-50"
          onClick={cancel}
        >
          {alreadyBlocked ? 'Close' : 'Cancel'}
        </button>
        <button
          type="button"
          disabled={!hasVisibleText || saving || alreadyBlocked}
          className="rounded-lg bg-red px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={submit}
        >
          Block user
        </button>
      </div>
    </UserDialogShell>
  );
}
