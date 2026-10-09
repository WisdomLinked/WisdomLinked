import React from 'react';
import { FOCUS_RING, TOUCH_TARGET } from './ui';

export default function ServicePill({
  label,
  pressed,
  onToggle,
}: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={`${TOUCH_TARGET} inline-flex h-8 items-center rounded-full border px-3.5 text-sm font-medium transition ${FOCUS_RING} ${
        pressed
          ? 'border-[#234C6A] bg-[#234C6A] text-white hover:bg-[#1b3c53]'
          : 'border-[#D9D4CB] bg-white text-[#1A3A4A] hover:border-[#234C6A]'
      }`}
    >
      {label}
    </button>
  );
}
