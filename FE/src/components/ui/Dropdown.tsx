import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type DropdownOption = { value: string; label: string };

/**
 * Listbox-style select with a styled trigger. The trigger turns navy-tinted
 * whenever the value differs from `defaultValue`, so active filters stand out.
 */
export default function Dropdown({
  label,
  value,
  options,
  onChange,
  defaultValue,
  className = '',
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** Value that counts as "not set"; defaults to the first option. */
  defaultValue?: string;
  className?: string;
}) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const listId = `${baseId}-list`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const typeahead = useRef({ text: '', at: 0 });

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];
  const isSet = value !== (defaultValue ?? options[0]?.value);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex);
    listRef.current?.focus();
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    close();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, last));
        return;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        return;
      case 'End':
        e.preventDefault();
        setActiveIndex(last);
        return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(activeIndex);
        return;
      case 'Escape':
        e.preventDefault();
        close();
        return;
      case 'Tab':
        close(false);
        return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const now = Date.now();
          const t = typeahead.current;
          t.text = now - t.at > 600 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
          t.at = now;
          const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(t.text));
          if (hit >= 0) setActiveIndex(hit);
        }
    }
  };

  const triggerState = open
    ? 'border-[#234C6A] ring-2 ring-[#234C6A]/20'
    : isSet
      ? 'border-[#234C6A]'
      : 'border-[#D9D4CB] hover:border-[#B8B2A6]';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <span id={labelId} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B6B63]">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${labelId} ${baseId}-value`}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onTriggerKeyDown}
        className={`flex h-11 w-full items-center gap-2 rounded-[10px] border px-3 text-left text-sm transition focus:outline-none focus-visible:border-[#234C6A] focus-visible:ring-2 focus-visible:ring-[#234C6A]/20 ${triggerState} ${
          isSet ? 'bg-[#E8EEF4] font-medium text-[#234C6A]' : 'bg-white text-[#1A3A4A]'
        }`}
      >
        <span id={`${baseId}-value`} className="min-w-0 flex-1 truncate">
          {selected?.label}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          } ${isSet || open ? 'text-[#234C6A]' : 'text-[#6B6B63]'}`}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={optionId(activeIndex)}
          onKeyDown={onListKeyDown}
          className="scrollbar-thin absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-72 overflow-y-auto rounded-xl border border-[#E5E2DB] bg-white py-1 shadow-[0_14px_28px_rgba(15,23,42,0.12)] focus:outline-none"
        >
          {options.map((option, i) => {
            const isSelected = i === selectedIndex;
            return (
              <li
                key={option.value}
                id={optionId(i)}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm ${
                  i === activeIndex ? 'bg-[#E8EEF4]' : ''
                } ${isSelected ? 'font-semibold text-[#234C6A]' : 'text-[#1A3A4A]'}`}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {isSelected ? <Check className="h-4 w-4 shrink-0 text-[#234C6A]" aria-hidden /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
