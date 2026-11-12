import React from 'react';
import { Briefcase, GraduationCap, Microscope, type LucideIcon } from 'lucide-react';
import type { AdminDemographicsService } from '../../../api/api';
import MissingProfileNotice from './MissingProfileNotice';
import { safePct } from './demographicsMath';

const SERVICE_ICONS: Record<string, LucideIcon> = {
  study_abroad: GraduationCap,
  work_abroad: Briefcase,
  research_guidance: Microscope,
};

export default function ServiceRequestList({
  services,
  studentsTotal,
  studentsWithService,
  missingCount,
  onRemind,
}: {
  services: AdminDemographicsService[];
  studentsTotal: number;
  studentsWithService: number;
  missingCount: number;
  onRemind: () => void;
}) {
  const max = Math.max(1, ...services.map(s => s.students));
  const missingMessage =
    missingCount > 0
      ? `${missingCount.toLocaleString()} student${missingCount === 1 ? " hasn't" : 's haven\'t'} picked a service`
      : '';

  return (
    <div className="min-w-0">
      <div className="mb-1 text-left text-xs font-semibold uppercase tracking-wider text-wl-muted">
        Services requested by students
      </div>
      <p className="mb-3 text-left text-xs text-wl-muted">
        Students can pick more than one · based on {studentsWithService.toLocaleString()} of{' '}
        {studentsTotal.toLocaleString()} students
      </p>

      {studentsTotal === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-wl-muted">
          No students in this range yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {services.map(service => {
            const Icon = SERVICE_ICONS[service.key] || GraduationCap;
            const ofPickers = safePct(service.students, studentsWithService);
            const barWidth = Math.max(service.students > 0 ? 6 : 0, Math.round((service.students / max) * 100));
            return (
              <li
                key={service.key}
                className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-wl-brandSoft text-wl-brand">
                      <Icon size={16} aria-hidden />
                    </span>
                    <span className="truncate text-sm font-medium text-wl-ink">{service.label}</span>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-wl-ink">
                    {service.students.toLocaleString()} student{service.students === 1 ? '' : 's'}
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-wl-line/60"
                  role="img"
                  aria-label={`${service.label}: ${service.students} students (${ofPickers}% of students who picked a service)`}
                  title={`${service.students} students · ${ofPickers}% of students who picked a service`}
                >
                  <div className="h-full rounded-full bg-brownyellow" style={{ width: `${barWidth}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-wl-muted">
                  {ofPickers}% of students who picked a service
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <MissingProfileNotice message={missingMessage} onRemind={onRemind} />
    </div>
  );
}
