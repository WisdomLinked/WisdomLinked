import { Trash2 } from 'lucide-react';

/** Placeholder until account deletion ships; stays disabled. */
export default function DeleteAccountButton() {
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled
        aria-describedby="delete-account-coming-soon"
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-600 opacity-50"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Delete account
      </button>
      <p id="delete-account-coming-soon" className="text-[11px] text-slate-400">
        Coming soon
      </p>
    </div>
  );
}
