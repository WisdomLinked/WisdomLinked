import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UpcomingSessionModal, { type UpcomingModalSession } from './UpcomingSessionModal';

const session = (over: Partial<UpcomingModalSession> = {}): UpcomingModalSession => ({
  id: 's1',
  title: 'Grad school strategy',
  at: Date.now() + 60 * 60 * 1000,
  when: 'Fri, 3:00 PM',
  location: 'Online · WisdomLinked Room',
  with: 'Dr. Rivera',
  ...over,
});

describe('UpcomingSessionModal duration', () => {
  it('shows the length of a booked 1:1', () => {
    render(
      <UpcomingSessionModal
        kind="oneToOne"
        status="booked"
        onClose={vi.fn()}
        sessions={[session({ durationMinutes: 45 })]}
      />,
    );

    expect(screen.getByText('45 min')).toBeInTheDocument();
  });

  it('shows the length of a pending 1:1', () => {
    render(
      <UpcomingSessionModal
        kind="oneToOne"
        status="pending"
        onClose={vi.fn()}
        sessions={[session({ durationMinutes: 90 })]}
      />,
    );

    expect(screen.getByText('1 hr 30 min')).toBeInTheDocument();
  });

  it('omits the line when the session has no duration', () => {
    const { container } = render(
      <UpcomingSessionModal
        kind="oneToOne"
        status="booked"
        onClose={vi.fn()}
        sessions={[session()]}
      />,
    );

    expect(container.textContent).not.toMatch(/\bmin\b/);
    expect(container.textContent).not.toMatch(/\bhr\b/);
  });
});
