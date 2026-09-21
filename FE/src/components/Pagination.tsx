import { ChevronLeft, ChevronRight } from 'lucide-react';

export const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

export function paginationRangeLabel(currentPage: number, pageSize: number, totalCount: number): string {
  if (!totalCount || pageSize <= 0) return '0 of 0';
  const from = currentPage * pageSize + 1;
  const to = Math.min((currentPage + 1) * pageSize, totalCount);
  return `${from}–${to} of ${totalCount}`;
}

export function lastPageIndex(totalCount: number, pageSize: number): number {
  if (!totalCount || pageSize <= 0) return 0;
  return Math.max(0, Math.ceil(totalCount / pageSize) - 1);
}

const navBtn =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center text-slate-500 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wl-brand/40 disabled:pointer-events-none disabled:opacity-35';

export default function Pagination({
  currentPage,
  totalCount,
  pageSize,
  onPage,
  onPageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  id = 'rows-per-page',
}: {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  pageSizeOptions?: number[];
  id?: string;
}) {
  const lastPage = lastPageIndex(totalCount, pageSize);
  const atStart = currentPage <= 0;
  const atEnd = currentPage >= lastPage;
  const range = paginationRangeLabel(currentPage, pageSize, totalCount);

  return (
    <nav
      className="flex min-h-[44px] flex-col gap-3 border-t border-wl-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Pagination"
    >
      {onPageSize ? (
        <label htmlFor={id} className="flex items-center gap-2 text-sm text-slate-600">
          <span className="shrink-0">Rows per page</span>
          <select
            id={id}
            className="h-10 rounded-lg border border-wl-line bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-wl-brand focus:ring-2 focus:ring-wl-brand/30"
            value={pageSize}
            onChange={e => onPageSize(Number(e.target.value))}
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span className="hidden sm:block" />
      )}

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-sm tabular-nums text-slate-600" aria-live="polite">
          {range}
        </span>
        <div className="inline-flex overflow-hidden rounded-lg border border-wl-line bg-white">
          <button
            type="button"
            className={`${navBtn} border-r border-wl-line`}
            disabled={atStart}
            onClick={() => onPage(Math.max(0, currentPage - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </button>
          <button
            type="button"
            className={navBtn}
            disabled={atEnd}
            onClick={() => onPage(Math.min(lastPage, currentPage + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </div>
    </nav>
  );
}
