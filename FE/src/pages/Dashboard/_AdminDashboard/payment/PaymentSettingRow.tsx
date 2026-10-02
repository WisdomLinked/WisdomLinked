import React from 'react';

export default function PaymentSettingRow({
  id,
  label,
  hint,
  value,
  min,
  max,
  savedValue,
  saving,
  onChange,
  onSave,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  min: number;
  max: number;
  savedValue: number;
  saving: boolean;
  onChange: (next: string) => void;
  onSave: () => void;
}) {
  const numeric = Number(value);
  const valid = Number.isFinite(numeric) && numeric >= min && numeric <= max && /^\d+$/.test(value.trim());
  const dirty = value.trim() !== String(savedValue);
  const disabled = !dirty || !valid || saving;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-sm font-medium text-wl-ink">
          {label}
        </label>
        <p className="mt-0.5 text-[13px] text-wl-muted">{hint}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(e.target.value.replace(/[^\d]/g, ''))}
          aria-invalid={value !== '' && !valid}
          className="h-9 w-24 rounded-[10px] border border-wl-line bg-white px-3 text-sm text-wl-ink"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={disabled}
          className="h-9 rounded-full bg-wl-brand px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
