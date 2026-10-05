import React from 'react';
import { SearchX } from 'lucide-react';

export default function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <section className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E5E2DB] bg-white px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#E8EEF4] text-[#234C6A]">
        <SearchX className="h-5 w-5" aria-hidden />
      </div>
      <h2 className="font-serif text-lg text-[#1A3A4A]">No clients match these filters</h2>
      <p className="mt-1 max-w-sm text-sm text-[#7A7A72]">
        Try a different search, or clear the status and field filters to see everyone.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-5 rounded-full border border-[#E5E2DB] bg-white px-4 py-2 text-sm font-semibold text-[#234C6A] transition hover:bg-[#E8EEF4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]"
      >
        Clear filters
      </button>
    </section>
  );
}
