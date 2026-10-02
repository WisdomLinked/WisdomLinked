import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { STATIC_FAQS } from './faqData';

type Props = {
  onSelect: (question: string) => void;
  disabled?: boolean;
};

const PREVIEW = 5;

export default function FaqList({ onSelect, disabled }: Props) {
  const [expanded, setExpanded] = useState(false);
  const faqs = STATIC_FAQS as readonly string[];
  const visible = expanded ? faqs : faqs.slice(0, PREVIEW);
  const hasMore = faqs.length > PREVIEW;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Popular questions
      </p>
      <ul className="space-y-2">
        {visible.map((q) => (
          <li key={q}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(q)}
              className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-[#234C6A]/30 hover:bg-[#234C6A]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 disabled:opacity-50"
            >
              <span className="min-w-0 flex-1">{q}</span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#234C6A]"
                aria-hidden
              />
            </button>
          </li>
        ))}
      </ul>
      {hasMore && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs font-semibold text-[#234C6A] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 rounded"
        >
          View all questions
        </button>
      ) : null}
    </div>
  );
}
