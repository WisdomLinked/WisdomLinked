import React from 'react';
import StatCard from '../ui/StatCard';

type StatsCardConfig = {
  id: string;
  label: string;
  value: string | number;
  trend?: string;
  subline?: string;
  tooltip?: string;
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  color?: 'primary' | 'success' | 'warning' | 'neutral';
  onClick?: () => void;
};

export default function StatsGrid({
  cards,
  fill = false,
}: {
  cards: StatsCardConfig[];
  /** Stretch the 2x2 grid to its parent's height (e.g. to match a sibling card). */
  fill?: boolean;
}) {
  return (
    <div className={fill ? 'h-full' : 'mt-6'}>
      <div
        className={`grid gap-5 md:grid-cols-1 lg:grid-cols-2 ${fill ? 'h-full lg:auto-rows-fr' : ''}`}
      >
        {cards.map(card => (
          <StatCard
            key={card.id}
            {...card}
            className={fill ? 'h-full !min-h-[150px]' : undefined}
            labelClassName={fill ? 'text-xl leading-snug' : undefined}
          />
        ))}
      </div>
    </div>
  );
}

