import React, { useMemo, useState } from 'react';
import { CalendarDays, Clock, MapPin, X, AlertCircle, Repeat } from 'lucide-react';
import { toYMDLocal } from '../../utils/schedulingTimezone';

const RECUR_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
};

export type Meeting = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  with: string;
  location: string;
  /** Short "duration · purpose" line shown on the meeting card. */
  details?: string;
  type: 'seminar' | 'session';
  recurrence?: 'weekly' | 'biweekly' | 'monthly' | null;
  seriesId?: string | null;
  /** 1:1 sessions can be awaiting expert approval. Seminars are always confirmed. */
  status?: 'pending' | 'confirmed' | 'draft' | 'declined' | 'accepted';
  /** Seminar: the GroupChat id used to open its seminar chat. */
  groupId?: string;
  /** 1:1 session: the expert's user id used to open a private chat. */
  peerUserId?: string;
  peerName?: string;
  peerImage?: string | null;
  /** Original record, carried through so callers (e.g. expert) can open detail modals. */
  raw?: any;
};

const containerClass = 'h-[calc(100vh-56px)] overflow-y-auto px-6 py-7 bg-[#F5F3EF]';

export default function StudentCalendar({
  onJoinMeeting,
  onSelectMeeting,
  meetings = [],
  loading = false,
  error = null,
  onRetry,
  mode = 'student',
  title = 'Calendar',
  subtitle = 'See upcoming seminars and 1-1 sessions, and review your past meetings.',
  loadingLabel = 'Loading your sessions…',
}: {
  onJoinMeeting?: (meeting: Meeting) => void;
  /** When provided (expert mode), clicking a meeting opens a caller-controlled detail view. */
  onSelectMeeting?: (meeting: Meeting) => void;
  meetings?: Meeting[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  mode?: 'student' | 'expert';
  title?: string;
  subtitle?: string;
  loadingLabel?: string;
}) {
  const isExpert = mode === 'expert';
  const today = new Date();
  const todayDateStr = toYMDLocal(today);

  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const [selectedPastId, setSelectedPastId] = useState<string | null>(null);

  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);

  const monthLabel = useMemo(
    () =>
      currentMonth.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    [currentMonth],
  );

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    // Leading blanks
    for (let i = 0; i < firstDay.getDay(); i += 1) {
      days.push(new Date(NaN));
    }
    // Actual days
    for (let d = 1; d <= lastDay.getDate(); d += 1) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [currentMonth]);

  const meetingsByDate = useMemo(() => {
    const map: Record<string, Meeting[]> = {};
    for (const m of meetings) {
      if (!map[m.date]) map[m.date] = [];
      map[m.date].push(m);
    }
    return map;
  }, [meetings]);

  const getMeetingDateTime = (m: Meeting) => {
    // Combine date + time into a local Date so "past vs upcoming" is correct.
    const dt = new Date(`${m.date}T${m.time}:00`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };

  const isPastMeeting = (m: Meeting) => {
    const dt = getMeetingDateTime(m);
    if (!dt) return false;
    return dt.getTime() < Date.now();
  };

  const isPendingMeeting = (m: Meeting) => m.status === 'pending';

  const colorForMeeting = (m: Meeting) => {
    if (isPastMeeting(m)) {
      return {
        bg: 'bg-slate-200 text-slate-600',
        dot: 'bg-slate-400',
        label: m.type === 'seminar' ? 'Past seminar' : 'Past 1-1',
      };
    }
    if (m.status === 'draft') {
      return {
        bg: 'bg-amber-400 text-white',
        dot: 'bg-amber-200',
        label: 'Draft seminar',
      };
    }
    if (m.status === 'declined') {
      return {
        bg: 'bg-rose-500 text-white',
        dot: 'bg-rose-300',
        label: 'Declined',
      };
    }
    if (isPendingMeeting(m)) {
      return {
        bg: 'bg-amber-500 text-white',
        dot: 'bg-amber-300',
        label: m.type === 'seminar' ? 'Pending seminar' : 'Pending 1-1',
      };
    }
    if (m.type === 'seminar') {
      return {
        bg: 'bg-emerald-500 text-white',
        dot: 'bg-emerald-300',
        label: 'Seminar',
      };
    }
    return {
      bg: 'bg-[#2563EB] text-white',
      dot: 'bg-blue-300',
      label: '1-1 session',
    };
  };

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  };

  const isSameDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const collapseSeries = (list: Meeting[]) => {
    const seen = new Set<string>();
    const out: Meeting[] = [];
    for (const m of list) {
      if (m.seriesId) {
        if (seen.has(m.seriesId)) continue;
        seen.add(m.seriesId);
      }
      out.push(m);
    }
    return out;
  };

  const pastMeetings = useMemo(
    () =>
      collapseSeries(
        meetings
          .filter(m => isPastMeeting(m))
          .slice()
          .sort((a, b) => {
            const aDt = getMeetingDateTime(a)?.getTime() ?? 0;
            const bDt = getMeetingDateTime(b)?.getTime() ?? 0;
            return bDt - aDt;
          }),
      ),
    [meetings],
  );

  const upcomingMeetings = useMemo(
    () =>
      collapseSeries(
        meetings
          .filter(m => !isPastMeeting(m))
          .slice()
          .sort((a, b) => {
            const aDt = getMeetingDateTime(a)?.getTime() ?? 0;
            const bDt = getMeetingDateTime(b)?.getTime() ?? 0;
            return aDt - bDt;
          }),
      ),
    [meetings],
  );

  const selectedPast =
    (selectedPastId
      ? pastMeetings.find(m => m.id === selectedPastId)
      : null) ?? pastMeetings[0] ?? null;

  const selectedDayMeetings = selectedDayDate
    ? meetingsByDate[selectedDayDate] ?? []
    : [];

  return (
    <div className={containerClass}>
      <div className="mb-5 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">
            {title}
          </h1>
          <p className="text-sm text-slate-500">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E8EEF4] px-2 py-1 text-[11px] text-[#234C6A]">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Seminar
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
            <span className="inline-block h-2 w-2 rounded-full bg-[#2563EB]" />
            1-1 appointment
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            Pending
          </span>
          {isExpert ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              Draft
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
            Past
          </span>
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="font-semibold">Couldn&apos;t load your calendar</p>
            <p className="mt-0.5 text-[13px] text-red-700">{error}</p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 rounded-[4px] border border-red-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          )}
        </div>
      ) : null}

      {loading && !error ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#234C6A]" />
          {loadingLabel}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_minmax(260px,1fr)]">
        {/* Month grid */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#BCD6EA] bg-[#E8EEF4] text-base font-bold leading-none text-[#234C6A] shadow-sm transition hover:bg-[#234C6A] hover:text-white"
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CalendarDays className="h-4 w-4 text-[#234C6A]" aria-hidden />
              <span>{monthLabel}</span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#BCD6EA] bg-[#E8EEF4] text-base font-bold leading-none text-[#234C6A] shadow-sm transition hover:bg-[#234C6A] hover:text-white"
              aria-label="Next month"
            >
              ›
            </button>
          </header>
          <div className="grid grid-cols-7 gap-1 text-[11px] text-slate-500 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs">
            {daysInMonth.map((date, idx) => {
              const isBlank = Number.isNaN(date.getTime());
              if (isBlank) {
                return <div key={`blank-${idx}`} />;
              }
              const dateStr = toYMDLocal(date);
              const dayMeetings = meetingsByDate[dateStr] || [];
              const isToday = isSameDate(date, today);
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => {
                    setSelectedDayDate(dateStr);
                    setShowDayModal(true);
                  }}
                  className={`min-h-[72px] rounded-xl border border-slate-100 bg-slate-50/60 px-1.5 py-1.5 text-left transition-colors ${
                    isToday
                      ? 'border-[#234C6A] bg-[#E8EEF4]'
                      : 'hover:border-slate-300'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-800">
                      {date.getDate()}
                    </span>
                    {isToday && (
                      <span className="rounded-full bg-[#234C6A] px-1.5 text-[9px] font-semibold text-white">
                        Today
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayMeetings.length === 0 ? (
                      isToday ? (
                        <p className="text-[9px] text-slate-500">No events today</p>
                      ) : null
                    ) : (
                      <>
                        {dayMeetings.slice(0, 3).map(m => (
                          <div
                            key={m.id}
                            className={`flex items-center gap-0.5 truncate rounded-md px-1 py-0.5 text-[10px] text-white ${
                              colorForMeeting(m).bg
                            }`}
                          >
                            {m.recurrence ? (
                              <Repeat className="h-2.5 w-2.5 shrink-0" aria-hidden />
                            ) : null}
                            <span className="truncate">{m.time} · {m.title}</span>
                          </div>
                        ))}
                        {dayMeetings.length > 3 && (
                          <div className="text-[9px] text-slate-500">
                            +{dayMeetings.length - 3} more
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Sidebar: upcoming + add meeting */}
        <section className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Upcoming meetings
            </h2>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {upcomingMeetings
                .map(m => {
                  const recurLabel = m.type === 'seminar' && m.recurrence ? RECUR_LABEL[m.recurrence] : null;
                  const chip = m.status === 'draft'
                    ? { cls: 'bg-amber-100 text-amber-700', text: 'Draft' }
                    : isPendingMeeting(m)
                      ? { cls: 'bg-amber-100 text-amber-700', text: m.type === 'seminar' ? (recurLabel ? `Pending · ${recurLabel}` : 'Pending seminar') : 'Pending 1-1' }
                      : m.type === 'seminar'
                        ? { cls: 'bg-emerald-100 text-emerald-700', text: recurLabel || 'Seminar' }
                        : { cls: 'bg-blue-100 text-blue-700', text: '1-1 session' };
                  return (
                  <div
                    key={m.id}
                    onClick={isExpert ? () => onSelectMeeting?.(m) : undefined}
                    className={`rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700 ${
                      isExpert ? 'cursor-pointer transition-colors hover:bg-slate-100' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1 font-semibold text-slate-900 truncate">
                        {m.recurrence ? (
                          <Repeat className="h-3 w-3 shrink-0 text-[#234C6A]" aria-hidden />
                        ) : null}
                        <span className="truncate">{m.title}</span>
                      </p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${chip.cls}`}>
                        {chip.text}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-600">
                      <Clock className="h-3 w-3" aria-hidden />
                      <span>
                        {m.date} · {m.time}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-600">
                      <MapPin className="h-3 w-3" aria-hidden />
                      <span className="truncate">{m.location}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">{m.with}</p>
                    {m.details ? (
                      <p className="mt-0.5 text-[11px] font-medium text-[#234C6A]">{m.details}</p>
                    ) : null}
                    {isExpert ? (
                      <div className="mt-2 flex justify-end">
                        <span className="text-[11px] font-semibold text-[#234C6A]">
                          View details →
                        </span>
                      </div>
                    ) : isPendingMeeting(m) ? (
                      <p className="mt-2 text-[11px] font-medium text-amber-700">
                        Awaiting expert approval
                      </p>
                    ) : (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => onJoinMeeting?.(m)}
                          className="inline-flex items-center justify-center rounded-[4px] bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-60"
                          disabled={!onJoinMeeting}
                        >
                          {m.type === 'seminar' ? 'Join seminar chat' : 'Join chat'}
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
              {upcomingMeetings.length === 0 && (
                <p className="text-[11px] text-slate-500">
                  No meetings scheduled yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Past meetings
            </h2>

            <div className="space-y-3">
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {pastMeetings.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    No past meetings yet.
                  </p>
                ) : (
                  pastMeetings.map(m => {
                    const active = m.id === selectedPast?.id;
                    const chipBg = 'bg-slate-200 text-slate-600';
                    const label = m.type === 'seminar' ? 'Seminar' : '1-1';
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => (isExpert ? onSelectMeeting?.(m) : setSelectedPastId(m.id))}
                        className={`w-full text-left rounded-xl border px-3 py-2 text-xs transition-colors ${
                          active && !isExpert
                            ? 'border-[#234C6A] bg-[#E8EEF4] text-slate-900'
                            : 'border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900 truncate">
                            {m.title}
                          </p>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${chipBg}`}>
                            {label}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-600">
                          <Clock className="h-3 w-3" aria-hidden />
                          <span>
                            {m.date} · {m.time}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {!isExpert && selectedPast && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {selectedPast.title}
                    </p>
                    <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      Past
                    </span>
                  </div>

                  <div className="mt-2 space-y-2 text-[11px] text-slate-600">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" aria-hidden />
                      <span>
                        {selectedPast.date} · {selectedPast.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" aria-hidden />
                      <span className="truncate">{selectedPast.location}</span>
                    </div>
                    <p className="text-slate-500">
                      {selectedPast.with}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Day details modal */}
      {showDayModal && selectedDayDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={e => {
            if (e.target === e.currentTarget) {
              setShowDayModal(false);
              setSelectedDayDate(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Meetings
                </p>
                <h3 className="text-sm font-semibold text-slate-900">
                  {selectedDayDate}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDayModal(false);
                  setSelectedDayDate(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="p-6">
              {selectedDayMeetings.length === 0 ? (
                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-900">
                    {selectedDayDate === todayDateStr
                      ? 'No events today'
                      : 'No meetings scheduled'}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Try selecting another date.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayMeetings
                    .slice()
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .map(m => (
                      <div
                        key={m.id}
                        onClick={
                          isExpert
                            ? () => {
                                onSelectMeeting?.(m);
                                setShowDayModal(false);
                                setSelectedDayDate(null);
                              }
                            : undefined
                        }
                        className={`rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 ${
                          isExpert ? 'cursor-pointer transition-colors hover:bg-slate-100' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-900">
                              {m.title}
                            </p>
                            {m.type === 'seminar' && m.recurrence ? (
                              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#E8EEF4] px-2 py-0.5 text-[10px] font-semibold text-[#234C6A]">
                                <Repeat className="h-2.5 w-2.5" aria-hidden />
                                {RECUR_LABEL[m.recurrence]}
                              </span>
                            ) : null}
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" aria-hidden />
                                <span>
                                  {m.time}
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" aria-hidden />
                                <span className="truncate max-w-[160px]">
                                  {m.location}
                                </span>
                              </span>
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {m.with}
                            </p>
                            {isExpert ? (
                              <p className="mt-2 text-[11px] font-semibold text-[#234C6A]">
                                View details →
                              </p>
                            ) : (
                              <>
                                {!isPastMeeting(m) && isPendingMeeting(m) && (
                                  <p className="mt-2 text-[11px] font-medium text-amber-700">
                                    Awaiting expert approval
                                  </p>
                                )}
                                {!isPastMeeting(m) && !isPendingMeeting(m) && onJoinMeeting && (
                                  <div className="mt-2">
                                    <button
                                      type="button"
                                      onClick={() => onJoinMeeting?.(m)}
                                      className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110"
                                    >
                                      {m.type === 'seminar' ? 'Join seminar chat' : 'Join chat'}
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          <span
                            className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorForMeeting(m).bg} ${
                              isPastMeeting(m) ? '' : ''
                            }`}
                          >
                            {colorForMeeting(m).label}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

