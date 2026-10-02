import React from 'react';

export function formatNavBadgeCount(count: number): string | null {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (n <= 0) return null;
  return n > 99 ? '99+' : String(n);
}

export default function NavBadge({
  count,
  label,
}: {
  count: number;
  /** Phrase after the number, e.g. "unread contact requests". */
  label: string;
}) {
  const display = formatNavBadgeCount(count);
  if (!display) return null;
  const n = Math.max(0, Math.floor(count));
  return (
    <span
      className="inline-flex min-w-[16px] items-center justify-center rounded-full bg-green px-1 text-[9px] font-semibold leading-4 text-white"
      aria-label={`${n} ${label}`}
    >
      {display}
    </span>
  );
}
