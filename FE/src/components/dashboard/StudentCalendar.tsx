import React, { useMemo, useState } from 'react';
import { CalendarDays, Clock, Plus, MapPin } from 'lucide-react';

type Meeting = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  with: string;
  location: string;
  type: 'seminar' | 'session';
};

const initialMeetings: Meeting[] = [
  {
    id: 'm1',
    title: 'AI for Healthcare seminar',
    date: new Date().toISOString().slice(0, 10),
    time: '17:00',
    with: 'Seminar host: Dr. Yuki Tanaka',
    location: 'Online · WisdomLinked Room',
    type: 'seminar',
  },
  {
    id: 'm2',
    title: '1:1 with Dr. Emily Chen',
    date: new Date(new Date().setDate(new Date().getDate() + 2))
      .toISOString()
      .slice(0, 10),
    time: '10:30',
    with: 'Mentor: Dr. Emily Chen',
    location: 'Online · WisdomLinked Room',
    type: 'session',
  },
];

const containerClass = 'h-[calc(100vh-56px)] overflow-y-auto px-6 py-7 bg-[#F5F3EF]';

export default function StudentCalendar() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);

  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(today.toISOString().slice(0, 10));
  const [newTime, setNewTime] = useState('09:00');
  const [newWith, setNewWith] = useState('');
  const [newType, setNewType] = useState<'seminar' | 'session'>('session');

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

  const handleAddMeeting = () => {
    if (!newTitle.trim()) return;
    const id = `m-${Date.now()}`;
    const meeting: Meeting = {
      id,
      title: newTitle.trim(),
      date: newDate,
      time: newTime,
      with: newWith.trim() || 'Custom meeting',
      location: 'Online · WisdomLinked Room',
      type: newType,
    };
    setMeetings(prev => [...prev, meeting]);
    setNewTitle('');
    setNewWith('');
  };

  const isSameDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const todayStr = today.toISOString().slice(0, 10);

  return (
    <div className={containerClass}>
      <div className="mb-5 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">
            Calendar
          </h1>
          <p className="text-sm text-slate-500">
            See your upcoming seminars and 1-1 sessions, and add new meetings.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E8EEF4] px-2 py-1 text-[11px] text-[#234C6A]">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Seminar
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
            1-1 session
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_minmax(260px,1fr)]">
        {/* Month grid */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
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
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
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
              const dateStr = date.toISOString().slice(0, 10);
              const dayMeetings = meetingsByDate[dateStr] || [];
              const isToday = isSameDate(date, today);
              return (
                <div
                  key={dateStr}
                  className={`min-h-[72px] rounded-xl border border-slate-100 bg-slate-50/60 px-1.5 py-1.5 ${
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
                    {dayMeetings.slice(0, 3).map(m => (
                      <div
                        key={m.id}
                        className={`truncate rounded-md px-1 py-0.5 text-[10px] text-white ${
                          m.type === 'seminar'
                            ? 'bg-emerald-500'
                            : 'bg-sky-500'
                        }`}
                      >
                        {m.time} · {m.title}
                      </div>
                    ))}
                    {dayMeetings.length > 3 && (
                      <div className="text-[9px] text-slate-500">
                        +{dayMeetings.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
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
              {meetings
                .slice()
                .sort((a, b) =>
                  `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
                )
                .map(m => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900 truncate">
                        {m.title}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          m.type === 'seminar'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-sky-100 text-sky-700'
                        }`}
                      >
                        {m.type === 'seminar' ? 'Seminar' : '1-1 session'}
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
                  </div>
                ))}
              {meetings.length === 0 && (
                <p className="text-[11px] text-slate-500">
                  No meetings scheduled yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Add new meeting
            </h2>
            <div className="space-y-2 text-xs">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. 1-1 with Dr. Chen"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#234C6A] focus:ring-1 focus:ring-[#234C6A]/40"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#234C6A] focus:ring-1 focus:ring-[#234C6A]/40"
                  />
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Time
                  </label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#234C6A] focus:ring-1 focus:ring-[#234C6A]/40"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  With (optional)
                </label>
                <input
                  type="text"
                  value={newWith}
                  onChange={e => setNewWith(e.target.value)}
                  placeholder="e.g. Prof. Ortiz"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#234C6A] focus:ring-1 focus:ring-[#234C6A]/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewType('session')}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium ${
                      newType === 'session'
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    1-1 session
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType('seminar')}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium ${
                      newType === 'seminar'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Seminar
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddMeeting}
                disabled={!newTitle.trim()}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#234C6A] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add meeting
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

