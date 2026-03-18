import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';

type AvailabilityMode = 'common' | 'daily';

type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

interface TimeSlot {
  hour: number;       // 0–23
  label: string;      // e.g. "9:00 AM"
  period: 'AM' | 'PM';
}

interface DailyAvailability {
  day: DayOfWeek;
  enabled: boolean;
  selectedSlots: number[]; // array of hour values
}

interface AvailabilityFormState {
  hourlyRate: string;
  timezone: string;
  sessionDuration: number;   // minutes: 30 | 60 | 90
  bufferTime: number;        // minutes: 0 | 15 | 30
  mode: AvailabilityMode;
  commonSlots: number[];     // selected hours for Common mode
  dailyAvailability: DailyAvailability[];
}

type BannerType = 'success' | 'error' | null;

interface BannerState {
  type: BannerType;
  message: string;
}

const TIMEZONES: string[] = [
  'UTC',
  'US/Eastern (EST)',
  'US/Central (CST)',
  'US/Pacific (PST)',
  'India (IST)',
  'London (GMT)',
  'Europe (CET)',
  'Australia (AEST)',
];

const SESSION_DURATIONS: number[] = [30, 60, 90];
const BUFFER_TIMES: number[] = [0, 15, 30];

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Helpers to generate time slots
const buildTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const period: 'AM' | 'PM' = hour < 12 ? 'AM' : 'PM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const label = `${displayHour}:00 ${period}`;
    slots.push({ hour, label, period });
  }
  return slots;
};

const ALL_SLOTS: TimeSlot[] = buildTimeSlots();

const initialDailyAvailability: DailyAvailability[] = [
  { day: 'Mon', enabled: true, selectedSlots: [9, 10, 11, 12, 13, 14, 15, 16, 17] },
  { day: 'Tue', enabled: true, selectedSlots: [9, 10, 11, 12, 13, 14, 15, 16, 17] },
  { day: 'Wed', enabled: true, selectedSlots: [9, 10, 11, 12, 13, 14, 15, 16, 17] },
  { day: 'Thu', enabled: true, selectedSlots: [9, 10, 11, 12, 13, 14, 15, 16, 17] },
  { day: 'Fri', enabled: true, selectedSlots: [9, 10, 11, 12, 13, 14, 15, 16, 17] },
  { day: 'Sat', enabled: false, selectedSlots: [] },
  { day: 'Sun', enabled: false, selectedSlots: [] },
];

const initialFormState: AvailabilityFormState = {
  hourlyRate: '',
  timezone: '',
  sessionDuration: 60,
  bufferTime: 15,
  mode: 'common',
  commonSlots: [],
  dailyAvailability: initialDailyAvailability,
};

