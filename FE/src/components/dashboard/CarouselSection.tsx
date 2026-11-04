import type { ComponentType } from 'react';
import NewExpertsCard from './discovery/NewExpertsCard';
import UpcomingSeminarsCard from './discovery/UpcomingSeminarsCard';
import RecommendedForYouCard from './discovery/RecommendedForYouCard';
import { DiscoveryCardSkeleton } from './discovery/FeedCard';
import type { DiscoveryExpert, DiscoverySeminar } from '../../utils/studentDiscovery';
import { DASHBOARD_PAGE_TITLE } from './pageTitle';
import useDashboardRecommendations from '../../hooks/useDashboardRecommendations';

/** @deprecated Kept for any lingering imports; discovery now uses typed props. */
export type CarouselItem = {
  sectionTitle: string;
  title: string;
  description: string;
  tag?: string;
  metaLabel?: string;
  experience?: string;
  location?: string;
  cta: string;
  image?: string;
  onSelect?: () => void;
};

/** @deprecated */
export type CarouselSectionData = {
  id: string;
  category: string;
  icon: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  items: CarouselItem[];
};

export type DiscoverySectionProps = {
  loading?: boolean;
  newExperts: DiscoveryExpert[];
  upcomingSeminars: DiscoverySeminar[];
  recommended: DiscoveryExpert[];
  /** True when `recommended` holds popular experts because there are no personal matches. */
  recommendedPopular: boolean;
  onViewExpert: (id: string) => void;
  onMessageExpert: (expertId: string, expertName: string) => void;
  onOpenSeminar: (id: string) => void;
  onBrowseSeminars: () => void;
  onFindExperts: () => void;
  onCompleteProfile: () => void;
};

export default function CarouselSection({
  loading = false,
  newExperts = [],
  upcomingSeminars = [],
  recommended = [],
  recommendedPopular = false,
  onViewExpert,
  onMessageExpert,
  onOpenSeminar,
  onBrowseSeminars,
  onFindExperts,
  onCompleteProfile,
}: DiscoverySectionProps) {
  const {
    items: recommendedItems,
    popular,
    error: recommendedError,
    refetch: refetchRecommended,
  } = useDashboardRecommendations({
    experts: recommended,
    popular: recommendedPopular,
    enabled: !loading,
  });

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className={DASHBOARD_PAGE_TITLE}>What&apos;s New For You</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Personalized updates and opportunities based on your activity.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <DiscoveryCardSkeleton />
          <DiscoveryCardSkeleton />
          <DiscoveryCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
          <NewExpertsCard items={newExperts} onViewProfile={onViewExpert} />
          <UpcomingSeminarsCard
            items={upcomingSeminars}
            onRegister={onOpenSeminar}
            onViewDetails={onOpenSeminar}
            onBrowseAll={onBrowseSeminars}
          />
          <RecommendedForYouCard
            items={recommendedItems}
            popular={popular}
            error={recommendedError}
            onRetry={refetchRecommended}
            onViewProfile={onViewExpert}
            onMessageExpert={onMessageExpert}
            onFindExperts={onFindExperts}
            onUpdateInterests={onCompleteProfile}
          />
        </div>
      )}
    </section>
  );
}
