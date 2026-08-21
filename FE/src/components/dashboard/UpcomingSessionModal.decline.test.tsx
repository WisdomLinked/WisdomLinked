import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UpcomingSessionModal, { type UpcomingModalSession } from './UpcomingSessionModal';

const offer = (over: Partial<UpcomingModalSession> = {}): UpcomingModalSession => ({
  id: 'offer-1',
  title: 'Grad school strategy',
  at: Date.now() + 48 * 3600_000,
  when: 'Fri, 3:00 PM',
  location: 'Online · WisdomLinked Room',
  with: 'Dr. Rivera',
  payable: true,
  canDecline: true,
  price: 60,
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

describe('student declining an expert offer', () => {
  it('offers Pay and Decline side by side', () => {
    renderModal(offer(), { onPay: vi.fn(), onDeclineProposal: vi.fn() });

    expect(screen.getByRole('button', { name: 'Pay $60' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('asks to confirm before declining, then reports it back', async () => {
    const onDeclineProposal = vi.fn().mockResolvedValue(true);
    renderModal(offer(), { onPay: vi.fn(), onDeclineProposal });

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(onDeclineProposal).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm decline' }));

    await waitFor(() => expect(onDeclineProposal).toHaveBeenCalledTimes(1));
    expect(onDeclineProposal.mock.calls[0][0].id).toBe('offer-1');
    expect(await screen.findByText(/You declined/)).toBeInTheDocument();
  });

  it('passes the student note along to the mentor', async () => {
    const onDeclineProposal = vi.fn().mockResolvedValue(true);
    renderModal(offer(), { onPay: vi.fn(), onDeclineProposal });

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    fireEvent.change(screen.getByLabelText(/Note to the mentor/i), {
      target: { value: 'Found another slot, thanks!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm decline' }));

    await waitFor(() => expect(onDeclineProposal).toHaveBeenCalled());
    expect(onDeclineProposal.mock.calls[0][1]).toBe('Found another slot, thanks!');
  });

  it('still offers Decline once the payment window has closed', () => {
    renderModal(offer({ payable: false, metaLines: ['Payment window closed — this offer is being released'] }), {
      onPay: vi.fn(),
      onDeclineProposal: vi.fn(),
    });

    expect(screen.queryByRole('button', { name: /^Pay/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    expect(screen.getByText(/Payment window closed/)).toBeInTheDocument();
  });

  it('shows the pay-by deadline on the row', () => {
    renderModal(offer({ metaLines: ['Pay by 8/22/2026, 3:00:00 PM'] }), {
      onPay: vi.fn(),
      onDeclineProposal: vi.fn(),
    });

    expect(screen.getByText('Pay by 8/22/2026, 3:00:00 PM')).toBeInTheDocument();
  });
});
