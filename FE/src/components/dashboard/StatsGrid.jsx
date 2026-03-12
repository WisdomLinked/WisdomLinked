import React from 'react';
import StatCard from '../ui/StatCard';

export default function StatsGrid({ cards }) {
  return (
    <div className="mt-6">
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map(card => (
          <StatCard key={card.id} {...card} />
        ))}
      </div>
    </div>
  );
}

