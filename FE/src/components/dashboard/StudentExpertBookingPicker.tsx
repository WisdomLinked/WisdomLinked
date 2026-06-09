import React, { useState, useEffect, useCallback, useMemo, Children } from 'react';
import { Calendar } from 'react-big-calendar';
import { X, Clock, CalendarDays } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { isSlotUnavailable, slotToTime } from '../../actions/common';
import { localizer } from '../../actions/common';
import { useAppSelector } from '../../store';
import BookingTimeZoneControl from '../scheduling/BookingTimeZoneControl';
import StudentSelect from './StudentSelect';
import StudentBookingToolbar from './StudentBookingToolbar';
import {
  convertExpertSlotsToViewer,
  detectUserTimeZone,
  resolveViewerTimeZone,
  toYMDInTimeZone,
  getTimezoneOffsetHalfHours,
} from '../../utils/schedulingTimezone';
import { normalizeExpertPrice } from '../../utils/schedulingSlots';
import type { BookingDisplayTimeZoneMode } from '../../types/scheduling';

type Props = {
  expert: any;
  onSlotSelected: (start: Date, end: Date, duration: number) => void;
  hidePriceInDurationSelection?: boolean;
  initialDuration?: number;
};

const DURATIONS = [30, 60, 90] as const;

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

const DURATION_OPTIONS = DURATIONS.map((d) => ({
  value: String(d),
  label: `${d} min`,
}));

