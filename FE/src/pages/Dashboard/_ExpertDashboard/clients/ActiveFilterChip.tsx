import React from 'react';
import { X } from 'lucide-react';
import { FOCUS_RING, TOUCH_TARGET } from './ui';

export default function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove filter: ${label}`}
      className={`${TOUCH_TARGET} inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-[#E8EEF4] pl-3 pr-2 text-xs font-semibold text-[#234C6A] transition hover:bg-[#DCE6EF] ${FOCUS_RING}`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
    </button>
  );
}
