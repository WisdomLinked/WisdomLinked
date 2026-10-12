import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UpcomingSessionModal, { type UpcomingModalSession } from './UpcomingSessionModal';

const BLOCKED = 'You need to complete your profile setup first.';

const request = (id: string, title: string): UpcomingModalSession => ({
  id,
  title,
  at: Date.now() + 48 * 3600_000,
  when: 'Fri, 3:00 PM',
  location: 'Online · WisdomLinked Room',
  with: 'Student',
  canAccept: true,
});

const renderModal = (props: Record<string, unknown>) =>
  render(
    <UpcomingSessionModal
      kind="oneToOne"
      status="pending"
      role="expert"
      onClose={vi.fn()}
      sessions={[request('r1', 'First request'), request('r2', 'Second request')]}
      onDeclineSession={vi.fn()}
      {...props}
    />,
  );

describe('expert accepting while profile setup is unfinished', () => {
  it('shows the reason in that row only and never accepts', () => {
    const onAcceptSession = vi.fn();
    renderModal({ onAcceptSession, acceptBlockedMessage: BLOCKED });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Accept' })[1]);

    expect(onAcceptSession).not.toHaveBeenCalled();
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(BLOCKED);
    expect(alerts[0]).toHaveClass('text-rose-600');
    // The message sits in the second row: after its title, not before it.
    const secondTitle = screen.getByText('Second request');
    expect(secondTitle.compareDocumentPosition(alerts[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('still lets the expert decline', () => {
    renderModal({ onAcceptSession: vi.fn(), acceptBlockedMessage: BLOCKED });
    expect(screen.getAllByRole('button', { name: 'Decline' })[0]).toBeEnabled();
  });

  it('accepts normally when no block is set', async () => {
    const onAcceptSession = vi.fn().mockResolvedValue(true);
    renderModal({ onAcceptSession });

    fireEvent.click(screen.getAllByRole('button', { name: 'Accept' })[0]);

    await waitFor(() => expect(onAcceptSession).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(BLOCKED)).not.toBeInTheDocument();
  });
});
