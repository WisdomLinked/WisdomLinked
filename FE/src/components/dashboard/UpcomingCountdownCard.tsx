import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Clock, UserCheck } from 'lucide-react';

const pad2 = (n: number) => String(n).padStart(2, '0');

function formatDuration(ms: number) {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / (60 * 60)) % 24;
  const days = Math.floor(totalSeconds / (60 * 60 * 24));

  return days > 0
    ? `${days}d ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
    : `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export default function UpcomingCountdownCard({
  onJoinSeminar,
  onJoinOneToOne,
}: {
  onJoinSeminar?: () => void;
  onJoinOneToOne?: () => void;
}) {
  const targets = useMemo(() => {
    const now = Date.now();
    return {
      nextSeminarAt: now + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000, // ~2 days
      nextOneToOneAt: now + 4 * 60 * 60 * 1000, // ~4 hours
    };
  }, []);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const seminarMs = targets.nextSeminarAt - now;
  const oneToOneMs = targets.nextOneToOneAt - now;

  return (
    <aside className="flex flex-col min-h-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Upcoming sessions
          </h3>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#E8EEF4] px-3 py-1 text-[11px] font-semibold text-[#234C6A]">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <div className="rounded-xl border-2 border-[#234C6A]/60 bg-[#F8FAFC] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <BookOpen className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    Next seminar
                  </p>
                  <p className="text-[12px] font-semibold text-slate-700">
                    AI for Healthcare seminar
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <Clock className="h-3 w-3" aria-hidden />
                  Starts in
                </p>
                <div className="mt-1 font-mono text-[18px] font-semibold tabular-nums text-[#234C6A]">
                  {formatDuration(seminarMs)}
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => onJoinSeminar?.()}
                className="inline-flex items-center justify-center rounded-[4px] bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-60"
                disabled={!onJoinSeminar}
              >
                Join meeting
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border-2 border-[#234C6A]/60 bg-[#F8FAFC] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#234C6A]">
                  <UserCheck className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    Next 1:1
                  </p>
                  <p className="text-[12px] font-semibold text-slate-700">
                    1:1 appointment
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <Clock className="h-3 w-3" aria-hidden />
                  Starts in
                </p>
                <div className="mt-1 font-mono text-[18px] font-semibold tabular-nums text-[#234C6A]">
                  {formatDuration(oneToOneMs)}
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => onJoinOneToOne?.()}
                className="inline-flex items-center justify-center rounded-[4px] bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-60"
                disabled={!onJoinOneToOne}
              >
                Join meeting
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

