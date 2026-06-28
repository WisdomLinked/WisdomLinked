import React, { useState, useEffect, useCallback, useMemo, Children, useLayoutEffect } from 'react';
import { Calendar } from 'react-big-calendar';
import { X, Clock, CalendarDays, Check } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { isSlotUnavailable } from '../../actions/common';
import { localizer } from '../../actions/common';
import { useAppSelector } from '../../store';
import BookingTimeZoneControl from '../scheduling/BookingTimeZoneControl';
import StudentSelect from './StudentSelect';
import StudentBookingToolbar from './StudentBookingToolbar';
import {
  detectUserTimeZone,
  formatPickedSlotWhenDisplay,
  formatSlotLabel,
  getViewerDayStartMs,
  getViewerSlotsForExpertDay,
  getViewerYmdFromCalendarDate,
  isViewerSlotBlockedOnDate,
  resolveViewerTimeZone,
  toYMDInTimeZone,
  viewerSlotToInstant,
} from '../../utils/schedulingTimezone';
import { normalizeExpertPrice, filterSlotsForDuration } from '../../utils/schedulingSlots';
import {
  defaultAppointmentDuration,
  normalizeAppointmentDurations,
  type AppointmentDurationMinutes,
} from '../../utils/appointmentDurations';
import type { BookingDisplayTimeZoneMode } from '../../types/scheduling';

type SessionDurationMinutes = AppointmentDurationMinutes;

type Props = {
  expert: any;
  onSlotSelected: (start: Date, end: Date, duration: number) => void;
  hidePriceInDurationSelection?: boolean;
  selectedDurationMinutes?: SessionDurationMinutes;
  onDurationMinutesChange?: (mins: SessionDurationMinutes) => void;
  allowedDurationMinutes?: SessionDurationMinutes[];
  confirmedSlotStart?: Date | null;
  onFilterSlotConfirmed?: () => void;
  onViewerTimeZoneChange?: (tz: string) => void;
};

const ALL_DURATIONS: SessionDurationMinutes[] = [30, 60, 90];

function generateTimeSlotIndices() {
  const slots: { index: number; time: string }[] = [];
  let currentTime = new Date('2025-04-06T00:00:00');
  const endTime = new Date('2025-04-06T23:30:00');
  let index = 0;
  while (currentTime <= endTime) {
    slots.push({
      index,
      time: currentTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
    });
    currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    index += 1;
  }
  return slots;
}

const TIME_SLOT_INDICES = generateTimeSlotIndices();

const TIME_FILTER_OPTIONS = [
  { value: '', label: 'Any time' },
  ...TIME_SLOT_INDICES.map((slot) => ({
    value: String(slot.index),
    label: slot.time,
  })),
];

const DURATION_OPTIONS = ALL_DURATIONS.map((d) => ({
  value: String(d),
  label: `${d} min`,
}));

const calendarFormats = {
  weekdayFormat: (date: Date, culture?: string, localizer?: any) =>
    localizer.format(date, 'eee', culture),
};

function expertDisplayName(expert: any): string {
  const first = expert?.firstName?.trim();
  const last = expert?.lastName?.trim();
  const combined = [first, last].filter(Boolean).join(' ');
  if (combined) return combined;
  if (expert?.name?.trim()) return expert.name.trim();
  if (expert?.username?.trim()) return expert.username.trim();
  return 'This expert';
}

function isExpertBlockedOnViewerDay(
  day: Date,
  expert: any,
  expertTz: string,
  viewerTz: string,
): boolean {
  const blocked = expert?.blockedBookingDates;
  if (!Array.isArray(blocked) || !blocked.length) return false;

  const dayStartMs = getViewerDayStartMs(day, viewerTz);
  const sampleOffsetsMs = [
    0,
    6 * 3_600_000,
    12 * 3_600_000,
    18 * 3_600_000,
    23 * 3_600_000 + 30 * 60_000,
  ];
  return sampleOffsetsMs.some((offset) =>
    blocked.includes(toYMDInTimeZone(new Date(dayStartMs + offset), expertTz)),
  );
}

function isSameViewerCalendarDay(a: Date, b: Date): boolean {
  return getViewerYmdFromCalendarDate(a) === getViewerYmdFromCalendarDate(b);
}

