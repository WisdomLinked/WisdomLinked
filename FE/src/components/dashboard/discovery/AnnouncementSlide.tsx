import { Clock, ExternalLink } from 'lucide-react';
import {
  DetailPanel,
  DetailRow,
  FeedBadge,
  FeedPersonMedia,
  FeedTitle,
} from './FeedCard';
import { shortAgo } from './ExpertDetails';
import { displayLinkHost, isHttpUrl } from '../../../utils/expertAnnouncement';
import type { DashboardAnnouncementItem } from './recommendationTypes';

type Props = {
  announcement: DashboardAnnouncementItem;
  onViewExpert: (expertId: string) => void;
};

export default function AnnouncementSlide({ announcement, onViewExpert }: Props) {
  const expert = announcement.expert;
  const subtitle = [expert.title, expert.field].filter(Boolean).join(' · ');
  const postedMs = new Date(announcement.publishedAt).getTime();
  const postedLabel = Number.isFinite(postedMs)
    ? `Posted ${shortAgo(postedMs)}`
    : 'Posted recently';
  const link =
    announcement.link && isHttpUrl(announcement.link) ? announcement.link : null;

  return (
    <>
      <FeedPersonMedia
        name={expert.name}
        image={expert.image}
        fallback="soft"
        badge={<FeedBadge>Announcement</FeedBadge>}
      />
      <FeedTitle>{announcement.title}</FeedTitle>
      <p className="text-sm text-brand-500 line-clamp-1">
        <button
          type="button"
          onClick={() => onViewExpert(expert.id)}
          className="font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded"
        >
          {expert.name}
        </button>
        {subtitle ? ` · ${subtitle}` : ''}
      </p>

      <DetailPanel>
        <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-brand-700">
          {announcement.message}
        </p>
        <DetailRow icon={Clock} className="text-brand-500">
          {postedLabel}
        </DetailRow>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded"
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            Open link
            <span className="sr-only"> ({displayLinkHost(link)})</span>
          </a>
        ) : null}
      </DetailPanel>
    </>
  );
}
