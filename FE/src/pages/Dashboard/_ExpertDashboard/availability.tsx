import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useDispatch } from 'react-redux';
import ExpertAvailabilitySchedule from './ExpertAvailabilitySchedule';
import { useAppSelector } from '../../../store';
import { doSetExpertBookingNoticeHours, doUpdateProfile, doUpdateTimeSlots } from '../../../api/api';
import { updateMe } from '../../../actions/authActions';
import {
  formatHourRange,
  formatSubIntervals,
  halfHourIndicesToHours,
  hoursToHalfHourIndices,
  normalizeExpertPrice,
  unionDailyAvailabilityHours,
} from '../../../utils/schedulingSlots';
import { detectUserTimeZone } from '../../../utils/schedulingTimezone';
import {
  buildAvailabilitySaveSuccessMessage,
  buildBookingNoticeSaveSuccessMessage,
  mapAvailabilitySaveError,
  slotsIndicesEqual,
} from '../../../utils/availabilitySaveMessages';
import {
  appointmentDurationsEqual,
  normalizeAppointmentDurations,
  previewDurationForSlots,
  type AppointmentDurationMinutes,
} from '../../../utils/appointmentDurations';

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
  appointmentDurations: AppointmentDurationMinutes[];
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

const SESSION_DURATIONS: number[] = [30, 60, 90];
const BUFFER_TIMES: number[] = [0, 15, 30];
const BOOKING_NOTICE_HOURS = [24, 48, 72] as const;
const MIN_HOURLY_RATE = 5;

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
  appointmentDurations: [30, 60, 90],
  bufferTime: 15,
  mode: 'common',
  commonSlots: [],
  dailyAvailability: initialDailyAvailability,
};

