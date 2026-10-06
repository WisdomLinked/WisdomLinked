import { useState, type FormEvent, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import type { BookingNoticeHours, BufferMinutes } from '../../../types/scheduling';
import {
  VALID_APPOINTMENT_DURATIONS,
  type AppointmentDurationMinutes,
} from '../../../utils/appointmentDurations';
import {
  BUFFER_OPTIONS,
  MIN_HOURLY_RATE,
  NOTICE_OPTIONS,
  RATE_PRESETS,
  bufferLabel,
  isValidRate,
} from './setupSteps';

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A] focus-visible:ring-offset-2';

export const PRIMARY_BUTTON = `inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#234C6A] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1b3c53] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 ${FOCUS_RING}`;

/** The Availability page's session-length pill. */
function SetupPill({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={[
        'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        FOCUS_RING,
        pressed
          ? 'border border-[#234C6A] bg-[#234C6A] text-white'
          : 'border border-gray-200 bg-white text-gray-600 hover:border-[#234C6A]/30 hover:text-[#234C6A]',
      ].join(' ')}
    >
      {pressed ? <Check className="h-3 w-3 shrink-0" aria-hidden /> : null}
      {children}
    </button>
  );
}

function PillGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {children}
    </div>
  );
}

function SaveButton({ disabled, saving, children }: { disabled: boolean; saving: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={disabled || saving} className={PRIMARY_BUTTON}>
      {saving ? 'Saving…' : children}
    </button>
  );
}

/** Runs a save and reports busy state; the parent collapses the row on success. */
function useSave(onSave: () => Promise<boolean>) {
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };
  return { saving, submit };
}

export function RateStepControl({
  initialRate,
  onSave,
}: {
  initialRate: number | undefined;
  onSave: (rate: number) => Promise<boolean>;
}) {
  const [value, setValue] = useState(initialRate != null ? String(initialRate) : '');
  const rate = value.trim() === '' ? undefined : Number(value);
  const valid = isValidRate(rate);
  const showError = value.trim() !== '' && !valid;
  const { saving, submit } = useSave(() => onSave(rate as number));

  return (
    <form onSubmit={submit} className="space-y-3">
      <PillGroup label="Suggested hourly rates">
        {RATE_PRESETS.map((preset) => (
          <SetupPill key={preset} pressed={rate === preset} onClick={() => setValue(String(preset))}>
            {`$${preset} /hr`}
          </SetupPill>
        ))}
      </PillGroup>
      <div className="max-w-xs">
        <label htmlFor="setup-hourly-rate" className="mb-1.5 block text-sm font-medium text-gray-700">
          Custom rate
        </label>
        <div
          className={[
            'flex items-center overflow-hidden rounded-lg border bg-white focus-within:ring-2 focus-within:ring-[#234C6A]',
            showError ? 'border-red-300' : 'border-gray-200',
          ].join(' ')}
        >
          <span className="border-r border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-500">$</span>
          <input
            id="setup-hourly-rate"
            type="number"
            inputMode="decimal"
            min={MIN_HOURLY_RATE}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            aria-invalid={showError || undefined}
            aria-describedby="setup-hourly-rate-hint setup-hourly-rate-error"
            className="w-full min-w-0 flex-1 px-3 py-2.5 text-sm text-gray-800 outline-none"
          />
          <span className="px-3 py-2.5 text-sm text-gray-400">/hr</span>
        </div>
        <p id="setup-hourly-rate-hint" className="mt-1.5 text-xs text-gray-400">
          {`Minimum $${MIN_HOURLY_RATE} per hour`}
        </p>
        <p id="setup-hourly-rate-error" role="alert" className="mt-1 text-xs text-red-500">
          {showError ? `Hourly rate should be at least $${MIN_HOURLY_RATE}.` : ''}
        </p>
      </div>
      <SaveButton disabled={!valid} saving={saving}>
        Save rate
      </SaveButton>
    </form>
  );
}

export function DurationStepControl({
  initialDurations,
  onSave,
}: {
  initialDurations: AppointmentDurationMinutes[];
  onSave: (durations: AppointmentDurationMinutes[]) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState<AppointmentDurationMinutes[]>(initialDurations);
  const { saving, submit } = useSave(() => onSave(selected));
  const toggle = (d: AppointmentDurationMinutes) =>
    setSelected((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );

  return (
    <form onSubmit={submit} className="space-y-3">
      <PillGroup label="Session lengths">
        {VALID_APPOINTMENT_DURATIONS.map((d) => (
          <SetupPill key={d} pressed={selected.includes(d)} onClick={() => toggle(d)}>
            {d} min
          </SetupPill>
        ))}
      </PillGroup>
      {selected.length === 0 ? (
        <p className="text-xs text-gray-500">Select at least one session length.</p>
      ) : null}
      <SaveButton disabled={selected.length === 0} saving={saving}>
        Save lengths
      </SaveButton>
    </form>
  );
}

export function BookingRulesStepControl({
  initialBuffer,
  initialNotice,
  onSave,
}: {
  initialBuffer: BufferMinutes | null;
  initialNotice: BookingNoticeHours | null;
  onSave: (buffer: BufferMinutes, notice: BookingNoticeHours) => Promise<boolean>;
}) {
  const [buffer, setBuffer] = useState<BufferMinutes | null>(initialBuffer);
  const [notice, setNotice] = useState<BookingNoticeHours | null>(initialNotice);
  const ready = buffer !== null && notice !== null;
  const { saving, submit } = useSave(() => onSave(buffer as BufferMinutes, notice as BookingNoticeHours));

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm font-medium text-gray-700">Buffer time</p>
        <p className="mb-2 text-xs text-gray-400">Gap added automatically between bookings</p>
        <PillGroup label="Buffer time">
          {BUFFER_OPTIONS.map((b) => (
            <SetupPill key={b} pressed={buffer === b} onClick={() => setBuffer(b)}>
              {bufferLabel(b)}
            </SetupPill>
          ))}
        </PillGroup>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium text-gray-700">Minimum booking notice</p>
        <p className="mb-2 text-xs text-gray-400">How far ahead students must book</p>
        <PillGroup label="Minimum booking notice">
          {NOTICE_OPTIONS.map((h) => (
            <SetupPill key={h} pressed={notice === h} onClick={() => setNotice(h)}>
              {h} hours
            </SetupPill>
          ))}
        </PillGroup>
      </div>
      <SaveButton disabled={!ready} saving={saving}>
        Save rules
      </SaveButton>
    </form>
  );
}