/**
 * Student-dashboard styled availability picker (light theme).
 * Replaces legacy dark SelectDateTime in Find Experts / ExpertProfile.
 */
export default function StudentExpertBookingPicker({
  expert,
  onSlotSelected,
  hidePriceInDurationSelection = false,
  selectedDurationMinutes,
  onDurationMinutesChange,
  allowedDurationMinutes,
  confirmedSlotStart: confirmedSlotStartProp,
  onFilterSlotConfirmed,
  onViewerTimeZoneChange,
}: Props) {
  const { auth: { userDetails } } = useAppSelector((state: any) => state);

  const offeredDurations = useMemo(
    () =>
      allowedDurationMinutes ??
      normalizeAppointmentDurations(expert?.appointmentDurations),
    [allowedDurationMinutes, expert?.appointmentDurations],
  );

  const durationOptions = useMemo(
    () =>
      DURATION_OPTIONS.filter((option) =>
        offeredDurations.includes(Number(option.value) as SessionDurationMinutes),
      ),
    [offeredDurations],
  );

  const [events, setEvents] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  /** Remount calendar after closing time modal so the same day can be clicked again (RBC keeps slot selected). */
  const [calendarResetKey, setCalendarResetKey] = useState(0);
  const [tzMode, setTzMode] = useState<BookingDisplayTimeZoneMode>('mine');
  const [customTz, setCustomTz] = useState(detectUserTimeZone());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [internalDuration, setInternalDuration] = useState<SessionDurationMinutes>(() =>
    defaultAppointmentDuration(offeredDurations),
  );
  const [timeSlots, setTimeSlots] = useState<number[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<number | null>(null);
  const [filterSlotIndex, setFilterSlotIndex] = useState(-1);
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [confirmedSlotStart, setConfirmedSlotStart] = useState<Date | null>(null);
  const duration = selectedDurationMinutes ?? internalDuration;

  useEffect(() => {
    if (confirmedSlotStartProp) {
      setConfirmedSlotStart(confirmedSlotStartProp);
    } else {
      setConfirmedSlotStart(null);
    }
  }, [confirmedSlotStartProp]);

  useEffect(() => {
    const fallback = defaultAppointmentDuration(offeredDurations);
    if (!offeredDurations.includes(duration)) {
      if (onDurationMinutesChange) {
        onDurationMinutesChange(fallback);
      } else {
        setInternalDuration(fallback);
      }
    }
  }, [offeredDurations, duration, onDurationMinutesChange]);

  const handleDurationChange = useCallback(
    (value: string) => {
      if (confirmedSlotStart) return;
      const mins = Number(value) as SessionDurationMinutes;
      if (onDurationMinutesChange) {
        onDurationMinutesChange(mins);
      } else {
        setInternalDuration(mins);
      }
    },
    [confirmedSlotStart, onDurationMinutesChange],
  );

  const clearTimeFilter = useCallback(() => {
    setFilterSlotIndex(-1);
    setConfirmedSlotStart(null);
  }, []);

  const expertTz = expert?.timeZone || 'UTC';
  const expertName = useMemo(() => expertDisplayName(expert), [expert]);

  // Default the calendar to the viewer's actual zone. A saved timeZone of 'UTC'
  // is the User-model default (often never set), so fall back to the detected
  // browser zone rather than showing everything in UTC.
  const savedTz = userDetails?.timeZone;
  const studentTz = savedTz && savedTz !== 'UTC' ? savedTz : detectUserTimeZone();

  const viewerTz = resolveViewerTimeZone(tzMode, studentTz, expertTz, customTz);

  useLayoutEffect(() => {
    onViewerTimeZoneChange?.(viewerTz);
  }, [viewerTz, onViewerTimeZoneChange]);

  const getBlockedDayTitle = useCallback(
    (date: Date) => {
      if (!isExpertBlockedOnViewerDay(date, expert, expertTz, viewerTz)) {
        return undefined;
      }
      return `${expertName} is not available on this date`;
    },
    [expert, expertTz, expertName, viewerTz],
  );

  const hourlyRate = normalizeExpertPrice(expert?.price) ?? 0;

  const getAvailableTimeSlots = useCallback(
    (day: Date, dur: number) => {
      const viewerYmd = getViewerYmdFromCalendarDate(day);
      const viewerTodayYmd = toYMDInTimeZone(new Date(), viewerTz);
      if (viewerYmd < viewerTodayYmd) return [];

      let slots = getViewerSlotsForExpertDay(expert, day, viewerTz);
      slots = filterSlotsForDuration(slots, dur);

      const blocked = expert?.blockedBookingDates;
      if (Array.isArray(blocked)) {
        slots = slots.filter((slotIdx) => {
          const instant = viewerSlotToInstant(day, slotIdx, viewerTz);
          return !blocked.includes(toYMDInTimeZone(instant, expertTz));
        });
      }

      const blockedSlots = expert?.blockedBookingSlots;
      if (blockedSlots) {
        slots = slots.filter(
          (slotIdx) =>
            !isViewerSlotBlockedOnDate(blockedSlots, day, slotIdx, viewerTz, expertTz),
        );
      }

      if (viewerYmd === viewerTodayYmd) {
        const now = Date.now();
        slots = slots.filter(
          (slotIdx) => viewerSlotToInstant(day, slotIdx, viewerTz).getTime() >= now,
        );
      }

      let updated = [...slots];
      for (let i = 0; i < slots.length; i++) {
        const slotStartMs = viewerSlotToInstant(day, slots[i], viewerTz).getTime();
        for (let j = 0; j < events.length; j++) {
          if (events[j].status !== 'declined') {
            if (
              isSlotUnavailable(
                slotStartMs,
                dur * 60 * 1000,
                new Date(events[j].start).getTime(),
                new Date(events[j].end).getTime(),
              )
            ) {
              updated.splice(updated.indexOf(slots[i]), 1);
              break;
            }
          }
        }
      }

      const noticeRaw = Number(expert?.bookingNoticeHours);
      const noticeH = [24, 48, 72].includes(noticeRaw) ? noticeRaw : 24;
      const earliestMs = Date.now() + noticeH * 60 * 60 * 1000;
      updated = updated.filter((slotIdx) => {
        return viewerSlotToInstant(day, slotIdx, viewerTz).getTime() >= earliestMs;
      });

      return updated;
    },
    [
      events,
      expert,
      expertTz,
      viewerTz,
    ],
  );

  const isDayClickable = useCallback(
    (date: Date) => {
      const viewerTodayYmd = toYMDInTimeZone(new Date(), viewerTz);
      const viewerDayYmd = getViewerYmdFromCalendarDate(date);
      if (viewerDayYmd < viewerTodayYmd) return false;
      if (isExpertBlockedOnViewerDay(date, expert, expertTz, viewerTz)) return false;

      const available = getAvailableTimeSlots(date, duration);
      if (!available.length) return false;
      if (filterSlotIndex >= 0) return available.includes(filterSlotIndex);
      return true;
    },
    [viewerTz, expert, expertTz, getAvailableTimeSlots, duration, filterSlotIndex],
  );

  const isDateAvailable = (date: number) => isDayClickable(new Date(date));

  const dayStyleGetter = useCallback(
    (date: Date) => {
      const viewerTodayYmd = toYMDInTimeZone(new Date(), viewerTz);
      const viewerDayYmd = getViewerYmdFromCalendarDate(date);
      const clickable = isDayClickable(date);
      const dayClass = clickable
        ? 'studentBookingCalendar-day-clickable'
        : 'studentBookingCalendar-day-disabled';

      if (viewerDayYmd < viewerTodayYmd) {
        return {
          className: dayClass,
          style: {
            backgroundColor: '#E5E2DB',
            color: '#7A7A72',
            cursor: 'not-allowed',
          },
        };
      }

      if (isExpertBlockedOnViewerDay(date, expert, expertTz, viewerTz)) {
        return {
          className: dayClass,
          style: {
            backgroundColor: '#FEE2E2',
            cursor: 'not-allowed',
          },
        };
      }

      const dayStartTime = getViewerDayStartMs(date, viewerTz);
      const dayEndTime = dayStartTime + 24 * 60 * 60 * 1000 - 1;
      const hasEvent = events.some(
        (event) =>
          new Date(event.end).getTime() >= dayStartTime &&
          new Date(event.start).getTime() <= dayEndTime,
      );

      const daySlots = getAvailableTimeSlots(date, duration);
      let backgroundColor: string;

      if (filterSlotIndex === -1) {
        if (!daySlots.length) {
          backgroundColor = '#FEE2E2';
        } else if (hasEvent) {
          backgroundColor = '#FEF3C7';
        } else {
          backgroundColor = '#E8F0F8';
        }
      } else if (daySlots.includes(filterSlotIndex)) {
        backgroundColor = '#E8F0F8';
      } else {
        backgroundColor = '#FEE2E2';
      }

      const isSelectedDay =
        confirmedSlotStart != null && isSameViewerCalendarDay(date, confirmedSlotStart);

      return {
        className: dayClass,
        style: {
          backgroundColor,
          cursor: clickable ? 'pointer' : 'not-allowed',
          ...(isSelectedDay
            ? { boxShadow: 'inset 0 0 0 2px #1A3A4A' }
            : {}),
        },
      };
    },
    [
      events,
      filterSlotIndex,
      getAvailableTimeSlots,
      expert,
      expertTz,
      viewerTz,
      confirmedSlotStart,
      isDayClickable,
    ],
  );

  const renderDateHeader = useCallback(
    (
      label: string,
      date: Date,
      drilldownView?: string,
      onDrillDown?: (e: React.MouseEvent) => void,
    ) => {
      const blockedTitle = getBlockedDayTitle(date);
      const isSelected =
        confirmedSlotStart != null && isSameViewerCalendarDay(date, confirmedSlotStart);
      const clickable = isDayClickable(date);
      const cursorClass = clickable ? 'cursor-pointer' : 'cursor-not-allowed';
      const content = (
        <span
          className={
            isSelected
              ? 'inline-flex items-center gap-1 font-bold text-[#1A3A4A]'
              : undefined
          }
        >
          {label}
          {isSelected ? (
            <Check className="h-3 w-3 shrink-0 text-[#1A3A4A]" aria-hidden />
          ) : null}
        </span>
      );

      if (!drilldownView) {
        return (
          <span title={blockedTitle} className={cursorClass}>
            {content}
          </span>
        );
      }

      return (
        <button
          type="button"
          className={`rbc-button-link ${cursorClass}${isSelected ? ' studentBookingCalendar-day-selected' : ''}`}
          title={blockedTitle}
          aria-label={isSelected ? `${label}, selected` : label}
          onClick={onDrillDown}
        >
          {content}
        </button>
      );
    },
    [confirmedSlotStart, getBlockedDayTitle, isDayClickable],
  );

  const calendarComponents = useMemo(
    () => ({
      toolbar: StudentBookingToolbar,
      dateCellWrapper: ({ value, children }: { value: Date; children: React.ReactElement }) => {
        const title = getBlockedDayTitle(value);
        // "Today" follows the selected viewer timezone (same basis the calendar
        // uses to disable past days), so picking e.g. India can advance it a day.
        const isToday =
          getViewerYmdFromCalendarDate(value) === toYMDInTimeZone(new Date(), viewerTz);
        if (!title && !isToday) return children;
        const wrapped = title
          ? Children.map(children, (child) => {
              if (!React.isValidElement(child)) return child;
              return React.cloneElement(child as React.ReactElement<any>, { title });
            })
          : children;
        // Match react-big-calendar's own day-cell flex sizing (flex: 1 0 0%) so
        // wrapping the cell doesn't collapse/shift it out of alignment with the
        // date numbers in the content row.
        return (
          <div title={title} className="relative h-full" style={{ flex: '1 0 0%' }}>
            {wrapped}
            {isToday && (
              <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#1A3A4A] px-2 py-[2px] text-[9px] font-semibold leading-none text-white shadow-sm">
                Today
              </span>
            )}
          </div>
        );
      },
      month: {
        dateHeader: ({
          label,
          date,
          drilldownView,
          onDrillDown,
        }: {
          label: string;
          date: Date;
          drilldownView?: string;
          onDrillDown?: (e: React.MouseEvent) => void;
        }) => renderDateHeader(label, date, drilldownView, onDrillDown),
      },
    }),
    [getBlockedDayTitle, renderDateHeader, viewerTz],
  );

  const eventStyleGetter = (event: any, _s: any, end: Date) => {
    const past = end < new Date();
    const legacy = event.type === 'event';
    return {
      style: {
        backgroundColor: legacy ? '#1A3A4A' : '#7A7A72',
        opacity: past ? 0.45 : 0.85,
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        fontSize: '11px',
      },
    };
  };

  const closeTimeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedTimeSlot(null);
    setCalendarResetKey((k) => k + 1);
  }, []);

  const confirmSlot = useCallback(
    (slot: number, dayOverride?: Date) => {
      const day = dayOverride ?? selectedDate;
      if (!day || slot === null || slot === undefined) return;
      const start = viewerSlotToInstant(day, slot, viewerTz);
      const end = new Date(start.getTime() + duration * 60 * 1000);
      setConfirmedSlotStart(start);
      onSlotSelected(start, end, duration);
      closeTimeModal();
      if (filterSlotIndex >= 0) {
        onFilterSlotConfirmed?.();
      }
    },
    [
      selectedDate,
      viewerTz,
      duration,
      onSlotSelected,
      filterSlotIndex,
      onFilterSlotConfirmed,
      closeTimeModal,
    ],
  );

  const handleSelectDate = ({ start, end }: { start: Date; end: Date }) => {
    const dayStart = new Date(start).getTime();
    const dayEnd = new Date(end).getTime();
    if (dayEnd - dayStart !== 3600 * 24 * 1000) return;
    if (dayEnd < Date.now()) return;
    if (!isDateAvailable(start.getTime())) return;

    setSelectedDate(start);
    if (filterSlotIndex >= 0) {
      setSelectedTimeSlot(filterSlotIndex);
      confirmSlot(filterSlotIndex, start);
    } else {
      setModalOpen(true);
    }
  };

  useEffect(() => {
    const temp: any[] = [];
    expert?.events?.forEach((event: any) => {
      temp.push({
        ...event,
        id: event._id,
        start: new Date(event.start),
        end: new Date(event.end),
        title: `(Legacy) ${event.title || 'Session'}`,
        type: 'event',
      });
    });
    expert?.groupChats?.forEach((gc: any) => {
      const prefix =
        gc.type === 'individual' ? '(1:1)' : gc.type === 'seminar' ? '(S)' : '(G)';
      temp.push({
        ...gc,
        id: gc._id,
        start: new Date(gc.start),
        end: new Date(gc.end),
        title: `${prefix} ${gc.name}`,
        type: gc.type === 'individual' ? 'individual' : 'seminar',
      });
    });
    expert?.pendingGroupChats?.forEach((item: any) => {
      temp.push({
        ...item.groupChatId,
        id: item.groupChatId?._id,
        start: new Date(item.groupChatId?.start),
        end: new Date(item.groupChatId?.end),
        title: `(Pending) ${item.groupChatId?.name}`,
        type: 'pending seminar',
      });
    });
    setEvents(temp);
  }, [expert]);

  useEffect(() => {
    if (selectedDate && modalOpen) {
      setTimeSlots(getAvailableTimeSlots(selectedDate, duration));
    }
  }, [duration, selectedDate, modalOpen, getAvailableTimeSlots]);

  return (
    <div className="student-booking-picker">
      <BookingTimeZoneControl
        appearance="student"
        mode={tzMode}
        customTimeZone={customTz}
        expertTimeZone={expertTz}
        studentTimeZone={studentTz}
        onModeChange={setTzMode}
        onCustomTimeZoneChange={setCustomTz}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
            Calendar legend
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-[#1A3A4A]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#E8F0F8] border border-[#234C6A]/30" />
              Available
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#FEF3C7] border border-[#C9A84C]/40" />
              Partial
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#FEE2E2] border border-red-200" />
              Unavailable
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowTimeFilter((v) => !v)}
          className="inline-flex items-center gap-2 rounded-[4px] border border-[#E5E2DB] bg-white px-3 py-2 text-[12px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
        >
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {showTimeFilter ? 'Hide time filter' : 'Filter by time'}
        </button>
      </div>

      {showTimeFilter && (
        <div className="mb-4 rounded-xl border border-[#E5E2DB] bg-[#F5F3EF] p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[140px] flex-1">
              <StudentSelect
                label="Preferred start time"
                value={filterSlotIndex >= 0 ? String(filterSlotIndex) : ''}
                options={TIME_FILTER_OPTIONS}
                onChange={(v) => {
                  setFilterSlotIndex(v === '' ? -1 : Number(v));
                  setConfirmedSlotStart(null);
                }}
              />
            </div>
            <button
              type="button"
              onClick={clearTimeFilter}
              className="rounded-[4px] border border-[#E5E2DB] bg-white px-3 py-2 text-[12px] font-semibold text-[#1A3A4A] hover:bg-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#E5E2DB] bg-white p-2">
        <Calendar
          key={calendarResetKey}
          className="studentBookingCalendar min-h-[380px] text-[#1A3A4A]"
          views={['month']}
          selectable
          localizer={localizer}
          formats={calendarFormats}
          defaultDate={new Date()}
          defaultView="month"
          events={events}
          components={calendarComponents}
          eventPropGetter={eventStyleGetter}
          dayPropGetter={dayStyleGetter}
          onSelectSlot={handleSelectDate}
        />
      </div>

      {confirmedSlotStart ? (
        <div
          data-testid="selection-confirmed-banner"
          className="mt-3 rounded-lg border border-[#1A3A4A]/20 bg-[#E8F0F8] px-4 py-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1A3A4A]">
            Selected appointment
          </p>
          <p className="mt-1 text-[13px] font-semibold text-[#1A3A4A]">
            {formatPickedSlotWhenDisplay(
              confirmedSlotStart,
              new Date(confirmedSlotStart.getTime() + duration * 60 * 1000),
              viewerTz,
            )}{' '}
            · {duration} min
          </p>
        </div>
      ) : null}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#1A3A4A]/40 backdrop-blur-sm"
            aria-label="Close"
            onClick={closeTimeModal}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-[#E5E2DB] bg-white p-6 shadow-[0_20px_50px_rgba(26,58,74,0.15)]">
            <button
              type="button"
              className="absolute right-4 top-4 rounded-lg p-1 text-[#7A7A72] hover:bg-[#F5F3EF]"
              onClick={closeTimeModal}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-[#1A3A4A]">
              <CalendarDays className="h-5 w-5" aria-hidden />
              <h3 className="font-serif text-lg font-medium">Choose a time</h3>
            </div>
            <p className="mt-1 text-[12px] text-[#7A7A72]">
              Times shown in {viewerTz}
              {selectedDate
                ? ` · ${selectedDate.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}`
                : ''}
            </p>

            <StudentSelect
              label="Appointment Duration"
              value={String(duration)}
              options={durationOptions.map((opt) => ({
                ...opt,
                label:
                  !hidePriceInDurationSelection && hourlyRate > 0
                    ? `${opt.label} · $${((Number(opt.value) * hourlyRate) / 60).toFixed(2)} est.`
                    : opt.label,
              }))}
              onChange={handleDurationChange}
              disabled={!!confirmedSlotStart}
            />

            <div className="mt-4 max-h-52 space-y-2 overflow-y-auto">
              {timeSlots.length ? (
                timeSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() =>
                      setSelectedTimeSlot(selectedTimeSlot === slot ? null : slot)
                    }
                    className={`w-full rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
                      selectedTimeSlot === slot
                        ? 'border-[#1A3A4A] bg-[#1A3A4A] text-white'
                        : 'border-[#E5E2DB] bg-[#F5F3EF] text-[#1A3A4A] hover:border-[#234C6A] hover:bg-white'
                    }`}
                  >
                    {formatSlotLabel(slot, selectedDate!, viewerTz)}
                  </button>
                ))
              ) : (
                <p className="py-6 text-center text-sm text-[#7A7A72]">
                  No times available on this day.
                </p>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeTimeModal}
                className="flex-1 rounded-[4px] border border-[#E5E2DB] py-2.5 text-[13px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedTimeSlot === null}
                onClick={() => selectedTimeSlot !== null && confirmSlot(selectedTimeSlot)}
                className="flex-1 rounded-[4px] bg-[#1A3A4A] py-2.5 text-[13px] font-semibold text-white hover:bg-[#122635] disabled:opacity-50"
              >
                Confirm time
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
