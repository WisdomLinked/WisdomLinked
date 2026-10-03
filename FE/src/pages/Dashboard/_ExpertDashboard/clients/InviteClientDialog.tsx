import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import OverlayPortal from '../../../../components/OverayPortal';
import SearchableSelect from '../../../../components/ui/SearchableSelect';
import { FOCUS_RING, PRIMARY_BUTTON } from './ui';

type StudentOption = { value: string; label: string; raw: any };

export default function InviteClientDialog({
  open,
  students,
  onClose,
  onPick,
}: {
  open: boolean;
  students: any[];
  onClose: () => void;
  onPick: (student: any) => void;
}) {
  const [picked, setPicked] = useState<StudentOption | null>(null);

  const options = useMemo<StudentOption[]>(
    () =>
      students
        .map((s) => ({ value: String(s._id), label: String(s.username || s.email || 'Student'), raw: s }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [students],
  );

  useEffect(() => {
    if (!open) {
      setPicked(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <OverlayPortal closeModal={onClose}>
      <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-client-title"
          className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`absolute right-3 top-3 rounded-md p-1 hover:bg-slate-100 ${FOCUS_RING}`}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <h3 id="invite-client-title" className="text-lg font-semibold">
            Invite a client
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Pick a student, then propose a session time. They'll get an invitation to accept or decline.
          </p>
          <label htmlFor="invite-client-student" className="mb-1 mt-4 block text-xs font-semibold">
            Student
          </label>
          <SearchableSelect<StudentOption>
            inputId="invite-client-student"
            options={options}
            value={picked}
            onChange={setPicked}
            placeholder="Search students"
            aria-label="Student"
          />
          <button
            type="button"
            disabled={!picked}
            onClick={() => picked && onPick(picked.raw)}
            className={`${PRIMARY_BUTTON} mt-5 h-10 w-full`}
          >
            Continue to propose session
          </button>
        </div>
      </div>
    </OverlayPortal>
  );
}
