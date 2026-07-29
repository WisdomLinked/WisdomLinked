import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Filter, ChevronDown, Check } from 'lucide-react';

export type FilterOption = { value: string; label: string };

export default function FilterDropdown({
  label,
  value,
  options,
  onChange,
  widthClass = 'md:w-44',
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const triggerId = `${label.replace(/\s+/g, '-').toLowerCase()}-trigger`;
  const panelId = `${label.replace(/\s+/g, '-').toLowerCase()}-panel`;

  const selected = useMemo(
    () => options.find(o => o.value === value) ?? options[0],
    [options, value],
  );

  useEffect(() => {
    const idx = options.findIndex(o => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [options, value, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-option-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const openAndFocusSelected = () => {
    setOpen(true);
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openAndFocusSelected();
      if (event.key === 'ArrowDown') {
        setActiveIndex(prev => Math.min(prev + 1, options.length - 1));
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openAndFocusSelected();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    }
  };

  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(prev => (prev + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(prev => (prev - 1 + options.length) % options.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) {
        onChange(option.value);
        setOpen(false);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={widthClass}>
      <div className="mb-1 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[#7A7A72]">
        {label}
      </div>
      <div className="relative">
        <button
          id={triggerId}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(v => !v)}
          onKeyDown={onTriggerKeyDown}
          className="group flex w-full items-center gap-2 rounded-xl border border-[#E5E2DB] bg-white px-3 py-2 text-left text-xs text-[#1A3A4A] shadow-sm transition hover:border-[#BCD6EA] focus:outline-none focus:ring-2 focus:ring-[#234C6A]/20"
        >
          <Filter className="h-3.5 w-3.5 shrink-0 text-[#7A7A72]" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{selected?.label ?? options[0]?.label}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-[#7A7A72] transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </button>
        <div
          id={panelId}
          role="listbox"
          aria-labelledby={triggerId}
          ref={listRef}
          tabIndex={-1}
          onKeyDown={onPanelKeyDown}
          className={`absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-64 overflow-y-auto rounded-xl border border-[#E5E2DB] bg-white p-1 shadow-[0_14px_28px_rgba(15,23,42,0.12)] transition-all duration-200 ${
            open
              ? 'pointer-events-auto translate-y-0 opacity-100'
              : 'pointer-events-none -translate-y-1 opacity-0'
          }`}
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            const isActive = idx === activeIndex;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-option-index={idx}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition ${
                  isActive ? 'bg-[#E8EEF4] text-[#234C6A]' : 'text-[#1A3A4A] hover:bg-[#E8EEF4]/70'
                }`}
              >
                <span className="truncate">{option.label}</span>
                <span className="ml-2 w-4 text-right">
                  {isSelected ? <Check className="h-3.5 w-3.5 text-[#234C6A]" aria-hidden /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
