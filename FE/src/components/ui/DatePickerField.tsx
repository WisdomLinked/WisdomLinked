import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfDay,
  addMonths,
  subMonths,
} from 'date-fns';

type Props = {
  /** Selected date as YYYY-MM-DD (empty string when unset). */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable date as YYYY-MM-DD; earlier days are disabled. */
  min?: string;
  id?: string;
  placeholder?: string;
};

const WEEKDAYS = [
  { key: 'sun', label: 'S' },
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'S' },
];

/**
 * Brand-styled month calendar popover. Drop-in replacement for a native
 * <input type="date">: emits/accepts a YYYY-MM-DD string. Colors match the
 * student booking calendar so date selection looks consistent site-wide.
 */
export default function DatePickerField({
  value,
  onChange,
  min,
  id,
  placeholder = 'Select a date',
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : null;
  const [viewMonth, setViewMonth] = useState<Date>(selected ?? new Date());
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Jump the visible month to the selected date when it changes externally.
  useEffect(() => {
    if (value) setViewMonth(parseISO(value));
  }, [value]);

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

  const minDate = min ? startOfDay(parseISO(min)) : null;

  const gridDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth)),
    end: endOfWeek(endOfMonth(viewMonth)),
  });

  const handlePick = (day: Date) => {
    onChange(format(day, 'yyyy-MM-dd'));
    setOpen(false);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#234C6A]"
      >
        <span className={selected ? 'text-gray-800' : 'text-gray-400'}>
          {selected ? format(selected, 'EEE, MMM d, yyyy') : placeholder}
        </span>
        <CalendarIcon className="h-4 w-4 text-[#234C6A]" aria-hidden />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-[18rem] rounded-xl border border-[#E5E2DB] bg-white p-3 shadow-[0_20px_50px_rgba(26,58,74,0.15)]">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth(m => subMonths(m, 1))}
              className="rounded-lg p-1.5 text-[#234C6A] hover:bg-[#F5F3EF]"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-[#1A3A4A]">
              {format(viewMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(m => addMonths(m, 1))}
              className="rounded-lg p-1.5 text-[#234C6A] hover:bg-[#F5F3EF]"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-[#7A7A72]">
            {WEEKDAYS.map(d => (
              <span key={d.key}>{d.label}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {gridDays.map(day => {
              const inMonth = isSameMonth(day, viewMonth);
              const isSelected = selected ? isSameDay(day, selected) : false;
              const isToday = isSameDay(day, new Date());
              const disabled = minDate ? isBefore(startOfDay(day), minDate) : false;
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => handlePick(day)}
                  className={[
                    'h-9 w-9 rounded-lg text-sm transition-colors',
                    isSelected
                      ? 'bg-[#1A3A4A] font-semibold text-white'
                      : disabled
                        ? 'cursor-not-allowed text-gray-300'
                        : inMonth
                          ? 'text-[#1A3A4A] hover:bg-[#E8F0F8]'
                          : 'text-gray-400 hover:bg-[#F5F3EF]',
                    !isSelected && isToday ? 'ring-1 ring-[#234C6A]/40' : '',
                  ].join(' ')}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
