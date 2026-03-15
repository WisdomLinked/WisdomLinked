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
};

export default function StatsGrid({ cards }: { cards: StatsCardConfig[] }) {
  return (
    <div className="mt-6">
      <div className="grid gap-5 md:grid-cols-1 lg:grid-cols-2">
        {cards.map(card => (
          <StatCard key={card.id} {...card} />
        ))}
      </div>
    </div>
  );
}

