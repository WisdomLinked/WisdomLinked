import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';

export interface RecurrenceInfoButtonProps {
  title: string;
  lines: string[];
  label?: string;
}

const PANEL_WIDTH = 320;
const VIEWPORT_MARGIN = 8;

export default function RecurrenceInfoButton({
  title,
  lines,
  label = 'Recurring seminar schedule',
}: RecurrenceInfoButtonProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openOnPointerDown = useRef<boolean | null>(null);

  const place = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelWidth = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const preferredLeft = rect.right + 8;
    const rightLimit = Math.max(
      VIEWPORT_MARGIN,
      window.innerWidth - panelWidth - VIEWPORT_MARGIN,
    );
    const fitsOnRight = preferredLeft <= rightLimit;
    const panelHeight = panelRef.current?.getBoundingClientRect().height ?? 0;
    let top = fitsOnRight ? rect.top : rect.bottom + 6;
    if (top + panelHeight > window.innerHeight - VIEWPORT_MARGIN) {
      top = fitsOnRight
        ? window.innerHeight - VIEWPORT_MARGIN - panelHeight
        : rect.top - 6 - panelHeight;
    }
    setPosition({
      top: Math.max(VIEWPORT_MARGIN, top),
      left: Math.max(VIEWPORT_MARGIN, Math.min(preferredLeft, rightLimit)),
    });
  }, []);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  const hide = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place, lines]);

  useEffect(() => {
    if (!open) return undefined;
    const reposition = () => place();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        className="inline-flex shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onPointerDown={() => { openOnPointerDown.current = open; }}
        onKeyDown={e => {
          openOnPointerDown.current = null;
          if (e.key === 'Escape') hide();
        }}
        onClick={e => {
          e.stopPropagation();
          const wasOpen = openOnPointerDown.current ?? open;
          openOnPointerDown.current = null;
          if (wasOpen) hide();
          else show();
        }}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && position ? (
        <div
          ref={panelRef}
          role="tooltip"
          style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
          className="pointer-events-none fixed z-[60] max-w-[calc(100vw-1rem)] rounded-lg bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-white shadow-lg"
        >
          <p className="font-semibold">{title}</p>
          {lines.map((line, i) => (
            <p key={`${i}-${line}`} className="text-slate-200">
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}
