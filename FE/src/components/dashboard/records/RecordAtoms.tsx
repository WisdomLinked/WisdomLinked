import React, { useState } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import {
  formatSnapshotDateParts,
  initialsFromName,
  statusLabel,
  statusPillClass,
  statusTone,
  type StatusTone,
} from '../../../utils/adminSnapshotDisplay';

export const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50';

export function StatusPill({
  status,
  locked = false,
  label,
  title,
  tone,
}: {
  status?: string;
  locked?: boolean;
  /** Overrides the default wording (the Payments page uses its own status names). */
  label?: string;
  /** Hover text explaining the status. */
  title?: string;
  tone?: StatusTone;
}) {
  if (!status) return null;
  return (
    <span
      className={`inline-flex items-baseline rounded-full px-2.5 py-0.5 text-xs font-medium ${statusPillClass(tone || statusTone(status))}`}
      title={title || undefined}
    >
      {label || statusLabel(status)}
      {locked ? (
        <span data-testid="snapshot-locked-tag" className="ml-1 text-[10px] font-normal text-rose-600">
          (locked)
        </span>
      ) : null}
    </span>
  );
}

export function DateCell({ value }: { value: unknown }) {
  const parts = formatSnapshotDateParts(value);
  if (parts.missing) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-800">
        <AlertTriangle size={14} aria-hidden />
        No date set
      </span>
    );
  }
  return (
    <span className="block min-w-0">
      <span className="block tabular-nums text-ink">{parts.date}</span>
      <span className="block text-xs text-muted">
        {parts.time} · {parts.relative}
      </span>
    </span>
  );
}

export function UserCell({ label, missing }: { label: string; missing: boolean }) {
  if (missing) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-800">
        <AlertTriangle size={14} aria-hidden />
        Unknown user
      </span>
    );
  }
  return <span className="break-words">{label}</span>;
}

export function AvatarMark({ name, image, size = 36 }: { name: string; image?: string; size?: number }) {
  const dim = `${size}px`;
  if (image) {
    return <img src={image} alt="" className="shrink-0 rounded-full object-cover" style={{ width: dim, height: dim }} />;
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-wl-brand"
      style={{ width: dim, height: dim }}
    >
      {initialsFromName(name)}
    </span>
  );
}

export function Field({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  if (value == null || value === false || value === '') return null;
  if (wide) {
    return (
      <div className="min-w-0 bg-surface px-3 py-2.5">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="mt-1 whitespace-pre-line break-words text-sm font-medium text-ink">{value}</dd>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 bg-surface px-3 py-2.5">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

export function CopyIntent({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <code className="min-w-0 truncate font-mono text-xs text-ink">{value}</code>
      <button
        type="button"
        aria-label={copied ? 'Copied' : 'Copy payment intent'}
        className={`shrink-0 rounded p-0.5 text-muted hover:text-ink ${FOCUS}`}
        onClick={async e => {
          e.stopPropagation();
          if (!navigator.clipboard?.writeText) return;
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </span>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  if (!items.length) return null;
  return (
    <section className="min-w-0">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h4>
      <dl className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">{items}</dl>
    </section>
  );
}