const AvailabilityPage: React.FC = () => {
  const dispatch = useDispatch();
  const { auth: { userDetails } } = useAppSelector((s: any) => s);

  const [form, setForm] = useState<AvailabilityFormState>(initialFormState);
  const [rateError, setRateError] = useState<string>('');
  const [banner, setBanner] = useState<BannerState>({ type: null, message: '' });
  const [expandedDays, setExpandedDays] = useState<DayOfWeek[]>(['Mon']);
  const [noticeSaving, setNoticeSaving] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const detectedTimeZone = useMemo(
    () => userDetails?.timeZone || detectUserTimeZone(),
    [userDetails?.timeZone],
  );

  useEffect(() => {
    const slots = userDetails?.timeSlots;
    const hours =
      Array.isArray(slots) && slots.length > 0
        ? halfHourIndicesToHours(slots)
        : [];
    const price = normalizeExpertPrice(userDetails?.price);
    const durations = normalizeAppointmentDurations(userDetails?.appointmentDurations);
    setForm((prev) => ({
      ...prev,
      commonSlots: hours.length ? hours : prev.commonSlots,
      hourlyRate: price != null ? String(price) : prev.hourlyRate,
      appointmentDurations: durations,
    }));
  }, [userDetails?.timeSlots, userDetails?.price, userDetails?.appointmentDurations]);

  const activeBookingNotice = useMemo(() => {
    const n = Number(userDetails?.bookingNoticeHours);
    return BOOKING_NOTICE_HOURS.includes(n as (typeof BOOKING_NOTICE_HOURS)[number])
      ? n
      : 24;
  }, [userDetails?.bookingNoticeHours]);

  const saveBookingNotice = useCallback(
    async (hours: (typeof BOOKING_NOTICE_HOURS)[number]) => {
      if (hours === activeBookingNotice) return;
      setNoticeSaving(true);
      try {
        const res = await doSetExpertBookingNoticeHours(hours);
        if (res && res !== false) {
          await (dispatch as any)(updateMe());
          setBanner({
            type: 'success',
            message: buildBookingNoticeSaveSuccessMessage(hours),
          });
        } else {
          setBanner({
            type: 'error',
            message: 'Could not save booking notice. Please try again.',
          });
        }
      } catch {
        setBanner({
          type: 'error',
          message: 'Could not save booking notice. Please try again.',
        });
      } finally {
        setNoticeSaving(false);
      }
    },
    [dispatch, activeBookingNotice],
  );

  const slotsMorning = useMemo(
    () => ALL_SLOTS.filter((slot) => slot.period === 'AM'),
    []
  );
  const slotsAfternoon = useMemo(
    () => ALL_SLOTS.filter((slot) => slot.period === 'PM'),
    []
  );

  const toggleAppointmentDuration = (duration: AppointmentDurationMinutes) => {
    setForm((prev) => {
      const current = prev.appointmentDurations;
      const exists = current.includes(duration);
      if (exists && current.length === 1) {
        return prev;
      }
      const next = exists
        ? current.filter((value) => value !== duration)
        : [...current, duration].sort((a, b) => a - b);
      return { ...prev, appointmentDurations: next };
    });
  };

  const slotPreviewDuration = useMemo(
    () => previewDurationForSlots(form.appointmentDurations),
    [form.appointmentDurations],
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
    } else if (Number.isNaN(num) || num < MIN_HOURLY_RATE) {
      setRateError(`Hourly rate should be at least $${MIN_HOURLY_RATE}.`);
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

  const handleSave = async () => {
    const numRate = Number(form.hourlyRate);
    const rateValid =
      !!form.hourlyRate && !Number.isNaN(numRate) && numRate >= MIN_HOURLY_RATE;
    const hasSlots = totalSelectedSlots > 0;

    if (!rateValid || !hasSlots) {
      const problems: string[] = [];
      if (!rateValid) problems.push(`Please set an hourly rate of at least $${MIN_HOURLY_RATE}.`);
      if (!hasSlots) problems.push('Please select at least one available time slot.');

      setBanner({
        type: 'error',
        message: problems.join(' '),
      });
      return;
    }

    const selectedHours =
      form.mode === 'common'
        ? form.commonSlots
        : unionDailyAvailabilityHours(form.dailyAvailability);
    const timeSlots = hoursToHalfHourIndices(selectedHours);
    const timeZone = detectUserTimeZone();

    const savedPrice = normalizeExpertPrice(userDetails?.price);
    const savedSlots = Array.isArray(userDetails?.timeSlots) ? userDetails.timeSlots : [];
    const savedDurations = normalizeAppointmentDurations(userDetails?.appointmentDurations);
    const rateChanged = numRate !== savedPrice;
    const slotsChanged = !slotsIndicesEqual(timeSlots, savedSlots);
    const durationsChanged = !appointmentDurationsEqual(
      form.appointmentDurations,
      savedDurations,
    );

    if (!rateChanged && !slotsChanged && !durationsChanged) {
      setBanner({
        type: 'success',
        message: 'No changes to save.',
      });
      return;
    }

    setSaveBusy(true);
    try {
      if (slotsChanged) {
        const slotsRes = await doUpdateTimeSlots(timeSlots);
        if (!slotsRes || slotsRes === false) {
          throw new Error('Could not save time slots.');
        }
      }
      if (rateChanged || durationsChanged) {
        const profilePayload: Record<string, unknown> = {};
        if (rateChanged) profilePayload.price = numRate;
        if (durationsChanged) profilePayload.appointmentDurations = form.appointmentDurations;
        if (rateChanged) profilePayload.timeZone = timeZone;
        const profileOk = await doUpdateProfile(profilePayload);
        if (!profileOk) {
          throw new Error(
            durationsChanged && !rateChanged
              ? 'Could not save appointment durations.'
              : 'Could not save rate or timezone.',
          );
        }
      }
      await (dispatch as any)(updateMe());
      setBanner({
        type: 'success',
        message: buildAvailabilitySaveSuccessMessage({
          rateChanged,
          slotsChanged,
          durationsChanged,
          hourlyRate: numRate,
        }),
      });
    } catch (e: any) {
      const raw = e?.message || '';
      setBanner({
        type: 'error',
        message: mapAvailabilitySaveError(raw),
      });
    } finally {
      setSaveBusy(false);
    }
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
    const range = formatHourRange(hour);
    const sub = formatSubIntervals(hour, slotPreviewDuration);
    const tooltip = sub ? `${range} \u2014 ${sub}` : range;
    const classes = [
      'rounded-lg border text-center cursor-pointer transition-colors whitespace-nowrap',
      compact ? 'px-2 py-1' : 'px-3 py-2',
      selected
        ? 'bg-[#e8f0f8] border-[#234C6A] text-[#234C6A] font-medium'
        : 'bg-white border-gray-200 text-gray-600 hover:border-[#234C6A] hover:text-[#234C6A]',
    ].join(' ');
    return (
      <button
        key={hour}
        type="button"
        className={classes}
        onClick={onClick}
        title={tooltip}
      >
        <div className={compact ? 'text-[11px]' : 'text-sm'}>{range}</div>
        {sub ? (
          <div
            className={[
              'opacity-75',
              compact ? 'text-[9px] mt-0.5' : 'text-[10px] mt-0.5',
            ].join(' ')}
          >
            {sub}
          </div>
        ) : null}
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
            {form.commonSlots.length} hour{form.commonSlots.length === 1 ? '' : 's'}{' '}
            selected (e.g. {formatHourRange(Math.min(...form.commonSlots))})
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
      <div className="mx-auto max-w-6xl px-6 py-8 pb-28 bg-[#F5F3EF] rounded-2xl">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">Your Availability</h1>
          <p className="mt-1 text-sm text-gray-500">
            Set your hourly rate and weekly time slots, then use the calendar below to
            view bookings and block full days when needed.
          </p>
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
                Minimum rate: ${MIN_HOURLY_RATE} per hour
              </p>
              {rateError && <p className="mt-1 text-xs text-red-500">{rateError}</p>}
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-700">Your timezone</p>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
                Availability is saved in <span className="font-semibold">{detectedTimeZone}</span>{' '}
                (detected from your device). Students can view slots in their own timezone when booking.
              </p>
            </div>

            {/* Appointment Duration */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Appointment Duration
              </label>
              <p className="mb-2 text-xs text-gray-400">
                Select every session length you offer. Students choose one when booking.
              </p>
              <div className="flex flex-wrap gap-2">
                {SESSION_DURATIONS.map((duration) => {
                  const active = form.appointmentDurations.includes(
                    duration as AppointmentDurationMinutes,
                  );
                  return (
                    <button
                      key={duration}
                      type="button"
                      aria-pressed={active}
                      aria-label={`${duration} minutes${active ? ', selected' : ''}`}
                      onClick={() =>
                        toggleAppointmentDuration(duration as AppointmentDurationMinutes)
                      }
                      className={[
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                        active
                          ? 'bg-[#234C6A] border border-[#234C6A] text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-[#234C6A]/30 hover:text-[#234C6A]',
                      ].join(' ')}
                    >
                      {active ? (
                        <Check className="h-3 w-3 shrink-0" aria-hidden />
                      ) : null}
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

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Minimum booking notice
              </label>
              <p className="mb-2 text-xs text-gray-400">
                Students can only book sessions that start at least this many hours from
                when they book (applies to 1:1 bookings and seminar sign-ups).
              </p>
              <div className="inline-flex flex-wrap rounded-full bg-gray-50 p-1 text-xs font-medium text-gray-600">
                {BOOKING_NOTICE_HOURS.map((h) => {
                  const active = activeBookingNotice === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      disabled={noticeSaving}
                      onClick={() => void saveBookingNotice(h)}
                      className={[
                        'px-3 py-1.5 rounded-full transition-colors',
                        active
                          ? 'bg-[#234C6A] text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                        noticeSaving ? 'opacity-60 cursor-wait' : '',
                      ].join(' ')}
                    >
                      {h} hours
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
                const label =
                  mode === 'common' ? 'Recurring daily' : 'Weekday Specific';
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateForm('mode', mode)}
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

          <p className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-[#234C6A]">
            Each slot is a 1-hour availability window starting at the time shown. You offer{' '}
            <span className="font-semibold">
              {form.appointmentDurations.map((d) => `${d} min`).join(', ')}
            </span>{' '}
            sessions — students choose their length when booking.
            {form.appointmentDurations.includes(30) && (
              <>
                {' '}
                <span className="font-semibold">30-min</span> sessions show{' '}
                <span className="font-semibold">two</span> start times per slot (e.g.{' '}
                <span className="font-semibold">8:00&ndash;8:30 PM</span> and{' '}
                <span className="font-semibold">8:30&ndash;9:00 PM</span>).
              </>
            )}
            {form.appointmentDurations.includes(60) &&
              !form.appointmentDurations.includes(30) && (
                <>
                  {' '}
                  <span className="font-semibold">60-min</span> sessions show{' '}
                  <span className="font-semibold">one</span> start time per slot (e.g.{' '}
                  <span className="font-semibold">8:00&ndash;9:00 PM</span>).
                </>
              )}
            {form.appointmentDurations.includes(90) && (
              <>
                {' '}
                <span className="font-semibold">90-min</span> sessions need an adjacent hour
                selected too (e.g. <span className="font-semibold">8 PM + 9 PM</span>).
              </>
            )}
          </p>

          {form.mode === 'common' ? renderCommonMode() : renderDailyMode()}
        </div>

        <ExpertAvailabilitySchedule />

        <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-30 lg:left-[70px]">
          <div className="pointer-events-auto mx-auto max-w-6xl px-6 pb-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white/95 px-5 py-3.5 shadow-lg backdrop-blur-md">
              <p className="hidden text-xs text-gray-500 sm:block">
                Save your hourly rate and weekly time slots when you are done editing.
              </p>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveBusy}
                className="ml-auto inline-flex shrink-0 items-center rounded-lg bg-[#234C6A] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1b3c53] disabled:opacity-60"
              >
                {saveBusy ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityPage;