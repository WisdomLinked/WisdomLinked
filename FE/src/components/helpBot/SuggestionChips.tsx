type Props = {
  questions: string[];
  onSelect: (question: string) => void;
  disabled?: boolean;
};

export default function SuggestionChips({ questions, onSelect, disabled }: Props) {
  if (!questions.length) return null;

  return (
    <div className="border-t border-slate-100 bg-white px-3 pt-2">
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(q)}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-[#234C6A]/30 hover:bg-[#234C6A]/5 hover:text-[#234C6A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