const AvailabilityPage: React.FC = () => {
  const [form, setForm] = useState<AvailabilityFormState>(initialFormState);
  const [rateError, setRateError] = useState<string>('');
  const [banner, setBanner] = useState<BannerState>({ type: null, message: '' });
  const [expandedDays, setExpandedDays] = useState<DayOfWeek[]>(['Mon']);

  const slotsMorning = useMemo(
    () => ALL_SLOTS.filter((slot) => slot.period === 'AM'),
    []
  );
  const slotsAfternoon = useMemo(
    () => ALL_SLOTS.filter((slot) => slot.period === 'PM'),
    []
  );

  const updateForm = <K extends keyof AvailabilityFormState>(
    key: K,
    value: AvailabilityFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRateChange = (value: string) => {
    updateForm('hourlyRate', value);
    const num = Number(value);
    if (!value) {
      setRateError('');
    } else if (Number.isNaN(num) || num < 5 || num > 100) {
      setRateError('Hourly rate should be between $5 and $100.');
    } else {
      setRateError('');
    }
  };

  const handleSelectBusinessHours = () => {
    const business = ALL_SLOTS.filter((s) => s.hour >= 9 && s.hour <= 17).map(
      (s) => s.hour
    );
    updateForm('commonSlots', business);
  };

  const handleClearCommonSlots = () => {
    updateForm('commonSlots', []);
  };

  const toggleCommonSlot = (hour: number) => {
    setForm((prev) => {
      const exists = prev.commonSlots.includes(hour);
      return {
        ...prev,
        commonSlots: exists
          ? prev.commonSlots.filter((h) => h !== hour)
          : [...prev.commonSlots, hour],
      };
    });
  };

  const toggleDailyDayExpanded = (day: DayOfWeek) => {
    setExpandedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const toggleDailyDayEnabled = (day: DayOfWeek) => {
    setForm((prev) => ({
      ...prev,
      dailyAvailability: prev.dailyAvailability.map((d) =>
        d.day === day ? { ...d, enabled: !d.enabled } : d
      ),
    }));
  };

  const toggleDailySlot = (day: DayOfWeek, hour: number) => {
    setForm((prev) => ({
      ...prev,
      dailyAvailability: prev.dailyAvailability.map((d) => {
        if (d.day !== day || !d.enabled) return d;
        const exists = d.selectedSlots.includes(hour);
        return {
          ...d,
          selectedSlots: exists
            ? d.selectedSlots.filter((h) => h !== hour)
            : [...d.selectedSlots, hour],
        };
      }),
    }));
  };

  const totalSelectedSlots = useMemo(() => {
    if (form.mode === 'common') {
      return form.commonSlots.length;
    }
    return form.dailyAvailability.reduce((sum, d) => {
      if (!d.enabled) return sum;
      return sum + d.selectedSlots.length;
    }, 0);
  }, [form]);

  const handleSave = () => {
    const numRate = Number(form.hourlyRate);
    const rateValid =
      !!form.hourlyRate && !Number.isNaN(numRate) && numRate >= 5 && numRate <= 100;
    const hasSlots = totalSelectedSlots > 0;

    if (!rateValid || !hasSlots) {
      const problems: string[] = [];
      if (!rateValid) problems.push('Please set an hourly rate between $5 and $100.');
      if (!hasSlots) problems.push('Please select at least one available time slot.');

      setBanner({
        type: 'error',
        message: problems.join(' '),
      });
      return;
    }

    // In a real app, fire your API call here
    setBanner({
      type: 'success',
      message: 'Availability saved successfully.',
    });
  };

  const dismissBanner = () => {
    setBanner({ type: null, message: '' });
  };

  const renderTimeSlotPill = (
    hour: number,
    selected: boolean,
    compact: boolean,
    onClick: () => void
  ) => {
    const slot = ALL_SLOTS[hour];
    const classes = [
      'rounded-lg border text-center cursor-pointer transition-colors',
      compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-sm',
      selected
        ? 'bg-[#e8f0f8] border-[#234C6A] text-[#234C6A] font-medium'
        : 'bg-white border-gray-200 text-gray-600 hover:border-[#234C6A] hover:text-[#234C6A]',
    ].join(' ');
    return (
      <button key={hour} type="button" className={classes} onClick={onClick}>
        {slot.label}
      </button>
    );
  };

  const renderCommonMode = () => (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Select the hours you're generally available each day.
        </p>
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={handleSelectBusinessHours}
            className="text-[#234C6A] hover:underline"
          >
            Select Business Hours
          </button>
          <button
            type="button"
            onClick={handleClearCommonSlots}
            className="text-gray-400 hover:text-gray-600 hover:underline"
          >
            Clear All
          </button>
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
          Morning
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {slotsMorning.map((slot) =>
            renderTimeSlotPill(
              slot.hour,
              form.commonSlots.includes(slot.hour),
              false,
              () => toggleCommonSlot(slot.hour)
            )
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
          Afternoon &amp; Evening
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {slotsAfternoon.map((slot) =>
            renderTimeSlotPill(
              slot.hour,
              form.commonSlots.includes(slot.hour),
              false,
              () => toggleCommonSlot(slot.hour)
            )
          )}
        </div>
      </div>

      <div className="mt-4 text-sm">
        {form.commonSlots.length > 0 ? (
          <span className="font-medium text-[#234C6A]">
            {form.commonSlots.length} slots selected
          </span>
        ) : (
          <span className="text-gray-400">No slots selected</span>
        )}
      </div>
    </>
  );

  const renderDailyMode = () => (
    <div className="space-y-3">
      {form.dailyAvailability.map((dayAvail) => {
        const isExpanded = expandedDays.includes(dayAvail.day);
        const rowMuted = !dayAvail.enabled;
        const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

        return (
          <div
            key={dayAvail.day}
            className={[
              'rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5',
              rowMuted ? 'opacity-40' : '',
            ].join(' ')}
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="flex items-center gap-2"
                onClick={() => toggleDailyDayExpanded(dayAvail.day)}
              >
                <ChevronIcon className="h-4 w-4 text-gray-400" />
                <span className="w-10 text-left text-sm font-medium text-gray-700">
                  {dayAvail.day}
                </span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleDailyDayEnabled(dayAvail.day)}
                  className={[
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                    dayAvail.enabled ? 'bg-[#234C6A]' : 'bg-gray-300',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                      dayAvail.enabled ? 'translate-x-5' : 'translate-x-1',
                    ].join(' ')}
                  />
                </button>
                <span className="text-xs text-gray-500">
                  {dayAvail.enabled ? 'On' : 'Off'}
                </span>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-3 rounded-lg bg-white px-3 py-2">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                  Morning
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                  {slotsMorning.map((slot) =>
                    renderTimeSlotPill(
                      slot.hour,
                      dayAvail.selectedSlots.includes(slot.hour),
                      true,
                      () => toggleDailySlot(dayAvail.day, slot.hour)
                    )
                  )}
                </div>

                <div className="mt-3 text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                  Afternoon &amp; Evening
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                  {slotsAfternoon.map((slot) =>
                    renderTimeSlotPill(
                      slot.hour,
                      dayAvail.selectedSlots.includes(slot.hour),
                      true,
                      () => toggleDailySlot(dayAvail.day, slot.hour)
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-full bg-white">
      <div className="mx-auto max-w-3xl px-6 py-8 bg-[#F5F3EF] rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Your Availability</h1>
            <p className="mt-1 text-sm text-gray-500">
              Set your hourly rate and available time slots so students can book sessions
              with you.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="mt-1 inline-flex items-center rounded-lg bg-[#234C6A] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1b3c53]"
          >
            Save Changes
          </button>
        </div>

        {banner.type && (
          <div
            className={[
              'mb-4 flex items-start gap-3 rounded-lg border-l-4 px-4 py-3 text-sm',
              banner.type === 'error'
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-[#234C6A] bg-[#e8f0f8] text-[#234C6A]',
            ].join(' ')}
          >
            <div className="mt-0.5">
              {banner.type === 'error' ? '⚠️' : <Check className="h-4 w-4" />}
            </div>
            <div className="flex-1">{banner.message}</div>
            <button
              type="button"
              onClick={dismissBanner}
              className="ml-2 mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-inherit hover:bg-white/40"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Section 1: Session Settings */}
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            Session Settings
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Hourly Rate */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Hourly Rate <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-[#234C6A]">
                <span className="border-r border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  value={form.hourlyRate}
                  onChange={(e) => handleRateChange(e.target.value)}
                  placeholder="0"
                  className="flex-1 px-3 py-2.5 text-sm text-gray-800 outline-none"
                />
                <span className="px-3 py-2.5 text-sm text-gray-400">/hr</span>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                Recommended rate: $5 – $100 per hour
              </p>
              {rateError && <p className="mt-1 text-xs text-red-500">{rateError}</p>}
            </div>

            {/* Timezone */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Timezone <span className="text-red-400">*</span>
              </label>
              <select
                value={form.timezone}
                onChange={(e) => updateForm('timezone', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#234C6A] focus:border-transparent"
              >
                <option value="">Select a timezone…</option>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            {/* Session Duration */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Session Duration
              </label>
              <div className="inline-flex rounded-full bg-gray-50 p-1 text-xs font-medium text-gray-600">
                {SESSION_DURATIONS.map((duration) => {
                  const active = form.sessionDuration === duration;
                  return (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => updateForm('sessionDuration', duration)}
                      className={[
                        'px-3 py-1.5 rounded-full transition-colors',
                        active
                          ? 'bg-[#234C6A] text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                      ].join(' ')}
                    >
                      {duration} min
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Buffer Time */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Buffer Time
              </label>
              <p className="mb-2 text-xs text-gray-400">
                Gap added automatically between bookings
              </p>
              <div className="inline-flex rounded-full bg-gray-50 p-1 text-xs font-medium text-gray-600">
                {BUFFER_TIMES.map((buffer) => {
                  const active = form.bufferTime === buffer;
                  const label = buffer === 0 ? 'None' : `${buffer} min`;
                  return (
                    <button
                      key={buffer}
                      type="button"
                      onClick={() => updateForm('bufferTime', buffer)}
                      className={[
                        'px-3 py-1.5 rounded-full transition-colors',
                        active
                          ? 'bg-[#234C6A] text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Time Availability */}
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Time Availability</h2>
            <div className="inline-flex rounded-full bg-gray-50 p-1 text-xs font-medium text-gray-600">
              {(['common', 'daily'] as AvailabilityMode[]).map((mode) => {
                const active = form.mode === mode;
                const label = mode === 'common' ? 'Common' : 'Daily';
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateForm('mode', mode)}
                    className={[
                      'px-3 py-1.5 rounded-full transition-colors capitalize',
                      active
                        ? 'bg-[#234C6A] text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {form.mode === 'common' ? renderCommonMode() : renderDailyMode()}
        </div>
      </div>
    </div>
  );
};

export default AvailabilityPage;