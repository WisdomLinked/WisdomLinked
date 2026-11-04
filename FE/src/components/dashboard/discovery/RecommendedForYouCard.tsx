import { Users } from 'lucide-react';
import AnnouncementSlide from './AnnouncementSlide';
import ExpertRecommendationSlide from './ExpertRecommendationSlide';
import FeedCard, {
  FEED_CTA_OUTLINE,
  FEED_CTA_PRIMARY,
  FeedEmpty,
  useDiscoveryCarousel,
} from './FeedCard';
import { firstNameFromDisplayName } from '../../../utils/expertAnnouncement';
import type { RecommendedCarouselItem } from './recommendationTypes';

type Props = {
  items: RecommendedCarouselItem[];
  /** Expert slides are popular fallbacks (no personal matches). */
  popular: boolean;
  error?: string | null;
  onRetry?: () => void;
  onViewProfile: (id: string) => void;
  onMessageExpert: (expertId: string, expertName: string) => void;
  onFindExperts: () => void;
  onUpdateInterests: () => void;
};

export default function RecommendedForYouCard({
  items,
  popular,
  error = null,
  onRetry,
  onViewProfile,
  onMessageExpert,
  onFindExperts,
  onUpdateInterests,
}: Props) {
  const { index, fading, prev, next } = useDiscoveryCarousel(items.length);
  const item = items[index] ?? null;
  const showErrorEmpty = Boolean(error) && items.length === 0;

  const footer = (() => {
    if (showErrorEmpty) {
      return onRetry ? (
        <button type="button" onClick={onRetry} className={FEED_CTA_OUTLINE}>
          Try again
        </button>
      ) : null;
    }
    if (!item) {
      return (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onFindExperts} className={`${FEED_CTA_PRIMARY} sm:flex-1`}>
            Find experts
          </button>
          <button type="button" onClick={onUpdateInterests} className={`${FEED_CTA_OUTLINE} sm:flex-1`}>
            Update interests
          </button>
        </div>
      );
    }
    if (item.type === 'announcement') {
      const firstName = firstNameFromDisplayName(item.announcement.expert.name);
      return (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() =>
              onMessageExpert(item.announcement.expert.id, item.announcement.expert.name)
            }
            className={`${FEED_CTA_PRIMARY} sm:flex-1`}
          >
            Message {firstName}
          </button>
          <button
            type="button"
            onClick={() => onViewProfile(item.announcement.expert.id)}
            className={`${FEED_CTA_OUTLINE} sm:flex-1`}
          >
            View profile
          </button>
        </div>
      );
    }
    return (
      <button type="button" onClick={() => onViewProfile(item.expert.id)} className={FEED_CTA_OUTLINE}>
        View profile
      </button>
    );
  })();

  return (
    <FeedCard
      title="Recommended for you"
      itemNoun="recommendation"
      count={items.length}
      index={index}
      onPrev={prev}
      onNext={next}
      fading={fading}
      empty={
        showErrorEmpty ? (
          <FeedEmpty
            compact
            icon={Users}
            title="Couldn’t load recommendations"
            helper={error || undefined}
          />
        ) : (
          <FeedEmpty
            compact
            icon={Users}
            title="No matches yet"
            helper="Follow experts or add your interests to see personalized recommendations and opportunities."
          />
        )
      }
      footer={footer}
    >
      {item?.type === 'announcement' ? (
        <AnnouncementSlide
          announcement={item.announcement}
          onViewExpert={onViewProfile}
        />
      ) : null}
      {item?.type === 'expert' ? (
        <ExpertRecommendationSlide expert={item.expert} popular={popular || item.popular} />
      ) : null}
    </FeedCard>
  );
}
