import { Calendar, CalendarX, Clock } from 'lucide-react';
import DiscoveryCarouselShell, { useDiscoveryCarousel } from './DiscoveryCarouselShell';
import type { DiscoverySeminar } from '../../../utils/studentDiscovery';

type Props = {
  items: DiscoverySeminar[];
  onRegister: (id: string) => void;
  onViewDetails: (id: string) => void;
  onBrowseAll: () => void;
};

function formatLocalWhen(ms: number) {
  try {
    return {
      date: new Date(ms).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      time: new Date(ms).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }),
    };
  } catch {
    return { date: '—', time: '' };
  }
}

export default function UpcomingSeminarsCard({
  items,
  onRegister,
  onViewDetails,
  onBrowseAll,
}: Props) {
  const { index, fading, prev, next } = useDiscoveryCarousel(items.length);
  const item = items[index];
  const when = item ? formatLocalWhen(item.startAt) : null;

  return (
    <DiscoveryCarouselShell
      title="Upcoming seminars"
      count={items.length}
      index={index}
      onPrev={prev}
      onNext={next}
      fading={fading}
      empty={
        <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-center">
          <CalendarX className="h-7 w-7 text-slate-300" aria-hidden />
          <p className="text-sm font-medium text-slate-700">No upcoming seminars right now</p>
          <button
            type="button"
            onClick={onBrowseAll}
            className="text-xs font-semibold text-[#234C6A] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 rounded"
          >
            Browse all seminars
          </button>
        </div>
      }
      footer={
        item ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onRegister(item.id)}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-[#234C6A] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1b3c53] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40"
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => onViewDetails(item.id)}
              className="text-sm font-semibold text-[#234C6A] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 rounded"
            >
              View details
            </button>
          </div>
        ) : null
      }
    >
      {item && when ? (
        <div className="space-y-3">
          <h4 className="text-lg font-semibold text-slate-900 line-clamp-2">{item.title}</h4>
          <div className="flex items-center gap-2.5 min-w-0">
            {item.expertImage ? (
              <img
                src={item.expertImage}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover bg-slate-100"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
                {(item.expertName || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
            <p className="truncate text-sm text-slate-600">{item.expertName}</p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <p className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4 shrink-0" aria-hidden />
              {when.date}
            </p>
            <p className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0" aria-hidden />
              {when.time}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {item.seatsLeft != null ? (
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  item.seatsLeft < 5
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item.seatsLeft} seat{item.seatsLeft === 1 ? '' : 's'} left
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                Open seats
              </span>
            )}
            <span className="text-sm font-semibold text-slate-700">
              {item.price > 0 ? `$${item.price.toFixed(2)}` : 'Free'}
            </span>
          </div>
        </div>
      ) : null}
    </DiscoveryCarouselShell>
  );
}
