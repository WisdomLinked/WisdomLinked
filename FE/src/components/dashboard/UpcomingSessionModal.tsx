import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, BookOpen, UserCheck } from 'lucide-react';

type SessionKind = 'seminar' | 'oneToOne';

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

export default function UpcomingSessionModal({
  kind,
  onClose,
  onJoin,
}: {
  kind: SessionKind;
  onClose: () => void;
  onJoin: () => void;
}) {
  const now = useMemo(() => Date.now(), []);

  const targets = useMemo(() => {
    return kind === 'seminar'
      ? { at: now + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000 }
      : { at: now + 4 * 60 * 60 * 1000 };
  }, [kind, now]);

  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const msLeft = targets.at - tick;

  const content = useMemo(() => {
    if (kind === 'seminar') {
      return {
        title: 'AI for Healthcare seminar',
        typeLabel: 'Seminar',
        description:
          'Design safe clinical AI systems using real hospital workflows and case studies.',
        icon: <BookOpen className="h-4 w-4" aria-hidden />,
      };
    }
    return {
      title: '1:1 appointment',
      typeLabel: '1-1 session',
      description:
        'Get personalized guidance with your plan for studies, research, or career.',
      icon: <UserCheck className="h-4 w-4" aria-hidden />,
    };
  }, [kind]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {content.typeLabel}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900 truncate">
              {content.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600">{content.description}</p>

          <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
                    kind === 'seminar' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-[#234C6A]'
                  }`}
                >
                  {content.icon}
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Countdown
                  </p>
                  <div className="mt-0.5 font-mono text-[18px] font-semibold tabular-nums text-[#234C6A]">
                    {formatDuration(msLeft)}
                  </div>
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-600">
                <div className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" aria-hidden />
                  <span>Online</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-[11px] text-slate-600">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              <span>{kind === 'seminar' ? '2 days until next seminar' : '4 hours to next 1:1'}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              <span>Online · WisdomLinked Room</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onJoin}
              className="flex-1 rounded-xl bg-[#234C6A] px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Join meeting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

