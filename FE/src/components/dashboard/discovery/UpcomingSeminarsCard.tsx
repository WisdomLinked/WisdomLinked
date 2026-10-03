import { AlertCircle, Calendar, CalendarX, Clock, Users } from 'lucide-react';
import FeedCard, {
  DetailPanel,
  DetailRow,
  FEED_CTA_OUTLINE,
  FEED_CTA_PRIMARY,
  FeedBadge,
  FeedEmpty,
  FeedMedia,
  FeedTitle,
  initialsFor,
  useDiscoveryCarousel,
} from './FeedCard';
import type { DiscoverySeminar } from '../../../utils/studentDiscovery';

type Props = {
  items: DiscoverySeminar[];
  onRegister: (id: string) => void;
  onViewDetails: (id: string) => void;
  onBrowseAll: () => void;
};

const FEW_SEATS_THRESHOLD = 10;

function formatWhen(ms: number) {
  const d = new Date(ms);
  return {
    iso: d.toISOString(),
    month: d.toLocaleDateString(undefined, { month: 'short' }),
    day: d.toLocaleDateString(undefined, { day: 'numeric' }),
    date: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
  };
}

function formatPrice(price: number): string {
  return price > 0 ? `$${price.toFixed(2)}` : 'Free';
}

export default function UpcomingSeminarsCard({ items, onRegister, onViewDetails, onBrowseAll }: Props) {
  const { index, fading, prev, next } = useDiscoveryCarousel(items.length);
  const item = items[index];
  const when = item ? formatWhen(item.startAt) : null;
  const fewSeats = item?.seatsLeft != null && item.seatsLeft < FEW_SEATS_THRESHOLD;

  return (
    <FeedCard
      title="Upcoming seminars"
      itemNoun="seminar"
      count={items.length}
      index={index}
      onPrev={prev}
      onNext={next}
      fading={fading}
      empty={
        <FeedEmpty
          icon={CalendarX}
          title="No upcoming seminars right now"
          helper="New seminars from experts in your field will show up here."
        />
      }
      footer={
        item ? (
          <div className="flex gap-3">
            <button type="button" onClick={() => onRegister(item.id)} className={`${FEED_CTA_PRIMARY} flex-1`}>
              Register
            </button>
            <button type="button" onClick={() => onViewDetails(item.id)} className={`${FEED_CTA_OUTLINE} !w-auto shrink-0`}>
              Details
            </button>
          </div>
        ) : (
          <button type="button" onClick={onBrowseAll} className={FEED_CTA_OUTLINE}>
            Browse all seminars
          </button>
        )
      }
    >
      {item && when ? (
        <>
          <FeedMedia className="bg-gradient-to-br from-brand-mist to-brand-25" badge={<FeedBadge>Seminar</FeedBadge>}>
            {item.coverImage ? (
              <img src={item.coverImage} alt={item.title} className="h-full w-full object-cover object-center" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <time
                  dateTime={when.iso}
                  className="flex flex-col items-center rounded-lg bg-white px-4 py-1.5 shadow-sm"
                >
                  <span className="text-xs font-medium uppercase tracking-widest text-brand-600">{when.month}</span>
                  <span className="text-2xl font-semibold leading-tight text-brand-900">{when.day}</span>
                </time>
              </div>
            )}
          </FeedMedia>

          <FeedTitle>{item.title}</FeedTitle>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            {item.expertImage ? (
              <img src={item.expertImage} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
            ) : (
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-semibold text-brand-700"
                aria-hidden="true"
              >
                {initialsFor(item.expertName).slice(0, 1)}
              </span>
            )}
            <p className="truncate text-sm text-brand-500">Hosted by {item.expertName}</p>
          </div>

          <DetailPanel>
            <DetailRow icon={Calendar}>
              <time dateTime={when.iso}>{when.date}</time>
            </DetailRow>
            <DetailRow icon={Clock}>
              <time dateTime={when.iso}>{when.time}</time>
            </DetailRow>
            <DetailRow
              icon={fewSeats ? AlertCircle : Users}
              className={fewSeats ? 'font-medium text-amber-700' : undefined}
              iconClassName={fewSeats ? 'text-amber-700' : undefined}
            >
              {item.seatsLeft != null
                ? `${item.seatsLeft} seat${item.seatsLeft === 1 ? '' : 's'} left`
                : 'Open seats'}
            </DetailRow>
          </DetailPanel>

          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xs text-brand-500">Per seat</span>
            <span className="text-lg font-semibold text-brand-900">{formatPrice(item.price)}</span>
          </div>
        </>
      ) : null}
    </FeedCard>
  );
}
