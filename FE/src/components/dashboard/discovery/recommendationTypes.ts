import type { DiscoveryExpert } from '../../../utils/studentDiscovery';
import type { Announcement } from '../../../utils/expertAnnouncement';

export type DashboardAnnouncementExpert = {
  id: string;
  name: string;
  title: string;
  field: string;
  image?: string | null;
};

export type DashboardAnnouncementItem = Announcement & {
  expert: DashboardAnnouncementExpert;
};

export type ExpertRecommendationSlideItem = {
  type: 'expert';
  id: string;
  expert: DiscoveryExpert;
  popular: boolean;
};

export type AnnouncementRecommendationSlideItem = {
  type: 'announcement';
  id: string;
  announcement: DashboardAnnouncementItem;
};

export type RecommendedCarouselItem =
  | ExpertRecommendationSlideItem
  | AnnouncementRecommendationSlideItem;