const calendarFormats = {
  weekdayFormat: (date: Date, culture?: string, localizer?: any) =>
    localizer.format(date, 'EEE', culture),
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

function isExpertBlockedDay(date: Date, expert: any, timeZone: string): boolean {
  const blocked = expert?.blockedBookingDates;
  if (!Array.isArray(blocked)) return false;
  return blocked.includes(toYMDInTimeZone(date, timeZone || 'UTC'));
}

/**
 * Student-dashboard styled availability picker (light theme).
 * Replaces legacy dark SelectDateTime in Find Experts / ExpertProfile.
 */
export default function StudentExpertBookingPicker({
  expert,
  onSlotSelected,
  hidePriceInDurationSelection = false,
  initialDuration = 30,
}: Props) {
  const { auth: { userDetails } } = useAppSelector((state: any) => state);

  const [events, setEvents] = useState<any[]>([]);
  const [rawExpertSlots, setRawExpertSlots] = useState<number[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [tzMode, setTzMode] = useState<BookingDisplayTimeZoneMode>('mine');
  const [customTz, setCustomTz] = useState(detectUserTimeZone());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [duration, setDuration] = useState(initialDuration ?? 30);
  useEffect(() => {setDuration(initialDuration);}, [initialDuration]);
  const [timeSlots, setTimeSlots] = useState<number[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<number | null>(null);
  const [filterSlotIndex, setFilterSlotIndex] = useState(-1);
  const [showTimeFilter, setShowTimeFilter] = useState(false);

  const expertTz = expert?.timeZone || 'UTC';
  const expertName = useMemo(() => expertDisplayName(expert), [expert]);

  const getBlockedDayTitle = useCallback(
    (date: Date) => {
      if (!isExpertBlockedDay(date, expert, expertTz)) return undefined;
      return `${expertName} is not available on this day`;
    },
    [expert, expertTz, expertName],
  );

  const viewerTz = resolveViewerTimeZone(
    tzMode,
    userDetails?.timeZone || detectUserTimeZone(),
    expertTz,
    customTz,
  );

  const hourlyRate = normalizeExpertPrice(expert?.price) ?? 0;

  const availableSlots = useMemo(
    () => convertExpertSlotsToViewer(rawExpertSlots, expertTz, viewerTz),
    [rawExpertSlots, expertTz, viewerTz],
  );

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const getAvailableTimeSlots = useCallback(
    (day: Date, dur: number) => {
      
      // Gets the reference dayStartTime from viewers time zone
      const browserTz = detectUserTimeZone(); // matches what RBC uses
      const dateStr = toYMDInTimeZone(day, browserTz); // correct calendar date
      const [yr, mo, dy] = dateStr.split('-').map(Number);
      const tzOffset = getTimezoneOffsetHalfHours(viewerTz, day);
      const dayStartTime = Date.UTC(yr, mo - 1, dy) + tzOffset * 30 * 60 * 1000;

      const dayEndTime = dayStartTime + 24 * 60 * 60 * 1000 - 1;
      const start = new Date(dayStartTime);
      const end = new Date(dayEndTime);
      const selectedEvents = events.filter(
        (item) => item.start >= start && item.end <= end,
      );

      let slots = [...(availableSlots || [])];
      slots.splice(slots.length - (dur / 30 - 1), dur / 30 - 1);

      if (isToday(day)) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const now = new Date();
        const nextSlot = Math.floor(
          (now.getTime() - startOfToday.getTime()) / (30 * 60 * 1000),
        );
        for (let i = 0; i < nextSlot; i++) {
          const idx = slots.indexOf(i);
          if (idx > -1) slots.splice(idx, 1);
        }
      }

      let updated = [...slots];
      for (let i = 0; i < slots.length; i++) {
        for (let j = 0; j < selectedEvents.length; j++) {
          if (selectedEvents[j].status !== 'declined') {
            if (
              isSlotUnavailable(
                dayStartTime + slots[i] * 1800000,
                dur * 60 * 1000,
                new Date(selectedEvents[j].start).getTime(),
                new Date(selectedEvents[j].end).getTime(),
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
        const slotStartMs = dayStartTime + slotIdx * 30 * 60 * 1000;
        return slotStartMs >= earliestMs;
      });

      return updated;
    },
    [events, availableSlots, expert?.bookingNoticeHours],
  );

  const isDateAvailable = (date: number) => {
    const today = new Date().setHours(0, 0, 0, 0);
    if (date < today) return false;
    const dayDate = new Date(date);
    const blocked = expert?.blockedBookingDates;
    if (
      Array.isArray(blocked) &&
      blocked.includes(toYMDInTimeZone(dayDate, expertTz || 'UTC'))
    ) {
      return false;
    }
    const available = getAvailableTimeSlots(dayDate, duration);
    if (!available.length) return false;
    if (filterSlotIndex >= 0) return available.includes(filterSlotIndex);
    return true;
  };

  const dayStyleGetter = useCallback(
    (date: Date) => {
      const today = new Date().setHours(0, 0, 0, 0);
      if (date.getTime() < today) {
        return {
          style: {
            backgroundColor: '#E5E2DB',
            color: '#7A7A72',
            cursor: 'not-allowed',
          },
        };
      }

      if (isExpertBlockedDay(date, expert, expertTz)) {
        return {
          style: {
            backgroundColor: '#FEE2E2',
            cursor: 'not-allowed',
          },
        };
      }
      // Highlight selected date
      if (selectedDate) {
          const selMidnight = new Date(selectedDate).setHours(0, 0, 0, 0);
          if (date.getTime() === selMidnight) {
            return {
              style: {
                backgroundColor: '#59a8f7',
                color: '#fff',
                cursor: 'pointer',
              },
            };
          }
        }

      const hasEvent = events.some(
        (event) =>
          date.getTime() >= new Date(event.start).setHours(0, 0, 0, 0) &&
          date.getTime() <= new Date(event.end).setHours(23, 59, 59, 999),
      );

      const daySlots = getAvailableTimeSlots(date, duration);
      let backgroundColor: string;
      let cursorStyle = 'pointer';

      if (filterSlotIndex === -1) {
        if (!daySlots.length) {
          backgroundColor = '#FEE2E2';
          cursorStyle = 'not-allowed';
        } else if (hasEvent) {
          backgroundColor = '#FEF3C7';
        } else {
          backgroundColor = '#E8F0F8';
        }
      } else if (daySlots.includes(filterSlotIndex)) {
        backgroundColor = '#E8F0F8';
      } else {
        backgroundColor = '#FEE2E2';
        cursorStyle = 'not-allowed';
      }

      return { style: { backgroundColor, cursor: cursorStyle } };
    },
    [events, filterSlotIndex, duration, getAvailableTimeSlots, expert, expertTz, selectedDate],
  );

  const calendarComponents = useMemo(
    () => ({
      toolbar: StudentBookingToolbar,
      dateCellWrapper: ({ value, children }: { value: Date; children: React.ReactElement }) => {
        const title = getBlockedDayTitle(value);
        if (!title) return children;
        return Children.map(children, (child) => {
          if (!React.isValidElement(child)) return child;
          return React.cloneElement(child, { title });
        });
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
        }) => {
          const title = getBlockedDayTitle(date);
          if (!drilldownView) {
            return <span title={title}>{label}</span>;
          }
          return (
            <button
              type="button"
              className="rbc-button-link"
              title={title}
              onClick={onDrillDown}
            >
              {label}
            </button>
          );
        },
      },
    }),
    [getBlockedDayTitle],
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

  const confirmSlot = (slot: number) => {
    if (!selectedDate || slot === null || slot === undefined) return;
    const dayStart = new Date(selectedDate).getTime();
    const start = new Date(dayStart + slot * 1800 * 1000);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    onSlotSelected(start, end, duration);
    setModalOpen(false);
  };

  const handleSelectDate = ({ start, end }: { start: Date; end: Date }) => {
    const dayStart = new Date(start).getTime();
    const dayEnd = new Date(end).getTime();
    if (dayEnd - dayStart !== 3600 * 24 * 1000) return;
    if (dayEnd < Date.now()) return;
    if (!isDateAvailable(start.getTime())) return;

    setSelectedDate(start);
    if (filterSlotIndex >= 0) {
      setSelectedTimeSlot(filterSlotIndex);
      confirmSlot(filterSlotIndex);
    } else {
      setModalOpen(true);
    }
  };

  useEffect(() => {
    setRawExpertSlots(expert?.timeSlots || []);
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
        studentTimeZone={userDetails?.timeZone}
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
                onChange={(v) => setFilterSlotIndex(v === '' ? -1 : Number(v))}
              />
            </div>
            <button
              type="button"
              onClick={() => setFilterSlotIndex(-1)}
              className="rounded-[4px] border border-[#E5E2DB] bg-white px-3 py-2 text-[12px] font-semibold text-[#1A3A4A] hover:bg-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#E5E2DB] bg-white p-2">
        <Calendar
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#1A3A4A]/40 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-[#E5E2DB] bg-white p-6 shadow-[0_20px_50px_rgba(26,58,74,0.15)]">
            <button
              type="button"
              className="absolute right-4 top-4 rounded-lg p-1 text-[#7A7A72] hover:bg-[#F5F3EF]"
              onClick={() => setModalOpen(false)}
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
              label="Session length"
              value={String(duration)}
              disabled={hidePriceInDurationSelection}
              options={DURATION_OPTIONS.map((opt) => ({
                ...opt,
                label:
                  !hidePriceInDurationSelection && hourlyRate > 0
                    ? `${opt.label} · $${((Number(opt.value) * hourlyRate) / 60).toFixed(0)} est.`
                    : opt.label,
              }))}
              onChange={(v) => setDuration(Number(v))}
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
                    {slotToTime(slot)}
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
                onClick={() => setModalOpen(false)}
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
