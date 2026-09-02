import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, ChevronDown, Plus } from 'lucide-react';
import { MAJOR_OPTIONS, OTHER_MAJOR, isBaselineMajor } from '../constants/majorOptions';
import { doGetKeywordsAndServices } from '../api/api';

export const MAJOR_MAX_LEN = 50;

const FOCUS_RING = 'focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]';
const ACCENT_BG = 'hover:bg-[#D9EAFD]/60';
const ACCENT_SELECTED = 'bg-[#D9EAFD]/70 text-[#234C6A]';

const toTitleCase = (str: string) =>
  str
    .toLowerCase()
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');

type MajorSelectProps = {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  onBlur?: () => void;
  required?: boolean;
};

export default function MajorSelect({
  value,
  onChange,
  label = 'Major(s)',
  placeholder = 'Select majors',
  error,
  onBlur,
  required,
}: MajorSelectProps) {
  const [open, setOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customMajor, setCustomMajor] = useState('');
  const [customMajors, setCustomMajors] = useState<string[]>(
    () => value.filter((v) => !isBaselineMajor(v)),
  );
  const [officialMajors, setOfficialMajors] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res: any = await doGetKeywordsAndServices();
      if (!active) return;
      const vals = Array.isArray(res?.keywords)
        ? res.keywords.map((k: any) => String(k?.value || '').trim()).filter(Boolean)
        : [];
      setOfficialMajors(vals);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Keep custom options in sync with any non-baseline values arriving from props.
  useEffect(() => {
    setCustomMajors((prev) => {
      const next = [...prev];
      value
        .filter((v) => !isBaselineMajor(v))
        .forEach((v) => {
          if (!next.some((c) => c.toLowerCase() === v.toLowerCase())) next.push(v);
        });
      return next.length === prev.length ? prev : next;
    });
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        if (open) onBlur?.();
        setOpen(false);
        setShowCustomInput(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onBlur]);

  const options = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of [...MAJOR_OPTIONS, ...officialMajors, ...customMajors]) {
      const key = m.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(m);
    }
    return out;
  }, [officialMajors, customMajors]);

  const toggleMajor = (m: string) => {
    const exists = value.some((x) => x.toLowerCase() === m.toLowerCase());
    onChange(exists ? value.filter((x) => x.toLowerCase() !== m.toLowerCase()) : [...value, m]);
  };

  const addCustomMajor = () => {
    const formatted = toTitleCase(customMajor.trim());
    if (!formatted) return;
    if (!options.some((o) => o.toLowerCase() === formatted.toLowerCase())) {
      setCustomMajors((prev) => [...prev, formatted]);
    }
    if (!value.some((x) => x.toLowerCase() === formatted.toLowerCase())) {
      onChange([...value, formatted]);
    }
    setCustomMajor('');
    setShowCustomInput(false);
  };

  return (
    <div ref={rootRef} className="relative">
      {label !== '' && (
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          {label}
          {required && <span className="text-red-400"> *</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-left ${error ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-white'} ${FOCUS_RING} outline-none`}
      >
        <span className={value.length ? 'text-slate-800' : 'text-slate-400'}>
          {value.length ? value.join(', ') : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col">
          <div className="max-h-56 overflow-y-auto">
            {options.map((m) => {
              const selected = value.some((x) => x.toLowerCase() === m.toLowerCase());
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMajor(m)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors ${selected ? `${ACCENT_SELECTED} font-semibold` : `text-slate-700 ${ACCENT_BG}`}`}
                >
                  {selected && <CheckCircle size={14} style={{ color: '#234C6A' }} />}
                  {m}
                </button>
              );
            })}
          </div>
          <div className="border-t border-slate-100">
            {showCustomInput ? (
              <div className="p-2.5 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Type your major"
                    value={customMajor}
                    maxLength={MAJOR_MAX_LEN}
                    autoComplete="new-password"
                    onChange={(e) => setCustomMajor(e.target.value.slice(0, MAJOR_MAX_LEN))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomMajor();
                      }
                    }}
                    className="min-w-0 flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-[#234C6A] focus:ring-1 focus:ring-[#234C6A]"
                  />
                  <button
                    type="button"
                    onClick={addCustomMajor}
                    disabled={!customMajor.trim()}
                    className="shrink-0 rounded-lg bg-[#234C6A] px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between px-0.5">
                  <span className="text-[11px] text-slate-400">
                    No more than {MAJOR_MAX_LEN} characters
                  </span>
                  <span
                    className={`text-[11px] ${customMajor.length >= MAJOR_MAX_LEN ? 'text-amber-600' : 'text-slate-400'}`}
                  >
                    {MAJOR_MAX_LEN - customMajor.length} left
                  </span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-[#234C6A] font-medium hover:bg-[#D9EAFD]/40 transition-colors"
              >
                <Plus size={14} /> {OTHER_MAJOR} (add your own)
              </button>
            )}
          </div>
        </div>
      )}
      {error && (
        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  );
}
