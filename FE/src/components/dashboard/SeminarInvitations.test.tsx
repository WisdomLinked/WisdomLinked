import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SeminarInvitations from './SeminarInvitations';
import * as api from '../../api/api';
import { completeStudentBookingFromStorage } from './StudentBookingCheckout';
vi.mock('react-redux', () => ({ useDispatch: () => dispatch }));
const dispatch = vi.fn();
vi.mock('../../actions/authActions', () => ({ updateMe: () => ({ type: 'refresh' }) }));
vi.mock('../../api/api', () => ({ getMySeatRequests: vi.fn(), paySeminarSeatRequest: vi.fn() }));
vi.mock('./StudentBookingCheckout', () => ({
  completeStudentBookingFromStorage: vi.fn(),
  default: (p: any) => <div data-testid="checkout" data-request={p.pendingDetails.requestId} data-price={p.price} data-wallet={p.walletOption.kind} data-return={p.returnUrl} data-policy={p.policyNotice?.acknowledgeLabel}>
    <button onClick={() => p.onPaymentSuccess('pi_test')}>Complete payment</button><button onClick={p.onCancel}>Back</button>
  </div>,
}));
const invitation = { _id: 'request', origin: 'host', status: 'awaiting_payment', amount: 4900, currency: 'usd',
  paymentDeadline: '2099-01-01T00:00:00Z', groupChat: { _id: 'seminar', name: 'Research seminar', admin: { username: 'Dr Wang' } } };
describe('expert receiving a paid seminar invitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/user/expertdashboard');
    vi.mocked(api.getMySeatRequests).mockResolvedValue({ result: [invitation] });
    vi.mocked(api.paySeminarSeatRequest).mockResolvedValue({ result: {} });
  });
  it('shows incoming invitations and pays the snapshotted price using existing checkout', async () => {
    render(<SeminarInvitations userId="expert" />);
    fireEvent.click(await screen.findByRole('button', { name: /Accept and pay/ }));
    const checkout = screen.getByTestId('checkout');
    expect(checkout).toHaveAttribute('data-price', '49');
    expect(checkout).toHaveAttribute('data-request', 'request');
    expect(checkout).toHaveAttribute('data-wallet', 'charge');
    expect(checkout).toHaveAttribute('data-policy', 'I understand this payment is non-refundable.');
    expect(checkout.getAttribute('data-return')).toContain('seminar_invitation=1');
    fireEvent.click(screen.getByText('Complete payment'));
    await screen.findByText('Your seminar seat is confirmed.');
    expect(api.paySeminarSeatRequest).toHaveBeenCalledWith({ requestId: 'request', payment_intent: 'pi_test' });
    expect(screen.queryByRole('button', { name: /Accept and pay/ })).not.toBeInTheDocument();
  });
  it('does not show expired, completed, or student-origin seat requests as invitations', async () => {
    vi.mocked(api.getMySeatRequests).mockResolvedValue({ result: [
      { ...invitation, paymentDeadline: '2000-01-01' }, { ...invitation, status: 'completed' }, { ...invitation, origin: 'student' },
    ] });
    render(<SeminarInvitations userId="expert" />);
    await waitFor(() => expect(api.getMySeatRequests).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Accept and pay/ })).not.toBeInTheDocument();
  });
  it('keeps the invitation available after an unsuccessful payment confirmation', async () => {
    vi.mocked(api.paySeminarSeatRequest).mockResolvedValue(false);
    render(<SeminarInvitations userId="expert" />);
    fireEvent.click(await screen.findByRole('button', { name: /Accept and pay/ }));
    fireEvent.click(screen.getByText('Complete payment'));
    await screen.findAllByText(/Could not confirm your seminar seat/);
    expect(screen.getByTestId('checkout')).toBeInTheDocument();
  });
  it('can leave checkout without making a payment', async () => {
    render(<SeminarInvitations userId="expert" />);
    fireEvent.click(await screen.findByRole('button', { name: /Accept and pay/ }));
    fireEvent.click(screen.getByText('Back'));
    expect(api.paySeminarSeatRequest).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('checkout')).not.toBeInTheDocument());
  });
  it.each(['succeeded', 'pending'])('recovers a %s payment redirect using the shared completion flow', async status => {
    localStorage.setItem('pendingDetails', JSON.stringify({ kind: 'pay-seat-request', requestId: 'request' }));
    window.history.replaceState({}, '', `?seminar_invitation=1&payment_intent=pi_test&redirect_status=${status}`);
    vi.mocked(completeStudentBookingFromStorage).mockResolvedValue({ ok: true, kind: 'seminar', userDetails: {} });
    render(<SeminarInvitations userId="expert" />);
    await screen.findByText('Your seminar seat is confirmed.');
    expect(completeStudentBookingFromStorage).toHaveBeenCalledWith('pi_test');
    await waitFor(() => expect(window.location.search).toBe(''));
  });
  it('preserves redirect details when confirmation fails so refresh can retry', async () => {
    localStorage.setItem('pendingDetails', JSON.stringify({ kind: 'pay-seat-request', requestId: 'request' }));
    window.history.replaceState({}, '', '?seminar_invitation=1&payment_intent=pi_test&redirect_status=succeeded');
    vi.mocked(completeStudentBookingFromStorage).mockResolvedValue({ ok: false, error: 'Try later', retryable: true });
    render(<SeminarInvitations userId="expert" />);
    await screen.findByText(/Refresh this page to retry/);
    expect(window.location.search).toContain('payment_intent=pi_test');
    expect(localStorage.getItem('pendingDetails')).not.toBeNull();
  });
});
