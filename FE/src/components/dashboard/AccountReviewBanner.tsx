import React from 'react';
import { Clock } from 'lucide-react';
import { useAccountUnderReview } from '../../hooks/useAccountUnderReview';
import { useAccountBlocked } from '../../hooks/useAccountBlocked';
import { ACCOUNT_BLOCKED_MESSAGE, ACCOUNT_UNDER_REVIEW_MESSAGE } from '../../utils/accountStatus';

export default function AccountReviewBanner({ className }: { className?: string }) {
  const underReview = useAccountUnderReview();
  const blocked = useAccountBlocked();
  if (!underReview && !blocked) return null;

  return (
    <div
      role="status"
      className={`flex flex-col gap-2 rounded-2xl border border-amber-200 border-l-4 border-l-brownyellow bg-amber-50 px-6 py-4 shadow-[0_10px_30px_rgba(35,76,106,0.08)] sm:flex-row sm:items-start sm:gap-3 sm:px-8 sm:py-5 ${className || ''}`}
    >
      <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brownyellow" aria-hidden />
      <p className="min-w-0 flex-1 text-[14px] font-medium leading-relaxed text-wl-ink">
        {blocked ? ACCOUNT_BLOCKED_MESSAGE : ACCOUNT_UNDER_REVIEW_MESSAGE}
      </p>
    </div>
  );
}
