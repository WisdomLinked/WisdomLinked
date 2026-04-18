import React, { useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, Star, ArrowLeft, Users } from 'lucide-react';
import type { MentorCardProps } from '../MentorCard';
import { useAppSelector } from '../../store';

const aiHeadshotUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}`;

function extractExperienceYears(experience: string) {
  // Examples: "8+ yrs", "15+ yrs"
  const m = experience.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

export default function ExpertProfile({
  mentor,
  onBack,
  followerCount: followerCountLive,
  isFollowing = false,
  onToggleFollow,
}: {
  mentor: MentorCardProps;
  onBack: () => void;
  /** Live count from parent (list + profile stay in sync). */
  followerCount?: number;
  isFollowing?: boolean;
  onToggleFollow?: (mentorId: string | number) => void;
}) {
  const { auth: { userDetails } } = useAppSelector((state: any) => state);
  const experienceYears = useMemo(
    () => extractExperienceYears(mentor.experience),
    [mentor.experience],
  );

  const oneToOneRate = useMemo(
    () => 60 + experienceYears * 18,
    [experienceYears],
  );
  const seminarRate = useMemo(
    () => 35 + experienceYears * 10,
    [experienceYears],
  );

  const supportsOneToOne = useMemo(
    () => mentor.services.some(s => /1\s*[-–]?\s*on\s*[-–]?\s*1/i.test(s) || /1:1/i.test(s)),
    [mentor.services],
  );
  const supportsSeminar = useMemo(
    () => mentor.services.some(s => /seminar/i.test(s)),
    [mentor.services],
  );

  const [serviceChoice, setServiceChoice] = useState<'oneToOne' | 'seminar'>(() => {
    if (supportsOneToOne) return 'oneToOne';
    if (supportsSeminar) return 'seminar';
    return 'oneToOne';
  });

  const [selectedSlot, setSelectedSlot] = useState<{
    day: string;
    start: string; // HH:MM
    end: string; // HH:MM
  } | null>(null);

  /** 1:1 only — price scales from hourly peak/off-peak rate. */
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<30 | 60 | 90>(60);

  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [seminarBookingSuccessId, setSeminarBookingSuccessId] = useState<string | null>(null);
  const [seminarBookingError, setSeminarBookingError] = useState<string | null>(null);

  const peakRate = 50;
  const oneToOneOffPeakRate = Math.min(oneToOneRate, 45);
  const seminarOffPeakRate = Math.min(seminarRate, 40);

  const isPeakSlot = (slot: { day: string; start: string; end: string } | null) => {
    if (!slot) return false;
    const isWeekend = slot.day === 'Sat' || slot.day === 'Sun';
    const startHour = Number(slot.start.split(':')[0] || 0);
    // Dinner window (mock): 18:00 - 22:00
    const isDinner = startHour >= 18 && startHour < 22;
    return isWeekend || isDinner;
  };

  const oneToOneHourlyRate = isPeakSlot(selectedSlot) ? peakRate : oneToOneOffPeakRate;
  const seminarSessionRate = isPeakSlot(selectedSlot) ? peakRate : seminarOffPeakRate;

  const selectedRate =
    serviceChoice === 'seminar'
      ? seminarSessionRate
      : oneToOneHourlyRate * (sessionDurationMinutes / 60);

  const isPeakSeminarDateTime = (dateStr: string, timeStr: string) => {
    // dateStr like "2026-04-12", timeStr like "17:00"
    const d = new Date(dateStr);
    const day = d.getDay(); // 0=Sun..6=Sat
    const isWeekend = day === 0 || day === 6;
    const startHour = Number(timeStr.split(':')[0] || 0);
    const isDinner = startHour >= 18 && startHour < 22;
    return isWeekend || isDinner;
  };

  const upcomingSeminarPrice = (item: { date: string; time: string }) =>
    isPeakSeminarDateTime(item.date, item.time) ? peakRate : seminarOffPeakRate;

  const availability = useMemo(() => {
    // Deterministic mock schedule based on mentor id.
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return dayNames.map((day, idx) => {
      const available = (idx + mentor.id) % 7 !== 6; // mostly available days
      // Mix daytime and dinner-time slots so peak pricing is visible.
      // Weekend and Thu/Fri often fall into evening windows.
      const isWeekend = day === 'Sat' || day === 'Sun';
      const isLateWeek = day === 'Thu' || day === 'Fri';
      const startHour = isWeekend
        ? 18 + ((mentor.id + idx) % 3) // 18..20
        : isLateWeek
          ? 17 + ((mentor.id + idx) % 3) // 17..19
          : 10 + ((mentor.id + idx) % 4); // 10..13
      const endHour = startHour + 1;
      const start = `${String(startHour).padStart(2, '0')}:00`;
      const end = `${String(endHour).padStart(2, '0')}:00`;
      return { day, available, start, end };
    });
  }, [mentor.id]);

  const resolveNextDateForDay = (day: string) => {
    // Convert e.g. "Mon" => next matching local date.
    const map: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 0,
    };
    const targetDow = map[day] ?? 1;
    const now = new Date();
    const diff = (targetDow - now.getDay() + 7) % 7;
    const date = new Date(now);
    date.setDate(now.getDate() + diff);
    return date;
  };

  const parseTimeToMinutes = (t: string) => {
    const [hh, mm] = t.split(':').map(Number);
    return hh * 60 + mm;
  };

  const formatMinutesDuration = (slot: { start: string; end: string }) => {
    const startM = parseTimeToMinutes(slot.start);
    const endM = parseTimeToMinutes(slot.end);
    const mins = Math.max(30, endM - startM); // guard
    return mins;
  };

  const slotStartEndAsDates = (slot: { day: string; start: string; end: string }) => {
    const base = resolveNextDateForDay(slot.day);
    const [sh, sm] = slot.start.split(':').map(Number);
    const [eh, em] = slot.end.split(':').map(Number);

    const startDt = new Date(base);
    startDt.setHours(sh, sm, 0, 0);

    const endDt = new Date(base);
    endDt.setHours(eh, em, 0, 0);

    return { start: startDt.toISOString(), end: endDt.toISOString() };
  };

  /** 1:1 booking end time follows chosen session length, not the slot window. */
  const slotStartEndAsDatesWithDuration = (
    slot: { day: string; start: string; end: string },
    durationMinutes: number,
  ) => {
    const base = resolveNextDateForDay(slot.day);
    const [sh, sm] = slot.start.split(':').map(Number);
    const startDt = new Date(base);
    startDt.setHours(sh, sm, 0, 0);
    const endDt = new Date(startDt.getTime() + durationMinutes * 60_000);
    return { start: startDt.toISOString(), end: endDt.toISOString() };
  };

  const bio = useMemo(() => {
    return `Professor ${mentor.name} is a ${mentor.title} focused on ${mentor.field}. With ${mentor.experience} of experience, they guide students through research and real-world preparation across 1:1 sessions and seminars.`;
  }, [mentor]);

  const seminarTimeline = useMemo(() => {
    const past = [
      {
        id: `${mentor.id}-p1`,
        title: `Research Methods in ${mentor.field}`,
        date: '2026-02-06',
        attendees: 42,
      },
      {
        id: `${mentor.id}-p2`,
        title: `${mentor.field} Career Roadmap`,
        date: '2026-01-18',
        attendees: 35,
      },
    ];

    const upcoming = [
      {
        id: `${mentor.id}-u1`,
        title: `Advanced Topics in ${mentor.field}`,
        date: '2026-04-12',
        time: '17:00',
      },
      {
        id: `${mentor.id}-u2`,
        title: 'Grad School Application Strategy',
        date: '2026-04-26',
        time: '16:00',
      },
    ];

    return { past, upcoming };
  }, [mentor.id, mentor.field]);

  const resolvedImage = mentor.image ?? aiHeadshotUrl(mentor.name);

  const displayFollowers =
    followerCountLive ?? mentor.followerCount ?? 0;

  return (
    <div className="min-h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF] px-6 py-8 text-[#1A3A4A]">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-[4px] border border-[#E5E2DB] bg-white px-3 py-2 text-[12px] font-semibold text-[#1A3A4A] hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to experts
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="rounded-2xl border border-[#E5E2DB] bg-white p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:items-start">
              <div className="h-44 w-44 shrink-0 overflow-hidden rounded-2xl border border-[#E5E2DB] bg-[#F5F3EF]">
                <img src={resolvedImage} alt={mentor.name} className="h-full w-full object-cover" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="font-serif text-[2rem] font-medium text-[#1A3A4A] leading-tight">
                    {mentor.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-[3px] border border-slate-200 bg-slate-100 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-slate-700">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    {displayFollowers.toLocaleString()} followers
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#7A7A72]">
                  {mentor.title} · {mentor.institution}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-[3px] border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-1.5 text-[12px] font-semibold text-[#1A3A4A]">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {mentor.field}
                  </span>
                  {mentor.services.slice(0, 3).map((s, idx) => (
                    <span
                      key={`${s}-${idx}`}
                      className={[
                        'inline-flex items-center rounded-[3px] border px-3 py-1.5 text-[12px] font-semibold',
                        idx === 0
                          ? 'border-[#1A3A4A] text-[#1A3A4A]'
                          : idx === 1
                            ? 'border-[#C9A84C] text-[#C9A84C]'
                            : 'border-[#E07B54] text-[#E07B54]',
                      ].join(' ')}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {onToggleFollow ? (
              <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end lg:pt-1">
                <button
                  type="button"
                  onClick={() => onToggleFollow(mentor.id)}
                  className={`rounded-[4px] px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition-colors ${
                    isFollowing
                      ? 'bg-slate-500 hover:bg-slate-600'
                      : 'bg-slate-600 hover:bg-slate-700'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow +'}
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-6 border-t border-[#E5E2DB] pt-6">
            <h2 className="font-serif text-[1.15rem] font-medium text-[#1A3A4A]">About</h2>
            <p className="mt-3 text-sm font-sans text-[#7A7A72] leading-relaxed">{bio}</p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-[#E5E2DB] bg-[#F5F3EF] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                Past seminars
              </p>
              <h3 className="mt-1 font-serif text-[1rem] text-[#1A3A4A]">
                Sessions previously hosted
              </h3>
              <div className="mt-3 space-y-2">
                {seminarTimeline.past.map(item => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-[#E5E2DB] bg-white px-3 py-2"
                  >
                    <p className="text-[13px] font-semibold text-[#1A3A4A]">{item.title}</p>
                    <p className="mt-1 text-[11px] text-[#7A7A72]">
                      {item.date} · {item.attendees} attendees
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-[#E5E2DB] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                Upcoming seminars
              </p>
              <h3 className="mt-1 font-serif text-[1rem] text-[#1A3A4A]">
                Next public sessions
              </h3>
              <div className="mt-3 space-y-2">
                {seminarTimeline.upcoming.map(item => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2"
                  >
                    <p className="text-[13px] font-semibold text-[#1A3A4A]">{item.title}</p>
                    <p className="mt-1 text-[11px] text-[#7A7A72]">
                      {item.date} · {item.time}
                    </p>
                    <p className="mt-2 text-[12px] font-semibold text-[#1A3A4A]">
                      ${upcomingSeminarPrice({ date: item.date, time: item.time }).toFixed(0)} est.
                    </p>
                    <div className="mt-2">
                      {seminarBookingSuccessId === item.id ? (
                        <div className="rounded-[4px] bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800">
                          Request saved. Payment will be handled later.
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSeminarBookingError(null);
                            try {
                              const price = upcomingSeminarPrice(item);
                              if (!userDetails?._id) {
                                throw new Error('Please log in again to book this session.');
                              }
                              window.localStorage.setItem(
                                'pendingDetails',
                                JSON.stringify({
                                  friendIds: [userDetails?._id],
                                  groupChatId: item.id,
                                  price,
                                }),
                              );
                              setSeminarBookingSuccessId(item.id);
                            } catch (e: any) {
                              setSeminarBookingError(e?.message || 'Failed to save booking.');
                            }
                          }}
                          className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#1A3A4A] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#122635]"
                        >
                          Book the session
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {seminarBookingError && (
                <div className="mt-3 text-[12px] font-semibold text-red-600">
                  {seminarBookingError}
                </div>
              )}
            </section>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-[#E5E2DB] bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-serif text-[1.15rem] font-medium text-[#1A3A4A]">
                  Book availability
                </h2>
                <p className="mt-1 text-[12px] text-[#7A7A72]">
                  Choose a service, pick a time slot, and confirm your request. Payment comes later.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#F5F3EF] px-2 py-1 text-[11px] font-semibold text-[#1A3A4A]">
                <Calendar className="h-3.5 w-3.5" aria-hidden />
                Week
              </span>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72] mb-2">
                  Service offered
                </p>
                <div className="flex flex-wrap gap-2">
                  {supportsOneToOne && (
                    <button
                      type="button"
                      onClick={() => {
                        setServiceChoice('oneToOne');
                        setSelectedSlot(null);
                        setBookingError(null);
                        setSessionDurationMinutes(60);
                      }}
                      className={`rounded-[4px] border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                        serviceChoice === 'oneToOne'
                          ? 'border-[#1A3A4A] bg-[#1A3A4A] text-white'
                          : 'border-[#E5E2DB] bg-white text-[#1A3A4A] hover:bg-[#F5F3EF]'
                      }`}
                    >
                      1:1 session
                    </button>
                  )}
                  {supportsSeminar && (
                    <button
                      type="button"
                      onClick={() => {
                        setServiceChoice('seminar');
                        setSelectedSlot(null);
                        setBookingError(null);
                        setSessionDurationMinutes(60);
                      }}
                      className={`rounded-[4px] border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                        serviceChoice === 'seminar'
                          ? 'border-[#1A3A4A] bg-[#1A3A4A] text-white'
                          : 'border-[#E5E2DB] bg-white text-[#1A3A4A] hover:bg-[#F5F3EF]'
                      }`}
                    >
                      Seminar
                    </button>
                  )}
                </div>
              </div>

              {serviceChoice === 'oneToOne' && (
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72] mb-2">
                    Session length
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {([30, 60, 90] as const).map(mins => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => {
                          setSessionDurationMinutes(mins);
                          setBookingError(null);
                        }}
                        className={`rounded-[4px] border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                          sessionDurationMinutes === mins
                            ? 'border-[#1A3A4A] bg-[#1A3A4A] text-white'
                            : 'border-[#E5E2DB] bg-white text-[#1A3A4A] hover:bg-[#F5F3EF]'
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-[#7A7A72]">
                    Total uses the hourly rate for your slot (peak or off-peak) × session length.
                  </p>
                </div>
              )}

              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72] mb-2">
                  Availability
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {availability.map(slot => {
                    const active =
                      selectedSlot?.day === slot.day &&
                      selectedSlot?.start === slot.start &&
                      selectedSlot?.end === slot.end;
                    return (
                      <button
                        key={slot.day}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => {
                          setSelectedSlot({ day: slot.day, start: slot.start, end: slot.end });
                          setBookingError(null);
                        }}
                        className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                          !slot.available
                            ? 'border-[#E5E2DB] bg-white opacity-60 cursor-not-allowed'
                            : active
                              ? 'border-[#1A3A4A] bg-[#F5F3EF] ring-2 ring-[#1A3A4A]/20'
                              : 'border-[#E5E2DB] bg-[#F5F3EF] hover:bg-white'
                        } ${active ? 'shadow-[0_10px_25px_rgba(26,58,74,0.10)]' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-semibold">{slot.day}</span>
                          {isPeakSlot(slot) ? (
                            <span className="inline-flex items-center justify-center rounded-full bg-[#C9A84C]/25 px-2 py-0.5 text-[10px] font-semibold text-[#1A3A4A]">
                              Peak
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center rounded-full bg-[#1A3A4A]/10 px-2 py-0.5 text-[11px] font-semibold text-[#1A3A4A]">
                              <Clock className="h-3 w-3" aria-hidden />
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-[12px] font-semibold text-[#1A3A4A]">
                          {slot.start} - {slot.end}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-[#E5E2DB] bg-[#F5F3EF] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#7A7A72]">
                      Rate
                    </p>
                    <p className="mt-2 text-[22px] font-serif font-semibold text-[#1A3A4A]">
                      ${selectedRate.toFixed(0)}
                    </p>
                    <p className="mt-1 text-[12px] text-[#7A7A72]">
                      {serviceChoice === 'oneToOne' ? (
                        selectedSlot ? (
                          <>
                            {sessionDurationMinutes} min · ${oneToOneHourlyRate.toFixed(0)}/hr
                            {isPeakSlot(selectedSlot) ? ' (peak)' : ' (off-peak)'} · estimated total
                          </>
                        ) : (
                          'Pick a slot to see peak vs off-peak hourly rate'
                        )
                      ) : (
                        'Estimated total (payment later)'
                      )}
                    </p>
                  </div>
                  <Star className="h-5 w-5 text-[#C9A84C]" aria-hidden />
                </div>
              </div>

              {bookingError && (
                <div className="text-[12px] font-semibold text-red-600">{bookingError}</div>
              )}

              {!bookingSuccess ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedSlot) {
                      setBookingError('Please select an available day/time slot.');
                      return;
                    }

                    const duration =
                      serviceChoice === 'seminar'
                        ? formatMinutesDuration(selectedSlot)
                        : sessionDurationMinutes;
                    const { start, end } =
                      serviceChoice === 'seminar'
                        ? slotStartEndAsDates({
                            day: selectedSlot.day,
                            start: selectedSlot.start,
                            end: selectedSlot.end,
                          })
                        : slotStartEndAsDatesWithDuration(selectedSlot, sessionDurationMinutes);

                    const serviceLabel =
                      serviceChoice === 'seminar' ? 'Seminar' : '1:1 session';

                    // Create pending details for the existing payment pipeline later.
                    const pending = {
                      // Both keys are added because the existing flow uses `title` while other UI sets `name`.
                      title: `${serviceLabel} request`,
                      name: `${serviceLabel} request`,
                      start,
                      end,
                      duration,
                      price: selectedRate,
                      expert: mentor.id,
                      eventId: null,
                      serviceChoice,
                    };

                    window.localStorage.setItem('pendingDetails', JSON.stringify(pending));
                    setBookingSuccess(true);
                  }}
                  className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#234C6A] px-4 py-3 text-[13px] font-semibold text-white hover:brightness-110"
                >
                  Book availability
                </button>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <div className="text-[14px] font-semibold text-emerald-900">
                    Request saved.
                  </div>
                  <div className="mt-1 text-[12px] text-emerald-800">
                    Next step (payment) will be handled later.
                  </div>
                  <button
                    type="button"
                    onClick={onBack}
                    className="mt-3 w-full rounded-[4px] border border-emerald-200 bg-white px-3 py-2 text-[12px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
                  >
                    Back to experts
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#E5E2DB] bg-white p-6">
            <h2 className="font-serif text-[1.15rem] font-medium text-[#1A3A4A]">Rates</h2>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-[#E5E2DB] bg-[#F5F3EF] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#7A7A72]">
                      1:1 session
                    </p>
                    <p className="mt-2 text-[20px] font-serif font-semibold text-[#1A3A4A]">
                      ${oneToOneRate.toFixed(0)}
                    </p>
                    <p className="mt-1 text-[12px] text-[#7A7A72]">
                      per hour (mock) — 30 / 60 / 90 min totals scale from this rate
                    </p>
                  </div>
                  <Star className="h-5 w-5 text-[#C9A84C]" aria-hidden />
                </div>
              </div>

              <div className="rounded-xl border border-[#E5E2DB] bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#7A7A72]">
                      Seminar
                    </p>
                    <p className="mt-2 text-[20px] font-serif font-semibold text-[#1A3A4A]">
                      ${seminarRate.toFixed(0)}
                    </p>
                    <p className="mt-1 text-[12px] text-[#7A7A72]">per attendee (mock)</p>
                  </div>
                  <Star className="h-5 w-5 text-[#E07B54]" aria-hidden />
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

