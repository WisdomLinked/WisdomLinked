import { Clock, Globe, MapPin, Sparkles } from 'lucide-react';
import { DetailPanel, DetailRow, FeedSubtitle, FeedTags, FeedTitle } from './FeedCard';
import type { DiscoveryExpert } from '../../../utils/studentDiscovery';

export function shortAgo(ms: number): string {
  const days = Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
  if (days === 0) return 'today';
  if (days < 21) return `${days}d ago`;
  if (days < 90) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

/**
 * Name, role and tags, then a detail panel: the "Why this match" panel when
 * `expert.reason` is set, otherwise service / country / joined facts.
 */
export default function ExpertDetails({ expert }: { expert: DiscoveryExpert }) {
  const service = expert.services?.[0];
  const hasFacts = Boolean(service || expert.country || expert.joinedAt);

  return (
    <>
      <FeedTitle>{expert.name}</FeedTitle>
      {expert.title ? <FeedSubtitle>{expert.title}</FeedSubtitle> : null}
      <FeedTags tags={expert.tags} />

      {expert.reason ? (
        <DetailPanel emphasized>
          <DetailRow icon={Sparkles} className="font-medium text-brand-800">
            Why this match
          </DetailRow>
          <DetailRow icon={null}>{expert.reason}</DetailRow>
        </DetailPanel>
      ) : hasFacts ? (
        <DetailPanel>
          {service ? <DetailRow icon={Globe}>{service}</DetailRow> : null}
          {expert.country ? <DetailRow icon={MapPin}>{expert.country}</DetailRow> : null}
          {expert.joinedAt ? <DetailRow icon={Clock}>Joined {shortAgo(expert.joinedAt)}</DetailRow> : null}
        </DetailPanel>
      ) : null}
    </>
  );
}
