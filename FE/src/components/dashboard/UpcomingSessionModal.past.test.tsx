import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UpcomingSessionModal, { type UpcomingModalSession } from './UpcomingSessionModal';

const MIN = 60_000;

const session = (over: Partial<UpcomingModalSession> = {}): UpcomingModalSession => ({
  id: 's1',
  title: 'Grad school strategy',
  at: Date.now() + 60 * MIN,
  when: 'Fri, Aug 28, 3:00 PM',
  durationMinutes: 60,
  location: 'Online · WisdomLinked Room',
  with: 'Dr. Rivera',
  ...over,
});

const renderBooked = (s: UpcomingModalSession, props: Record<string, unknown> = {}) =>
  render(
    <UpcomingSessionModal
      kind="oneToOne"
      status="booked"
      onClose={vi.fn()}
      sessions={[s]}
      {...props}
    />,
  );

const row = () => document.querySelector('[data-ended]') as HTMLElement | null;

describe('past sessions', () => {
  it('greys out a session that has ended and drops its Join button', () => {
    renderBooked(
      session({ at: Date.now() - 180 * MIN, durationMinutes: 60 }),
      { onJoinSession: vi.fn() },
    );

    expect(screen.getByText('Ended')).toBeInTheDocument();
    expect(row()).toHaveClass('opacity-60');
    expect(screen.queryByRole('button', { name: /Join/ })).not.toBeInTheDocument();
  });

  it('keeps a session that is under way joinable and not greyed', () => {
    renderBooked(
      session({ at: Date.now() - 10 * MIN, durationMinutes: 60 }),
      { onJoinSession: vi.fn() },
    );

    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(row()).toBeNull();
    expect(screen.getByRole('button', { name: /Join/ })).toBeInTheDocument();
  });

  it('counts down to a session that has not started', () => {
    renderBooked(session(), { onJoinSession: vi.fn() });

    expect(screen.getByText('Starts in')).toBeInTheDocument();
    expect(screen.queryByText('Ended')).not.toBeInTheDocument();
    expect(row()).toBeNull();
  });

  it('uses an explicit end time over the duration', () => {
    renderBooked(
      session({
        at: Date.now() - 30 * MIN,
        durationMinutes: 15,
        endsAt: Date.now() + 30 * MIN,
      }),
      { onJoinSession: vi.fn() },
    );

    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('takes the Pay and Decline actions away from an expired offer', () => {
    render(
      <UpcomingSessionModal
        kind="oneToOne"
        status="pending"
        onClose={vi.fn()}
        onPay={vi.fn()}
        onDeclineProposal={vi.fn()}
        sessions={[
          session({ at: Date.now() - 180 * MIN, durationMinutes: 60, payable: true, canDecline: true }),
        ]}
      />,
    );

    expect(screen.getByText('Ended')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pay/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
  });
});
