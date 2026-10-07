import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Badge from './Badge';
import Checkbox from './Checkbox';
import {
  SELECT_FOCUS_WITHIN_RING,
  SELECT_MENU_CLASS,
  SELECT_MENU_LIST_CLASS,
  SELECT_OPTION_ACTIVE,
  SELECT_OPTION_CLASS,
  SELECT_OPTION_IDLE,
  SELECT_OPTION_SELECTED,
  SELECT_TRIGGER_CLASS,
  SELECT_TRIGGER_ERROR_STATE,
  SELECT_TRIGGER_STATE,
} from './profileFieldStyles';

export type MultiSelectOption = { value: string; label: string };

/** Max chips shown before "+N more" when the selection doesn't fit on one line. */
const COLLAPSED_CHIP_COUNT = 2;

type MultiSelectProps<T extends MultiSelectOption> = {
  /** Trigger id — pair with `<label htmlFor>`. */
  id: string;
  /** Id of that label, used to name the listbox. */
  labelId: string;
  options: T[];
  value: T[];
  onChange: (next: T[]) => void;
  placeholder?: string;
  invalid?: boolean;
  /** Extra ids for aria-describedby (e.g. an error message). */
  describedBy?: string;
};

/**
 * Multi-select with checkbox rows and removable chips in the trigger.
 * Shares MajorSelect's trigger/menu chrome so the two fields look identical.
 */
export default function MultiSelect<T extends MultiSelectOption>({
  id,
  labelId,
  options,
  value,
  onChange,
  placeholder = 'Select',
  invalid = false,
  describedBy,
}: MultiSelectProps<T>) {
  const listId = `${id}-list`;
  const summaryId = `${id}-summary`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  /** Chips that fit on the first line; null when every chip fits. */
  const [fitCount, setFitCount] = useState<number | null>(null);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const chipAreaRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);

  const isSelected = (o: MultiSelectOption) => value.some((v) => v.value === o.value);

  const toggle = (option: T) =>
    onChange(isSelected(option) ? value.filter((v) => v.value !== option.value) : [...value, option]);

  const remove = (option: T) => onChange(value.filter((v) => v.value !== option.value));

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, open]);

  useLayoutEffect(() => {
    const measure = () => {
      const row = measureRef.current;
      if (!row) return;
      const items = Array.from(row.children) as HTMLElement[];
      const moreBadge = items.pop();
      const available = row.clientWidth;
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const widths = items.map((el) => el.offsetWidth);
      const total = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1);
      if (!available || total <= available) {
        setFitCount(null);
        return;
      }
      const reserve = (moreBadge?.offsetWidth ?? 0) + gap;
      let used = 0;
      let count = 0;
      while (count < widths.length && used + widths[count] + reserve <= available) {
        used += widths[count] + gap;
        count += 1;
      }
      setFitCount(count);
    };
    measure();
    if (typeof ResizeObserver === 'undefined' || !chipAreaRef.current) return;
    const observer = new ResizeObserver(measure);
    observer.observe(chipAreaRef.current);
    return () => observer.disconnect();
  }, [value]);

  const openMenu = () => {
    const firstSelected = options.findIndex(isSelected);
    setActiveIndex(firstSelected >= 0 ? firstSelected : 0);
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      openMenu();
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    setKeyboardNav(true);
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
        if (options[activeIndex]) toggle(options[activeIndex]);
        return;
      case 'Escape':
        e.preventDefault();
        close();
        return;
      case 'Tab':
        close(false);
        return;
      default:
    }
  };

  const visibleChips =
    fitCount === null
      ? value
      : value.slice(0, Math.max(1, Math.min(COLLAPSED_CHIP_COUNT, fitCount)));
  const hiddenCount = value.length - visibleChips.length;
  const summary = value.length ? `${value.map((v) => v.label).join(', ')} selected` : 'None selected';

  return (
    <div ref={rootRef} className="relative">
      <div
        className={`relative gap-2 ${SELECT_TRIGGER_CLASS} ${invalid ? SELECT_TRIGGER_ERROR_STATE : SELECT_TRIGGER_STATE} ${SELECT_FOCUS_WITHIN_RING}`}
      >
        <button
          ref={triggerRef}
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={invalid || undefined}
          aria-describedby={[summaryId, describedBy].filter(Boolean).join(' ')}
          onClick={() => (open ? close() : openMenu())}
          onKeyDown={onTriggerKeyDown}
          className="absolute inset-0 h-full w-full cursor-pointer rounded-xl focus:outline-none"
        />
        <span id={summaryId} className="sr-only">
          {summary}
        </span>

        <div ref={chipAreaRef} className="pointer-events-none relative min-w-0 flex-1">
          {value.length ? (
            <div className="-my-1 flex flex-wrap items-center gap-1.5 [&_button]:pointer-events-auto">
              {visibleChips.map((v) => (
                <Badge key={v.value} onRemove={() => remove(v)} removeLabel={`Remove ${v.label}`}>
                  {v.label}
                </Badge>
              ))}
              {hiddenCount > 0 ? <Badge>+{hiddenCount} more</Badge> : null}
            </div>
          ) : (
            <span className="block truncate text-slate-400">{placeholder}</span>
          )}
          <div
            ref={measureRef}
            aria-hidden
            className="invisible absolute inset-x-0 top-0 flex items-center gap-1.5 overflow-hidden"
          >
            {value.map((v) => (
              <span key={v.value} className="shrink-0">
                <Badge onRemove={() => {}} removeLabel="">
                  {v.label}
                </Badge>
              </span>
            ))}
            <span className="shrink-0">
              <Badge>+{value.length} more</Badge>
            </span>
          </div>
        </div>

        <ChevronDown
          size={16}
          aria-hidden
          className={`pointer-events-none relative shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (
        <div className={SELECT_MENU_CLASS}>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            aria-labelledby={labelId}
            aria-activedescendant={options.length ? optionId(activeIndex) : undefined}
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            onMouseMove={() => setKeyboardNav(false)}
            className={`${SELECT_MENU_LIST_CLASS} focus:outline-none`}
          >
            {options.map((option, i) => {
              const selected = isSelected(option);
              const active = i === activeIndex;
              const stateClass = selected
                ? SELECT_OPTION_SELECTED
                : active
                  ? `text-slate-700 ${SELECT_OPTION_ACTIVE}`
                  : SELECT_OPTION_IDLE;
              return (
                <li
                  key={option.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setActiveIndex(i);
                    toggle(option);
                  }}
                  className={`cursor-pointer ${SELECT_OPTION_CLASS} ${stateClass} ${
                    active && keyboardNav ? 'ring-2 ring-inset ring-[#234C6A]/40' : ''
                  }`}
                >
                  <Checkbox
                    checked={selected}
                    readOnly
                    tabIndex={-1}
                    aria-hidden
                    className="pointer-events-none"
                  />
                  <span className="min-w-0 truncate">{option.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
