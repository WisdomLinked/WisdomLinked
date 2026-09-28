import type { ComponentType } from 'react';
import NewExpertsCard from './discovery/NewExpertsCard';
import UpcomingSeminarsCard from './discovery/UpcomingSeminarsCard';
import RecommendedForYouCard from './discovery/RecommendedForYouCard';
import { DiscoveryCardSkeleton } from './discovery/DiscoveryCarouselShell';
import type { DiscoveryExpert, DiscoverySeminar } from '../../utils/studentDiscovery';

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
  recommendedNeedsProfile: boolean;
  onViewExpert: (id: string) => void;
  onOpenSeminar: (id: string) => void;
  onBrowseSeminars: () => void;
  onCompleteProfile: () => void;
};

export default function CarouselSection({
  loading = false,
  newExperts = [],
  upcomingSeminars = [],
  recommended = [],
  recommendedNeedsProfile = false,
  onViewExpert,
  onOpenSeminar,
  onBrowseSeminars,
  onCompleteProfile,
}: DiscoverySectionProps) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900">What&apos;s New For You</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Personalized updates and opportunities based on your activity.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <DiscoveryCardSkeleton />
          <DiscoveryCardSkeleton />
          <DiscoveryCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 items-stretch">
          <NewExpertsCard items={newExperts} onViewProfile={onViewExpert} />
          <UpcomingSeminarsCard
            items={upcomingSeminars}
            onRegister={onOpenSeminar}
            onViewDetails={onOpenSeminar}
            onBrowseAll={onBrowseSeminars}
          />
          <RecommendedForYouCard
            items={recommended}
            needsProfile={recommendedNeedsProfile}
            onViewProfile={onViewExpert}
            onCompleteProfile={onCompleteProfile}
          />
        </div>
      )}
    </section>
  );
}
