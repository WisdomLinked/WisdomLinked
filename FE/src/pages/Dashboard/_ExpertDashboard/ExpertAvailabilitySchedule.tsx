import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar } from 'react-big-calendar';
import type { View } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { CalendarDays, Ban, CalendarClock } from 'lucide-react';
import { useDispatch } from 'react-redux';

import { localizer } from '../../../actions/common';
import {
  cancelIndividualAppointment,
  doCancelInvitation,
  doDeclineEvent,
  doGetMyEvents,
  doSetExpertBlockedBookingDates,
} from '../../../api/api';
import { useAppSelector } from '../../../store';
import { updateMe } from '../../../actions/authActions';
import { toYMDInTimeZone } from '../../../utils/schedulingTimezone';

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
    setSelectedDay(date);
    setDayEvents(filtered);
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

  const isFuture = (end: Date) => end > new Date();

  const cancelItem = async (item: any) => {
    if (!isFuture(new Date(item.end))) return;

    const canCancel =
      item.type === 'event' ||
      (item.type === 'individual' && item.status === 'pending');
    if (!canCancel) return;

    setScheduleBusy(true);
    try {
      if (item.type === 'event') {
        if (item.paidBy === 'none') {
          await doCancelInvitation(item._id);
        } else {
          await doDeclineEvent(item._id);
        }
      } else if (item.type === 'individual' && item.status === 'pending') {
        await cancelIndividualAppointment(item._id);
      }
      await (dispatch as any)(updateMe());
      await loadEvents({ manageBusy: false });
      if (selectedDay) openDay(selectedDay);
    } finally {
      setScheduleBusy(false);
    }
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
    setDayModalOpen(false);
  };

  const blockedForSelectedDay =
    selectedDay != null && blockedDates.includes(ymdInExpertTz(selectedDay));

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
            View upcoming sessions on the calendar, cancel future appointments, or block
            full days so students cannot book.
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
              Cancel future sessions or block the entire day for new bookings.
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
                    {isFuture(new Date(ev.end)) &&
                    (ev.type === 'event' ||
                      (ev.type === 'individual' && ev.status === 'pending')) ? (
                      <button
                        type="button"
                        onClick={() => cancelItem(ev)}
                        className="shrink-0 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={toggleBlockSelectedDay}
                disabled={
                  (() => {
                    const t0 = new Date();
                    t0.setHours(0, 0, 0, 0);
                    const s0 = new Date(selectedDay);
                    s0.setHours(0, 0, 0, 0);
                    return s0 < t0;
                  })()
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Ban className="h-4 w-4" aria-hidden />
                {blockedForSelectedDay
                  ? 'Remove block — allow bookings this day'
                  : 'Mark whole day unavailable for bookings'}
              </button>
              <p className="mt-2 text-[11px] text-slate-500">
                Blocked days apply to new student bookings. Existing appointments stay
                listed above until cancelled.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setDayModalOpen(false)}
              className="mt-4 w-full rounded-xl bg-[#234C6A] py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ExpertAvailabilitySchedule;
