import { Users } from 'lucide-react';
import ExpertDetails from './ExpertDetails';
import FeedCard, {
  FEED_CTA_OUTLINE,
  FEED_CTA_PRIMARY,
  FeedBadge,
  FeedEmpty,
  FeedPersonMedia,
  useDiscoveryCarousel,
} from './FeedCard';
import type { DiscoveryExpert } from '../../../utils/studentDiscovery';

type Props = {
  items: DiscoveryExpert[];
  /** Items are popular experts shown because there are no personal matches. */
  popular: boolean;
  onViewProfile: (id: string) => void;
  onUpdateInterests: () => void;
};

export default function RecommendedForYouCard({ items, popular, onViewProfile, onUpdateInterests }: Props) {
  const { index, fading, prev, next } = useDiscoveryCarousel(items.length);
  const item = items[index];

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
        <FeedEmpty
          compact
          icon={Users}
          title="No matches yet"
          helper="Add your interests to get personalized expert matches."
        />
      }
      footer={
        item ? (
          <button type="button" onClick={() => onViewProfile(item.id)} className={FEED_CTA_OUTLINE}>
            View profile
          </button>
        ) : (
          <button type="button" onClick={onUpdateInterests} className={FEED_CTA_PRIMARY}>
            Update interests
          </button>
        )
      }
    >
      {item ? (
        <>
          <FeedPersonMedia
            name={item.name}
            image={item.image}
            fallback="soft"
            badge={<FeedBadge>{popular ? 'Popular' : 'Recommended'}</FeedBadge>}
          />
          <ExpertDetails expert={item} />
        </>
      ) : null}
    </FeedCard>
  );
}
