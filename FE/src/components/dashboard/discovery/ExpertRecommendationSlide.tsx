import ExpertDetails from './ExpertDetails';
import { FeedBadge, FeedPersonMedia } from './FeedCard';
import type { DiscoveryExpert } from '../../../utils/studentDiscovery';

type Props = {
  expert: DiscoveryExpert;
  popular: boolean;
};

export default function ExpertRecommendationSlide({ expert, popular }: Props) {
  return (
    <>
      <FeedPersonMedia
        name={expert.name}
        image={expert.image}
        fallback="soft"
        badge={<FeedBadge>{popular ? 'Popular' : 'Recommended'}</FeedBadge>}
      />
      <ExpertDetails expert={expert} />
    </>
  );
}
