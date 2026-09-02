import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({
  currentPage,
  totalPage,
  goPrev,
  goNext,
  goFirst,
  goLast,
}: {
  currentPage: number;
  totalPage: number;
  goPrev: () => void;
  goNext: () => void;
  goFirst: () => void;
  goLast: () => void;
}) => {
  const iconNav =
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-wl-line bg-white text-wl-brand shadow-sm transition hover:bg-wl-brandSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/25 disabled:pointer-events-none disabled:opacity-35';
  const textNav =
    'inline-flex h-9 items-center rounded-lg border border-wl-line bg-white px-3 text-[13px] font-semibold text-wl-brand shadow-sm transition hover:bg-wl-brandSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/25 disabled:pointer-events-none disabled:opacity-35';

  return (
    <div
      className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-wl-line bg-wl-card p-1 shadow-[0_1px_3px_rgba(35,76,106,0.08)]"
      role="navigation"
      aria-label="Pagination"
    >
      <button type="button" className={textNav} disabled={currentPage === 0} onClick={goFirst}>
        First
      </button>
      <button
        type="button"
        className={iconNav}
        disabled={currentPage === 0}
        onClick={goPrev}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
      </button>
      <div className="flex min-h-9 min-w-[8.5rem] items-center justify-center rounded-lg bg-wl-brandSoft/80 px-3">
        <span className="text-[12px] font-medium tabular-nums text-wl-ink">
          Page <span className="font-semibold text-wl-brand">{currentPage + 1}</span>
          <span className="text-wl-muted"> of </span>
          <span className="font-semibold text-wl-brand">{totalPage + 1}</span>
        </span>
      </div>
      <button
        type="button"
        className={iconNav}
        disabled={currentPage >= totalPage}
        onClick={goNext}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className={textNav}
        disabled={currentPage >= totalPage}
        onClick={goLast}
      >
        Last
      </button>
    </div>
  );
};

export default Pagination;
