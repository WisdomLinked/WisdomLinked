import React from 'react';
import { Download, Shield, X } from 'lucide-react';
import Avatar from '../../../../../components/Avatar';
import { AUDIT_FOCUS, AUDIT_PILL } from './auditUi';
import { formatJoined, roleLabel, statusLabel } from './auditModel';

export default function AuditHeader({
  userDetails,
  titleId,
  onExport,
  onClose,
}: {
  userDetails: any;
  titleId: string;
  onExport: () => void;
  onClose: () => void;
}) {
  const name = userDetails?.username || userDetails?.email || 'Account';
  const joined = formatJoined(userDetails?.createdAt);
  const role = roleLabel(userDetails?.role);
  const status = statusLabel(userDetails?.status);

  return (
    <header className="flex flex-col gap-4 border-b border-audit-line px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-8">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar username={name} image={userDetails?.image} size="large" />
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={titleId} className="truncate text-xl font-semibold text-audit-ink sm:text-2xl">
              {name}
            </h2>
            <span className={`${AUDIT_PILL} bg-audit-brand-soft text-audit-brand`}>{role}</span>
            <span className={`${AUDIT_PILL} bg-audit-sunken text-audit-ink`}>{status}</span>
          </div>
          <p className="truncate text-sm text-audit-muted">
            {userDetails?.email || '—'}
            {joined ? ` · Joined ${joined}` : ''}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`${AUDIT_PILL} gap-1 bg-audit-sunken text-audit-muted`}>
          <Shield className="h-3.5 w-3.5" aria-hidden />
          Read-only view
        </span>
        <button
          type="button"
          onClick={onExport}
          className={`${AUDIT_FOCUS} inline-flex h-9 items-center gap-1.5 rounded-lg border border-audit-line bg-audit-surface px-3 text-sm font-medium text-audit-ink hover:bg-audit-sunken`}
        >
          <Download className="h-4 w-4" aria-hidden />
          Export
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`${AUDIT_FOCUS} inline-flex h-9 w-9 items-center justify-center rounded-lg text-audit-muted hover:bg-audit-sunken hover:text-audit-ink`}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}
