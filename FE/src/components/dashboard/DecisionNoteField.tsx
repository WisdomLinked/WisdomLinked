import React from 'react';

export const DECISION_NOTE_MAX_LENGTH = 280;

const PLACEHOLDER =
  'e.g. "Unavailable that week", "Would 2:30pm Aug 19 work?", "Message me in Chat for another time"';

/**
 * The short note an expert sends with an accept or decline so the student knows
 * what to do next. Required on declines — a rejection with no reason leaves the
 * student with nowhere to go.
 */
export default function DecisionNoteField({
  value,
  onChange,
  required = false,
  disabled = false,
  label,
  autoFocus = false,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  autoFocus?: boolean;
  id?: string;
}) {
  const heading = label ?? (required ? 'Note to the student (required)' : 'Note to the student (optional)');
  const remaining = DECISION_NOTE_MAX_LENGTH - value.length;
  return (
    <div className="w-full text-left">
      <label
        htmlFor={id}
        className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500"
      >
        {heading}
      </label>
      <textarea
        id={id}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        rows={2}
        maxLength={DECISION_NOTE_MAX_LENGTH}
        onChange={e => onChange(e.target.value.slice(0, DECISION_NOTE_MAX_LENGTH))}
        placeholder={PLACEHOLDER}
        className="mt-1 w-full resize-y rounded-[6px] border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-[#234C6A] focus:outline-none disabled:opacity-60"
      />
      <p className="mt-0.5 text-[10px] text-slate-400">
        {remaining} characters left · sent to the student by email
      </p>
    </div>
  );
}
