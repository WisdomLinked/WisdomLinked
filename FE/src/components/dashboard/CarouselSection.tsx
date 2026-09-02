import React from 'react';
import CarouselCard from '../ui/CarouselCard';

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

export type CarouselSectionData = {
  id: string;
  category: string;
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  items: CarouselItem[];
};

export default function CarouselSection({
  sections = [],
  loading = false,
}: {
  sections?: CarouselSectionData[];
  loading?: boolean;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            What's New For You
          </h2>
          <p className="text-sm text-slate-500">
            Personalized updates and opportunities based on your activity.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[18rem] animate-pulse rounded-2xl border border-slate-200 bg-white/60"
            />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            Nothing new to show yet.
          </p>
          <p className="mt-1 text-[13px] text-slate-500">
            New experts and seminars will appear here as they become available.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {sections.map(section => (
            <CarouselCard
              key={section.id}
              category={section.category}
              icon={section.icon}
              items={section.items}
            />
          ))}
        </div>
      )}
    </section>
  );
}
