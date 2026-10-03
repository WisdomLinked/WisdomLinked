import { UserPlus } from 'lucide-react';
import ExpertDetails from './ExpertDetails';
import FeedCard, { FEED_CTA_OUTLINE, FeedBadge, FeedEmpty, FeedPersonMedia, useDiscoveryCarousel } from './FeedCard';
import type { DiscoveryExpert } from '../../../utils/studentDiscovery';

type Props = {
  items: DiscoveryExpert[];
  onViewProfile: (id: string) => void;
};

export default function NewExpertsCard({ items, onViewProfile }: Props) {
  const { index, fading, prev, next } = useDiscoveryCarousel(items.length);
  const item = items[index];

  return (
    <FeedCard
      title="New experts"
      itemNoun="expert"
      count={items.length}
      index={index}
      onPrev={prev}
      onNext={next}
      fading={fading}
      empty={<FeedEmpty icon={UserPlus} title="No new experts yet" helper="New experts will appear here as they join." />}
      footer={
        item ? (
          <button type="button" onClick={() => onViewProfile(item.id)} className={FEED_CTA_OUTLINE}>
            View profile
          </button>
        ) : null
      }
    >
      {item ? (
        <>
          <FeedPersonMedia
            name={item.name}
            image={item.image}
            badge={<FeedBadge>{item.isNew ? 'New expert' : 'Expert'}</FeedBadge>}
          />
          <ExpertDetails expert={item} />
        </>
      ) : null}
    </FeedCard>
  );
}
