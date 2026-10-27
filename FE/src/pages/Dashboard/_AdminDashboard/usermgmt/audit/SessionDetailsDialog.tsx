import React from 'react';
import Dialog from '@mui/material/Dialog';
import { X } from 'lucide-react';
import UserSeminarDetails from '../../../seminarDetails';
import { OVERLAY_Z_DIALOG } from '../../../../../utils/overlayLayers';

/**
 * The same details popup students and experts see: "Show Details" in a seminar chat,
 * or the session details for a 1:1 appointment (where the host is the expert).
 */
export default function SessionDetailsDialog({
  open,
  onClose,
  session,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  session: any;
  kind: 'seminar' | 'appointment';
}) {
  const isAppointment = kind === 'appointment';
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ className: 'rounded-2xl border border-slate-200 bg-white shadow-2xl' }}
      sx={{ zIndex: OVERLAY_Z_DIALOG }}
      aria-labelledby="audit-session-details-title"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 id="audit-session-details-title" className="text-base font-semibold text-slate-900">
          {isAppointment ? 'Session details' : 'Seminar details'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={isAppointment ? 'Close session details' : 'Close seminar details'}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
        <UserSeminarDetails
          title={session?.name}
          description={session?.description}
          titleLine={session?.titleLine}
          start={session?.start}
          end={session?.end}
          duration={session?.duration}
          price={session?.price}
          admin={session?.admin}
          participants={session?.participants || []}
          keywords={session?.keywords}
          services={session?.services}
          purposeOther={session?.purposeOther}
          type={isAppointment ? 'individual' : 'seminar'}
          adminLabel={isAppointment ? 'Expert' : undefined}
          createdAt={session?.createdAt}
          isRecurring={session?.isRecurring}
          recurrenceFrequency={session?.recurrenceFrequency}
          recurrenceUnit={session?.recurrenceUnit}
          recurrenceInterval={session?.recurrenceInterval}
          recurrenceWeekdays={session?.recurrenceWeekdays}
          theme="light"
        />
      </div>
    </Dialog>
  );
}
