import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59

type Props = {
  /** Selected time as 24h "HH:mm" (empty string when unset). */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
};

type Period = 'AM' | 'PM';

/** "14:30" -> { hour12: 2, minute: 30, period: 'PM' } */
function parseTime(value: string): { hour12: number; minute: number; period: Period } {
  if (!/^\d{1,2}:\d{2}$/.test(value)) {
    return { hour12: 12, minute: 0, period: 'AM' };
  }
  const [h, m] = value.split(':').map(Number);
  const period: Period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { hour12, minute: m, period };
}

/** { hour12, minute, period } -> 24h "HH:mm" */
function composeTime(hour12: number, minute: number, period: Period): string {
  let h = hour12 % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const to12h = (value: string): string => {
  const { hour12, minute, period } = parseTime(value);
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
};

/**
 * Small custom dropdown that always opens downward with a fixed-height,
 * scrollable list (native <select> can't cap its popup height/direction).
 */
function ScrollSelect({
  value,
  options,
  onChange,
  ariaLabel,
  format = String,
}: {
  value: number;
  options: number[];
  onChange: (value: number) => void;
  ariaLabel: string;
  format?: (n: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'center' });
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen(v => !v)}
        className="w-14 rounded-md border border-gray-200 px-3 py-2 text-center text-lg font-semibold tabular-nums text-[#1A3A4A] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#234C6A]"
      >
        {format(value)}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-[#E5E2DB] bg-white shadow-[0_12px_30px_rgba(26,58,74,0.15)]">
          {options.map(o => {
            const isSelected = o === value;
            return (
              <button
                key={o}
                type="button"
                ref={isSelected ? selectedRef : undefined}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-1.5 text-center text-sm tabular-nums transition-colors ${
                  isSelected
                    ? 'bg-[#1A3A4A] font-semibold text-white'
                    : 'text-[#1A3A4A] hover:bg-[#E8F0F8]'
                }`}
              >
                {format(o)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Brand-styled time picker popover. Drop-in replacement for a native
 * <input type="time">: emits/accepts a 24h "HH:mm" string and supports any
 * minute (hour : minute + AM/PM), just with styling that matches DatePickerField.
 */
export default function TimePickerField({
  value,
  onChange,
  id,
  placeholder = 'Select a time',
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const { hour12, minute, period } = parseTime(value);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const emit = (h: number, m: number, p: Period) => onChange(composeTime(h, m, p));

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#234C6A]"
      >
        <span className={value ? 'text-gray-800' : 'text-gray-400'}>
          {value ? to12h(value) : placeholder}
        </span>
        <Clock className="h-4 w-4 text-[#234C6A]" aria-hidden />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-[#E5E2DB] bg-white p-4 shadow-[0_20px_50px_rgba(26,58,74,0.15)]">
          <div className="flex items-center justify-center gap-2">
            {/* Hour */}
            <ScrollSelect
              ariaLabel="Hour"
              value={hour12}
              options={HOURS}
              onChange={h => emit(h, minute, period)}
            />

            <span className="pb-0.5 text-lg font-semibold text-[#1A3A4A]">:</span>

            {/* Minute */}
            <ScrollSelect
              ariaLabel="Minute"
              value={minute}
              options={MINUTES}
              onChange={m => emit(hour12, m, period)}
              format={n => String(n).padStart(2, '0')}
            />

            {/* AM / PM */}
            <div className="ml-1 flex flex-col gap-1">
              {(['AM', 'PM'] as Period[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => emit(hour12, minute, p)}
                  className={`rounded-md px-3 py-1 text-sm font-semibold transition-colors ${
                    period === p
                      ? 'bg-[#1A3A4A] text-white'
                      : 'border border-[#E5E2DB] text-[#1A3A4A] hover:bg-[#E8F0F8]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-4 w-full rounded-lg bg-[#1A3A4A] py-2 text-sm font-semibold text-white hover:bg-[#122635]"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
