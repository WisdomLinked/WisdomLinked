import React from 'react';

interface RequestReviewNoticeProps {
  notice: { title: string; body: string } | null;
  onClose: () => void;
}

/** Shown when an expert follows an emailed request link that can no longer be acted on. */
export default function RequestReviewNotice({ notice, onClose }: RequestReviewNoticeProps) {
  if (!notice) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wl-request-review-title"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="wl-request-review-title" className="text-base font-semibold text-slate-900">
          {notice.title}
        </h2>
        <p className="mt-2 text-sm text-slate-500">{notice.body}</p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-[#234C6A] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
