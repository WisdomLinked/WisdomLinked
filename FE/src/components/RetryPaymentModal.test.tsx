import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RetryPaymentModal from './RetryPaymentModal';
import RefundPaymentModal from './RefundPaymentModal';

const paymentItem = {
  amount: 5000,
  currency: 'usd',
  description: 'Session',
  customer: { email: 'ann@x.com' },
  paymentIntent: 'pi_1',
};

describe('admin payment action dialogs', () => {
  it('renders the retry modal on a light surface with readable fields', () => {
    render(
      <RetryPaymentModal
        paymentItem={paymentItem}
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Customize Retry Payment' });
    expect(dialog.className).toContain('bg-white');
    expect(screen.getByLabelText('Amount ($)')).toHaveClass('bg-white', 'text-slate-900');
    expect(screen.getByLabelText('Customer Email')).toHaveClass('bg-slate-100', 'cursor-not-allowed');
    expect(screen.getByRole('button', { name: 'Send Payment Link' })).toHaveClass('bg-wl-brand', 'text-white');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('bg-white', 'text-slate-800');
  });

  it('applies the same light dialog chrome to the refund modal', () => {
    render(
      <RefundPaymentModal
        paymentItem={paymentItem}
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Process Refund' });
    expect(dialog.className).toContain('bg-white');
    expect(screen.getByLabelText('Refund Amount ($)')).toHaveClass('bg-white', 'text-slate-900');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('bg-white');
    expect(screen.getByRole('button', { name: 'Process Refund' })).toHaveClass('bg-red', 'text-white');
  });
});
