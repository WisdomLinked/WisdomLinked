import React from 'react';

/** Playfair Display wordmark matching the landing header. */
export default function BrandWordmark({ className }: { className?: string }) {
  return (
    <span
      className={`font-serif font-bold text-[1.35rem] text-slate-900 tracking-normal ${className || ''}`}
    >
      WisdomLinked
    </span>
  );
}
