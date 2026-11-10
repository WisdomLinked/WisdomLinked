import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import FileDropzone from './FileDropzone';
import {
  FOCUS,
  currentVersion,
  formatCount,
  nextVersionNumber,
  type AgreementContract,
} from './termsModel';

const NOTES_MAX = 500;
import { OVERLAY_Z_DIALOG } from '../../../../utils/overlayLayers';

export default function PublishDrawer({
  open,
  contract,
  onClose,
  onPublish,
}: {
  open: boolean;
  contract: AgreementContract;
  onClose: () => void;
  /** Rejects with a message to show when the server refuses the publish. */
  onPublish: (payload: { file: File; notes: string }) => Promise<void>;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const next = nextVersionNumber(contract);
  const current = currentVersion(contract);
  const submittingRef = useRef(false);
  submittingRef.current = submitting;
  const requestClose = () => {
    if (!submittingRef.current) onCloseRef.current();
  };
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setFile(null);
    setError('');
    setNotes('');
    setSubmitting(false);
    setSubmitError('');
    const id = window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingRef.current) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) return null;

  const summary = [
    { label: 'Agreement', value: `${contract.label} agreement` },
    { label: 'Version', value: current ? `v${current.number} → v${next}` : `v${next} (first version)` },
    { label: 'File', value: file?.name || '—' },
    { label: 'What changed', value: notes.trim() || 'No change notes' },
    { label: current ? 'Must re-accept' : 'Must accept', value: `${formatCount(contract.audience)} users` },
  ];

  const submit = async () => {
    if (!file || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onPublish({ file, notes: notes.trim() });
    } catch (err) {
      setSubmitError(err instanceof Error && err.message ? err.message : 'Could not publish that document.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: OVERLAY_Z_DIALOG }} role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Dismiss publish panel" onClick={requestClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-terms-title"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Step {step} of 2
            </p>
            <h2 id="publish-terms-title" className="mt-1 text-lg font-semibold text-slate-900">
              Publish {contract.label} v{next}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={requestClose}
            disabled={submitting}
            className={`${FOCUS} rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50`}
            aria-label="Close publish panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {step === 1 ? (
            <div className="space-y-5">
              <FileDropzone
                file={file}
                error={error}
                onSelect={nextFile => {
                  setError('');
                  setFile(nextFile);
                }}
                onError={message => setError(message)}
                onClear={() => {
                  setFile(null);
                  setError('');
                }}
              />
              <div>
                <label htmlFor="terms-change-notes" className="mb-1 block text-sm font-medium text-slate-700">
                  What changed (optional)
                </label>
                <textarea
                  id="terms-change-notes"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                  maxLength={NOTES_MAX}
                  rows={4}
                  className={`${FOCUS} w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900`}
                  placeholder="Clarified refund window for cancelled sessions"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {summary.map(row => (
                  <div key={row.label} className="flex items-start justify-between gap-4 px-4 py-3">
                    <dt className="text-sm text-slate-500">{row.label}</dt>
                    <dd className="text-right text-sm font-medium text-slate-900">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  Publishing cannot be undone. The new version becomes the one students and experts must
                  accept. Older versions and their signatures stay on record.
                </p>
              </div>
              {submitError ? (
                <p className="text-sm text-rose-700" role="alert">
                  {submitError}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          {step === 1 ? (
            <button
              type="button"
              disabled={!file}
              onClick={() => setStep(2)}
              className={`${FOCUS} rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300`}
            >
              Continue
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setSubmitError('');
                  setStep(1);
                }}
                disabled={submitting}
                className={`${FOCUS} rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50`}
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                className={`${FOCUS} rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-500`}
              >
                {submitting ? 'Publishing…' : `Publish v${next}`}
              </button>
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
