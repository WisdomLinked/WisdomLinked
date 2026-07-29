import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Plus } from 'lucide-react';

export type SelectOption = { value: string; label: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  placeholder?: string;
  footerAction?: { label: string; onSelect: () => void };
};

/**
 * Brand-styled select dropdown. Matches DatePickerField / TimePickerField:
 * a trigger button plus a fixed-height, scrollable list that always opens
 * downward (native <select> can't cap its popup height or direction).
 */
export default function SelectField({
  value,
  onChange,
  options,
  id,
  placeholder = 'Select…',
  footerAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  const selected = options.find(o => o.value === value);

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

  // Scroll the selected option into view when the list opens.
  useEffect(() => {
    if (open && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'center' });
    }
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#234C6A]"
      >
        <span className={`min-w-0 truncate ${selected ? 'text-gray-800' : 'text-gray-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#234C6A]" aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 flex w-max min-w-full max-w-[18rem] flex-col overflow-hidden rounded-xl border border-[#E5E2DB] bg-white shadow-[0_20px_50px_rgba(26,58,74,0.15)]">
          <div className="max-h-60 overflow-y-auto p-1.5">
            {options.map(opt => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  ref={isSelected ? selectedRef : undefined}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-[#1A3A4A] font-semibold text-white'
                      : 'text-[#1A3A4A] hover:bg-[#E8F0F8]'
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
          {footerAction && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                footerAction.onSelect();
              }}
              className="flex w-full items-center gap-2 border-t border-[#E5E2DB] px-4 py-3 text-left text-sm font-medium text-[#234C6A] hover:bg-[#E8F0F8]"
            >
              <Plus className="h-4 w-4" /> {footerAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
