import React from 'react';
import { Calendar, Clock, Users } from 'lucide-react';
import { AUDIT_PILL } from './auditUi';
import { formatSeminarWhen, type SeminarDetailsData } from './auditModel';

function durationLabel(minutes?: number): string {
  if (!minutes || minutes <= 0) return '—';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export default function SeminarDetails({ seminar }: { seminar: SeminarDetailsData }) {
  const completed = seminar.status === 'Completed';
  return (
    <div className="rounded-xl border border-audit-line bg-audit-sunken p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-audit-muted">Seminar details</p>
        <span
          className={`${AUDIT_PILL} ${
            completed ? 'bg-audit-ok-soft text-audit-ok' : 'bg-audit-brand-soft text-audit-brand'
          }`}
        >
          {seminar.status}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-start gap-2">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-audit-muted" aria-hidden />
          <div>
            <dt className="text-xs uppercase tracking-wider text-audit-muted">Date and time</dt>
            <dd className="text-sm text-audit-ink">{formatSeminarWhen(seminar.start)}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-audit-muted" aria-hidden />
          <div>
            <dt className="text-xs uppercase tracking-wider text-audit-muted">Duration</dt>
            <dd className="text-sm text-audit-ink">{durationLabel(seminar.durationMinutes)}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-audit-muted" aria-hidden />
          <div>
            <dt className="text-xs uppercase tracking-wider text-audit-muted">Registered attendees</dt>
            <dd className="text-sm tabular-nums text-audit-ink">{seminar.attendeeCount}</dd>
          </div>
        </div>
      </dl>
    </div>
  );
}
