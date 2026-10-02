import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UpcomingSessionModal, { type UpcomingModalSession } from './UpcomingSessionModal';

const request = (over: Partial<UpcomingModalSession> = {}): UpcomingModalSession => ({
  id: 'req-1',
  title: 'TESTMEETING1',
  at: Date.now() + 21 * 3600_000,
  when: 'Fri, Sep 18, 1:00 PM',
  location: 'Online · WisdomLinked Room',
  with: 'purnavasanth02@gmail.com',
  canCancel: true,
  ...over,
});

const renderModal = (
  session: UpcomingModalSession,
  props: Record<string, unknown> = {},
) =>
  render(
    <UpcomingSessionModal
      kind="oneToOne"
      status="pending"
      onClose={vi.fn()}
      sessions={[session]}
      {...props}
    />,
  );

const cancelButton = () => screen.getByRole('button', { name: 'Cancel this request' });

describe('student cancelling their own pending request', () => {
  it('offers Cancel beside the Pending chip', () => {
    renderModal(request(), { onCancelRequest: vi.fn() });

    expect(cancelButton()).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('puts Cancel before the Pending chip, not after it', () => {
    renderModal(request(), { onCancelRequest: vi.fn() });

    // Vasanth asked for the control to sit to the left of the status chip.
    const position = cancelButton().compareDocumentPosition(screen.getByText('Pending'));
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('asks to confirm before cancelling, then reports it back', async () => {
    const onCancelRequest = vi.fn().mockResolvedValue(true);
    renderModal(request(), { onCancelRequest });

    fireEvent.click(cancelButton());
    expect(onCancelRequest).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancel' }));

    await waitFor(() => expect(onCancelRequest).toHaveBeenCalledTimes(1));
    expect(onCancelRequest.mock.calls[0][0].id).toBe('req-1');
    expect(await screen.findByText(/has been cancelled/)).toBeInTheDocument();
  });

  it('keeps the request when the confirmation is backed out of', () => {
    const onCancelRequest = vi.fn();
    renderModal(request(), { onCancelRequest });

    fireEvent.click(cancelButton());
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));

    expect(onCancelRequest).not.toHaveBeenCalled();
    expect(cancelButton()).toBeInTheDocument();
  });

  it('never asks the student for a note', () => {
    renderModal(request(), { onCancelRequest: vi.fn() });
    fireEvent.click(cancelButton());
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('does not claim success when the request is gone but the notice text is checked', async () => {
    const onCancelRequest = vi.fn().mockResolvedValue(true);
    renderModal(request(), { onCancelRequest });

    fireEvent.click(cancelButton());
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancel' }));

    // A captured hold is refunded rather than never charged, so the notice must not
    // promise either outcome.
    const notice = await screen.findByText(/has been cancelled/);
    expect(notice.textContent).not.toMatch(/not charged|refunded/i);
  });

  it('leaves the row alone when the cancel does not go through', async () => {
    const onCancelRequest = vi.fn().mockResolvedValue(false);
    renderModal(request(), { onCancelRequest });

    fireEvent.click(cancelButton());
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancel' }));

    await waitFor(() => expect(onCancelRequest).toHaveBeenCalled());
    expect(screen.queryByText(/has been cancelled/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm cancel' })).toBeInTheDocument();
  });
});

describe('who does not get a Cancel button', () => {
  it('withholds it from an expert-proposed offer the student can only decline', () => {
    renderModal(request({ canCancel: false, payable: true, canDecline: true, price: 60 }), {
      onPay: vi.fn(),
      onDeclineProposal: vi.fn(),
      onCancelRequest: vi.fn(),
    });

    expect(screen.queryByRole('button', { name: 'Cancel this request' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('withholds it from the expert looking at the same pending list', () => {
    render(
      <UpcomingSessionModal
        kind="oneToOne"
        status="pending"
        role="expert"
        onClose={vi.fn()}
        sessions={[request({ canCancel: false, pendingState: 'accepted_awaiting_payment' })]}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Cancel this request' })).not.toBeInTheDocument();
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
  });

  it('withholds it when no handler is wired, even if the row says it can cancel', () => {
    renderModal(request());

    expect(screen.queryByRole('button', { name: 'Cancel this request' })).not.toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('withholds it once the session time has passed', () => {
    renderModal(request({ at: Date.now() - 3600_000, endsAt: Date.now() - 1800_000 }), {
      onCancelRequest: vi.fn(),
    });

    expect(screen.queryByRole('button', { name: 'Cancel this request' })).not.toBeInTheDocument();
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });
});
