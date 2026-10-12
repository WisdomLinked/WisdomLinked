import React from 'react';
import SeminarDetails from '../../pages/Dashboard/seminarDetails';
import type { UpcomingModalSession } from './UpcomingSessionModal';

/** The session/seminar details popup opened by clicking a session title on a dashboard. */
export default function SessionDetailsDialog({
  title,
  briefLabel,
  detail,
  hideParticipants = false,
  onClose,
}: {
  title: string;
  briefLabel?: string;
  detail: NonNullable<UpcomingModalSession['detail']>;
  hideParticipants?: boolean;
  onClose: () => void;
}) {
  const heading = briefLabel || 'Session details';
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${heading}: ${title}`}
        className="w-full max-w-[460px] max-h-[88vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {heading}
            </p>
            <h3 className="mt-1 text-base font-semibold text-slate-900 truncate">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">
          <SeminarDetails
            {...detail}
            theme="light"
            hideParticipants={hideParticipants}
            adminLabel="Expert"
          />
        </div>
      </div>
    </div>
  );
}
