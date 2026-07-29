import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar } from 'react-big-calendar';
import type { View } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { CalendarDays, Ban, CalendarClock } from 'lucide-react';
import { useDispatch } from 'react-redux';

import { isSlotUnavailable, localizer } from '../../../actions/common';
import {
  doGetMyEvents,
  doSetExpertBlockedBookingDates,
  doSetExpertBlockedBookingSlots,
} from '../../../api/api';
import { useAppSelector } from '../../../store';
import { updateMe } from '../../../actions/authActions';
import {
  getExpertSlotsForCalendarDay,
  toYMDInTimeZone,
  viewerSlotToInstant,
} from '../../../utils/schedulingTimezone';
import {
  formatHourRange,
  halfHourIndicesToHours,
} from '../../../utils/schedulingSlots';

/** Stable string id for hooks — raw `_id` may be a new object reference every Redux merge. */
function normalizeUserId(details: any): string | undefined {
  if (!details?._id) return undefined;
  const id = details._id;
  if (typeof id === 'string') return id;
  if (typeof id === 'object' && id !== null) {
    const oid = (id as { $oid?: string }).$oid;
    if (typeof oid === 'string') return oid;
    try {
      const s = id.toString?.();
      if (s && !s.startsWith('[object ')) return s;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

const ExpertAvailabilitySchedule: React.FC = () => {
  const dispatch = useDispatch();
  const { auth: { userDetails } } = useAppSelector((s: any) => s);

  const expertIdKey = normalizeUserId(userDetails) ?? '';
  const meIdRef = useRef<string | undefined>(undefined);
  meIdRef.current = normalizeUserId(userDetails);

  const [events, setEvents] = useState<any[]>([]);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [calDate, setCalDate] = useState(() => new Date());
  const [calView, setCalView] = useState<View>('month');

  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayEvents, setDayEvents] = useState<any[]>([]);
  // Hours (0–23) the expert has marked unavailable for the open day, edited locally
  // and committed on Save so the student calendar only updates once confirmed.
  const [pendingBlockedHours, setPendingBlockedHours] = useState<number[]>([]);
  const [scheduleBanner, setScheduleBanner] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const expertTimeZone = useMemo(
    () => userDetails?.timeZone || 'UTC',
    [userDetails?.timeZone],
  );

  const ymdInExpertTz = useCallback(
    (d: Date) => toYMDInTimeZone(d, expertTimeZone),
    [expertTimeZone],
  );

  const blockedDates: string[] = useMemo(
    () =>
      Array.isArray(userDetails?.blockedBookingDates)
        ? [...userDetails.blockedBookingDates]
        : [],
    [userDetails?.blockedBookingDates],
  );

  const blockedSlotsMap: Record<string, number[]> = useMemo(() => {
    const m = userDetails?.blockedBookingSlots;
    return m && typeof m === 'object' && !Array.isArray(m)
      ? (m as Record<string, number[]>)
      : {};
  }, [userDetails?.blockedBookingSlots]);

  const loadEvents = useCallback(
    async (opts?: { manageBusy?: boolean }) => {
      const manageBusy = opts?.manageBusy !== false;
      if (manageBusy) setScheduleBusy(true);
      try {
        const response = await doGetMyEvents();
        if (!response?.result) {
          setEvents([]);
          return;
        }

        dispatch({ type: 'updateUserDetails', payload: response.result });

        const temp: any[] = (response.result.events || []).map((event: any) => ({
          ...event,
          id: event._id,
          start: new Date(event.start),
          end: new Date(event.end),
          type: 'event',
          title: event.title || '1:1 session',
        }));

        const meId = meIdRef.current;
        (response.result.groupChats || []).forEach((g: any) => {
          const createdById = g.createdBy?._id ?? g.createdBy;
          const iAmCreator =
            createdById != null &&
            meId != null &&
            String(createdById) === String(meId);
          const shouldPush = g.status !== 'pending' || !g.createdBy || iAmCreator;
          if (shouldPush) {
            const isSeminar = g.type === 'seminar';
            temp.push({
              ...g,
              id: g._id,
              start: new Date(g.start),
              end: new Date(g.end),
              title: isSeminar ? `(S) ${g.name}` : g.name || '1:1 session',
              type: g.type,
              status: g.status,
            });
          }
        });

        setEvents(temp);
      } finally {
        if (manageBusy) setScheduleBusy(false);
      }
    },
    [dispatch],
  );

  useEffect(() => {
    void loadEvents();
  }, [loadEvents, expertIdKey]);

  const persistBlockedDates = async (next: string[]) => {
    setScheduleBusy(true);
    setScheduleBanner({ type: null, message: '' });
    try {
      const res = await doSetExpertBlockedBookingDates(next);
      if (res && res !== false && Array.isArray(res.blockedBookingDates)) {
        dispatch({
          type: 'updateUserDetails',
          payload: {
            ...userDetails,
            blockedBookingDates: res.blockedBookingDates,
            ...(res.bookingNoticeHours != null
              ? { bookingNoticeHours: res.bookingNoticeHours }
              : {}),
            ...(res.timeZone ? { timeZone: res.timeZone } : {}),
          },
        });
        setScheduleBanner({
          type: 'success',
          message: 'Unavailable days updated for student bookings.',
        });
        void (dispatch as any)(updateMe());
      } else {
        setScheduleBanner({
          type: 'error',
          message: 'Could not save unavailable days. Please try again.',
        });
      }
    } catch {
      setScheduleBanner({
        type: 'error',
        message: 'Could not save unavailable days. Please try again.',
      });
    } finally {
      setScheduleBusy(false);
    }
  };

  const persistBlockedSlots = async (next: Record<string, number[]>) => {
    setScheduleBusy(true);
    setScheduleBanner({ type: null, message: '' });
    try {
      const res = await doSetExpertBlockedBookingSlots(next);
      if (res && res !== false && res.blockedBookingSlots) {
        dispatch({
          type: 'updateUserDetails',
          payload: {
            ...userDetails,
            blockedBookingSlots: res.blockedBookingSlots,
          },
        });
        setScheduleBanner({
          type: 'success',
          message: 'Unavailable times updated for student bookings.',
        });
        void (dispatch as any)(updateMe());
      } else {
        setScheduleBanner({
          type: 'error',
          message: 'Could not save unavailable times. Please try again.',
        });
      }
    } catch {
      setScheduleBanner({
        type: 'error',
        message: 'Could not save unavailable times. Please try again.',
      });
    } finally {
      setScheduleBusy(false);
    }
  };

  const eventStyleGetter = (event: any, _start: Date, end: Date) => {
    const now = new Date();
    const isPast = end < now;
    let backgroundColor = '#e8f0f8';
    let borderColor = '#c3d4e8';
    let textColor = '#234C6A';

    if (event.type === 'seminar') {
      backgroundColor = '#ecfdf3';
      borderColor = '#bbf7d0';
      textColor = '#14532d';
    }

    if (isPast) {
      backgroundColor = '#f3f4f6';
      borderColor = '#e5e7eb';
      textColor = '#9ca3af';
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '8px',
        border: `1px solid ${borderColor}`,
        color: textColor,
        fontSize: '11px',
        padding: '2px 4px',
      },
    };
  };

  const dayPropGetter = (day: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    if (d < today) {
      return { style: { backgroundColor: '#f8fafc' } };
    }
    const ymd = ymdInExpertTz(d);
    if (blockedDates.includes(ymd)) {
      return {
        style: {
          backgroundColor: '#fef2f2',
        },
      };
    }
    return {};
  };

  const openDay = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const filtered = events.filter(
      (ev: any) => ev.start >= dayStart && ev.start <= dayEnd,
    );
    const ymd = ymdInExpertTz(date);
    const blockedForDay = blockedSlotsMap[ymd] || [];
    const initialHours = halfHourIndicesToHours(blockedForDay).filter(
      (h) => blockedForDay.includes(h * 2) && blockedForDay.includes(h * 2 + 1),
    );
    setSelectedDay(date);
    setDayEvents(filtered);
    setPendingBlockedHours(initialHours);
    setDayModalOpen(true);
  };

  const handleSelectSlot = (slot: { start: Date }) => {
    const d = new Date(slot.start);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    if (d < today) return;
    openDay(d);
  };

  const handleSelectEvent = (ev: any) => {
    openDay(new Date(ev.start));
  };

  const goThisWeek = () => {
    setCalDate(startOfWeekMonday(new Date()));
    setCalView('week');
  };


  const toggleBlockSelectedDay = async () => {
    if (!selectedDay) return;
    const ymd = ymdInExpertTz(selectedDay);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const selStart = new Date(selectedDay);
    selStart.setHours(0, 0, 0, 0);
    if (selStart < todayStart) return;

    const has = blockedDates.includes(ymd);
    const next = has
      ? blockedDates.filter((x) => x !== ymd)
      : [...blockedDates, ymd].sort();
    await persistBlockedDates(next);
  };

  const describeSession = (ev: any): string => {
    if (ev?.type === 'seminar') return `Seminar: ${ev.name || ev.title || 'Seminar'}`;
    if (ev?.type === 'individual') {
      const parts = Array.isArray(ev.participants) ? ev.participants : [];
      const other = parts
        .map((p: any) => (p && typeof p === 'object' ? p.username || p.name : null))
        .find(Boolean);
      return other ? `1:1 with ${other}` : '1:1 session';
    }
    return ev?.title || ev?.name || 'Session';
  };

  const blockedForSelectedDay =
    selectedDay != null && blockedDates.includes(ymdInExpertTz(selectedDay));

  // Hour tiles for the open day: the expert's recurring availability for that date,
  // each tagged as blocked (whole-day or per-slot override) and/or booked (overlaps a session).
  const dayTiles = useMemo(() => {
    if (!selectedDay) return [] as Array<{
      hour: number;
      blocked: boolean;
      booked: boolean;
      sessionLabel: string | null;
    }>;
    const expertSlots = getExpertSlotsForCalendarDay(
      userDetails,
      selectedDay,
      expertTimeZone,
    );
    const hours = halfHourIndicesToHours(expertSlots);
    const durMs = 60 * 60 * 1000;
    return hours.map((hour) => {
      const idxA = hour * 2;
      const blocked = blockedForSelectedDay || pendingBlockedHours.includes(hour);
      const startMs = viewerSlotToInstant(selectedDay, idxA, expertTimeZone).getTime();
      let sessionLabel: string | null = null;
      for (const ev of dayEvents) {
        if (ev?.status === 'declined') continue;
        if (
          isSlotUnavailable(
            startMs,
            durMs,
            new Date(ev.start).getTime(),
            new Date(ev.end).getTime(),
          )
        ) {
          sessionLabel = describeSession(ev);
          break;
        }
      }
      return { hour, blocked, booked: !!sessionLabel, sessionLabel };
    });
  }, [selectedDay, pendingBlockedHours, userDetails, expertTimeZone, dayEvents, blockedForSelectedDay]);

  const allAvailableBlocked = useMemo(() => {
    const nonBooked = dayTiles.filter((t) => !t.booked);
    return nonBooked.length > 0 && nonBooked.every((t) => pendingBlockedHours.includes(t.hour));
  }, [dayTiles, pendingBlockedHours]);

  const toggleSlotSelected = (hour: number) => {
    setPendingBlockedHours((prev) =>
      prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour],
    );
  };

  // Compare the open day's pending selection against what's already saved.
  const slotsDirty = useMemo(() => {
    if (!selectedDay) return false;
    const ymd = ymdInExpertTz(selectedDay);
    const savedHours = halfHourIndicesToHours(blockedSlotsMap[ymd] || []).filter(
      (h) =>
        (blockedSlotsMap[ymd] || []).includes(h * 2) &&
        (blockedSlotsMap[ymd] || []).includes(h * 2 + 1),
    );
    if (savedHours.length !== pendingBlockedHours.length) return true;
    const pendingSet = new Set(pendingBlockedHours);
    return savedHours.some((h) => !pendingSet.has(h));
  }, [selectedDay, pendingBlockedHours, blockedSlotsMap, ymdInExpertTz]);

  const handleSaveDaySlots = async () => {
    if (!selectedDay) return;
    const ymd = ymdInExpertTz(selectedDay);
    const indices: number[] = [];
    pendingBlockedHours.forEach((h) => {
      indices.push(h * 2, h * 2 + 1);
    });
    indices.sort((a, b) => a - b);
    const nextMap: Record<string, number[]> = { ...blockedSlotsMap };
    if (indices.length) nextMap[ymd] = indices;
    else delete nextMap[ymd];
    await persistBlockedSlots(nextMap);
    setDayModalOpen(false);
  };

  return (
    <div id="expert-availability-schedule" className="mt-8 space-y-4 scroll-mt-24">
      {scheduleBanner.type ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            scheduleBanner.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {scheduleBanner.message}
        </div>
      ) : null}
      <style>{`
        .rbc-off-range-bg { background-color: #f1f5f9 !important; }
        .rbc-off-range .rbc-button-link { color: #94a3b8 !important; }
        .rbc-today { background-color: #eff6ff !important; }
        .rbc-toolbar button {
          color: #334155 !important;
          font-size: 13px !important;
          background-color: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 6px !important;
          padding: 5px 12px !important;
        }
        .rbc-toolbar button:hover {
          background-color: #e2e8f0 !important;
        }
        .rbc-toolbar button.rbc-active {
          background-color: #234c6a !important;
          color: #ffffff !important;
          border-color: #234c6a !important;
        }
        .rbc-toolbar-label { color: #0f172a !important; font-weight: 600 !important; font-size: 15px !important; }
        .rbc-header { background-color: #f8fafc; color: #475569; font-size: 12px; padding: 8px 0; }
        .rbc-month-view { border-radius: 8px; overflow: hidden; }
      `}</style>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Schedule & bookings</h2>
          <p className="mt-1 text-sm text-gray-500">
            View upcoming sessions on the calendar, cancel future appointments, or click a
            day to block full days or individual time slots so students cannot book.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goThisWeek}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-[#234C6A] shadow-sm hover:bg-slate-50"
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
            This week
          </button>
          <button
            type="button"
            onClick={() => {
              setCalDate(new Date());
              setCalView('month');
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <CalendarClock className="h-4 w-4" aria-hidden />
            Today
          </button>
          <button
            type="button"
            onClick={() => loadEvents()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="relative rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        {scheduleBusy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 text-sm font-medium text-slate-600">
            Loading schedule…
          </div>
        ) : null}
        <Calendar
          style={{ minHeight: 520 }}
          localizer={localizer}
          events={events}
          date={calDate}
          view={calView}
          views={['month', 'week']}
          onNavigate={setCalDate}
          onView={(v) => setCalView(v)}
          selectable={!scheduleBusy}
          eventPropGetter={eventStyleGetter}
          dayPropGetter={dayPropGetter}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
        />
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Seminar
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2 py-1">
          <span className="h-2 w-2 rounded-full bg-sky-500" />
          1:1 / event
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-1">
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          Day blocked (no bookings)
        </span>
      </div>

      {dayModalOpen && selectedDay ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            className="absolute inset-0"
            aria-hidden
            onClick={() => setDayModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {selectedDay.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Block the entire day or specific time slots so students cannot book.
            </p>

            <div className="mt-4 max-h-56 space-y-2 overflow-y-auto">
              {dayEvents.length === 0 ? (
                <p className="text-sm text-slate-500">No sessions on this day.</p>
              ) : (
                dayEvents.map((ev: any) => (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {ev.title}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(ev.start).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}{' '}
                        –{' '}
                        {new Date(ev.end).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {' · '}
                        <span className="capitalize">{ev.type}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {(() => {
              const t0 = new Date();
              t0.setHours(0, 0, 0, 0);
              const s0 = new Date(selectedDay);
              s0.setHours(0, 0, 0, 0);
              const isPastDay = s0 < t0;

              return (
                <>
                  {dayTiles.length > 0 ? (
                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-800">
                          Available times
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          {blockedForSelectedDay
                            ? 'Whole day marked unavailable'
                            : 'Select times to mark unavailable'}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {dayTiles.map((tile) => {
                          if (tile.booked) {
                            return (
                              <div
                                key={tile.hour}
                                title={tile.sessionLabel || 'Booked'}
                                className="cursor-default rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-center text-[11px] font-medium text-amber-800"
                              >
                                <div>{formatHourRange(tile.hour)}</div>
                                <div className="mt-0.5 truncate text-[10px] font-normal opacity-80">
                                  {tile.sessionLabel}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <button
                              key={tile.hour}
                              type="button"
                              aria-pressed={tile.blocked}
                              disabled={isPastDay || scheduleBusy || blockedForSelectedDay}
                              onClick={() => toggleSlotSelected(tile.hour)}
                              title={
                                blockedForSelectedDay
                                  ? 'The whole day is marked unavailable'
                                  : tile.blocked
                                  ? 'Selected as unavailable — tap to keep it available'
                                  : 'Available — tap to mark unavailable'
                              }
                              className={[
                                'rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                                tile.blocked
                                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-[#234C6A] hover:text-[#234C6A]',
                              ].join(' ')}
                            >
                              <span className={tile.blocked ? 'line-through decoration-rose-500/70' : ''}>
                                {formatHourRange(tile.hour)}
                              </span>
                              {tile.blocked ? (
                                <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide text-rose-500">
                                  Unavailable
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">
                        Times with a booking (amber) can't be blocked — cancel the
                        session first. Struck-through times are saved as unavailable and
                        won't be offered to students on this date when you tap Save.
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={toggleBlockSelectedDay}
                      disabled={isPastDay || scheduleBusy || (!blockedForSelectedDay && allAvailableBlocked)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Ban className="h-4 w-4" aria-hidden />
                      {blockedForSelectedDay
                        ? 'Remove block — allow bookings this day'
                        : 'Mark whole day unavailable for bookings'}
                    </button>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {!blockedForSelectedDay && allAvailableBlocked
                        ? 'Every available time is already marked unavailable — save to apply, or unblock a slot first.'
                        : 'Blocked days apply to new student bookings only. Any sessions already booked on this day stay scheduled.'}
                    </p>
                  </div>
                </>
              );
            })()}

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setDayModalOpen(false)}
                disabled={scheduleBusy}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveDaySlots()}
                disabled={scheduleBusy || !slotsDirty}
                className="flex-1 rounded-xl bg-[#234C6A] py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {scheduleBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ExpertAvailabilitySchedule;
