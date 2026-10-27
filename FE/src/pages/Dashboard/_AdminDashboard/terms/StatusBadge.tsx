import React from 'react';
import type { SignatureTone } from './termsModel';

const TONE: Record<SignatureTone, { className: string; label: string }> = {
  current: { className: 'bg-emerald-50 text-emerald-800', label: 'Current' },
  outdated: { className: 'bg-amber-50 text-amber-800', label: 'Needs update' },
  missing: { className: 'bg-red-50 text-red-800', label: 'Not signed' },
};

export default function StatusBadge({
  tone,
  children,
}: {
  tone: SignatureTone | 'current-version';
  children?: React.ReactNode;
}) {
  if (tone === 'current-version') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
        Current
      </span>
    );
  }
  const meta = TONE[tone];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {children || meta.label}
    </span>
  );
}
