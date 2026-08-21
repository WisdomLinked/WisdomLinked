import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import UpcomingCountdownCard from './UpcomingCountdownCard';

describe('UpcomingCountdownCard duration', () => {
  it('shows the length of the next 1:1', () => {
    render(
      <UpcomingCountdownCard
        nextOneToOne={{
          title: 'Essay review',
          startAt: Date.now() + 3600_000,
          durationMinutes: 45,
        }}
      />,
    );

    expect(screen.getByText('45 min')).toBeInTheDocument();
  });

  it('shows the length of a pending 1:1 too', () => {
    render(
      <UpcomingCountdownCard
        nextOneToOne={{
          title: 'Essay review',
          startAt: Date.now() + 3600_000,
          durationMinutes: 60,
          pending: true,
        }}
      />,
    );

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('1 hr')).toBeInTheDocument();
  });

  it('renders nothing extra when the duration is unknown', () => {
    render(
      <UpcomingCountdownCard
        nextOneToOne={{ title: 'Essay review', startAt: Date.now() + 3600_000 }}
      />,
    );

    expect(screen.queryByText(/\d+ min$/)).not.toBeInTheDocument();
  });
});
