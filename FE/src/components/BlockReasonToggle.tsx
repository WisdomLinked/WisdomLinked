import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/** Hides the admin's block reason until the user chooses to read it. */
export default function BlockReasonToggle({ reason }: { reason: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="mt-1.5">
            <button
                type="button"
                data-testid="block-reason-toggle"
                aria-expanded={open}
                onClick={() => setOpen(o => !o)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#234C6A] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/60 rounded"
            >
                {open ? 'Hide reason' : 'View reason'}
                <ChevronDown size={12} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {open ? (
                <div data-testid="block-reason-text" className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reason provided by admin</p>
                    <p className="whitespace-pre-wrap break-words">{reason}</p>
                </div>
            ) : null}
        </div>
    );
}
