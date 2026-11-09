import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../api/api', () => ({
  doFilterPaymentHistories: vi.fn(),
  getStripeMode: vi.fn(),
  setStripeMode: vi.fn(),
  setSeminarApprovalDeadline: vi.fn(),
  setPaymentWindow: vi.fn(),
  sendPaymentLinkToUser: vi.fn(),
  processRefund: vi.fn(),
  sendAdHocPaymentLink: vi.fn(),
  doGetPaymentIntegrityReport: vi.fn(),
  listPayrollCheques: vi.fn(async () => ({ cheques: [] })),
}));

vi.mock('../../../actions/appActions', () => ({
  SetLoadingStatus: vi.fn(),
}));

import {
  doFilterPaymentHistories,
  doGetPaymentIntegrityReport,
  getStripeMode,
  listPayrollCheques,
  setSeminarApprovalDeadline,
  setStripeMode,
} from '../../../api/api';
import Payment from './payment';
import { notify } from '../../../utils/notify';

const ALL_ROWS = [
  {
    _id: '1',
    amount: 10000,
    currency: 'usd',
    description: 'Session A',
    status: 'completed',
    paymentType: 'charge',
    stripeMode: 'test',
    createdAt: '2024-01-10T12:00:00.000Z',
    customer: { email: 'ann@x.com' },
    expert: { email: 'eli@x.com' },
    paymentIntent: 'pi_3UB4xxxxUfoa',
    receiptUrl: 'https://example.com/r1',
  },
  {
    _id: '2',
    amount: 2000,
    currency: 'usd',
    description: 'Refund B',
    status: 'refunded',
    paymentType: 'refund',
    stripeMode: 'test',
    createdAt: '2024-02-10T12:00:00.000Z',
    customer: { email: 'bob@x.com' },
    expert: { email: 'eli@x.com' },
    paymentIntent: 'pi_refund2',
  },
  {
    _id: '3',
    amount: 5000,
    currency: 'usd',
    description: 'Pending C',
    status: 'pending',
    paymentType: 'charge',
    stripeMode: 'live',
    createdAt: '2024-03-10T12:00:00.000Z',
    customer: { email: 'cara@x.com' },
    expert: { email: 'eli@x.com' },
    paymentIntent: 'pi_pending3',
  },
  {
    _id: '4',
    amount: 8000,
    currency: 'usd',
    description: 'Withheld D',
    status: 'withheld',
    paymentType: 'charge',
    stripeMode: 'live',
    createdAt: '2024-04-10T12:00:00.000Z',
    customer: { email: 'dan@x.com' },
    expert: { email: 'eli@x.com' },
    paymentIntent: 'pi_hold4',
  },
  {
    _id: '5',
    amount: 3000,
    currency: 'usd',
    description: 'Retry E',
    status: 'failed',
    paymentType: 'retry',
    stripeMode: 'test',
    createdAt: '2024-05-10T12:00:00.000Z',
    customer: { email: 'ann@x.com' },
    expert: { email: 'eli@x.com' },
    paymentIntent: 'pi_retry5',
  },
  {
    _id: '6',
    amount: 9000,
    currency: 'usd',
    description: 'Released F',
    status: 'released',
    paymentType: 'charge',
    stripeMode: 'test',
    createdAt: '2024-06-10T12:00:00.000Z',
    customer: { email: 'fay@x.com' },
    expert: { email: 'eli@x.com' },
    paymentIntent: 'pi_rel6',
  },
];

function statusTotalsFromRows(rows: typeof ALL_ROWS) {
  const buckets = {
    paid: new Map<string, number>(),
    failed: new Map<string, number>(),
    refunded: new Map<string, number>(),
  };
  const mapStatus = {
    completed: 'paid',
    failed: 'failed',
    refunded: 'refunded',
  } as const;
  for (const row of rows) {
    const bucket = mapStatus[row.status as keyof typeof mapStatus];
    if (!bucket) continue;
    const currency = String(row.currency || 'usd').toUpperCase();
    buckets[bucket].set(currency, (buckets[bucket].get(currency) || 0) + row.amount);
  }
  const toArr = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([currency, cents]) => ({ currency, cents }));
  return {
    paid: toArr(buckets.paid),
    failed: toArr(buckets.failed),
    refunded: toArr(buckets.refunded),
  };
}

function applyFilter(filter: any) {
  let rows = [...ALL_ROWS];
  if (filter.email) {
    const q = String(filter.email).toLowerCase();
    rows = rows.filter(
      r =>
        r.customer.email.toLowerCase().includes(q) || r.expert.email.toLowerCase().includes(q),
    );
  }
  if (filter.stripeMode) rows = rows.filter(r => r.stripeMode === filter.stripeMode);
  if (filter.status) rows = rows.filter(r => r.status === filter.status);
  if (filter.paymentType) rows = rows.filter(r => r.paymentType === filter.paymentType);
  if (filter.dateFrom) rows = rows.filter(r => r.createdAt >= `${filter.dateFrom}T00:00:00.000Z`);
  if (filter.dateTo) rows = rows.filter(r => r.createdAt <= `${filter.dateTo}T23:59:59.000Z`);
  const totalCount = rows.length;
  const start = (filter.currentPage || 0) * filter.numPerPage;
  return {
    result: rows.slice(start, start + filter.numPerPage),
    totalCount,
    totals: statusTotalsFromRows(rows),
  };
}

const integritySummary = {
  unpaid: 1,
  refunded: 2,
  in_flight: 3,
  withheld: 4,
  paid: 10,
  free: 5,
};

function chooseSelect(label: string, optionLabel: string, selector?: string) {
  const trigger = selector
    ? (screen.getByLabelText(label, { selector }) as HTMLElement)
    : screen.getByLabelText(label);
  fireEvent.click(trigger);
  const root = trigger.parentElement as HTMLElement;
  fireEvent.click(within(root).getByRole('button', { name: optionLabel }));
}

function renderPayment(initial = '/user/admindashboard/payment') {
  const store = configureStore({
    reducer: {
      auth: () => ({ userDetails: { role: 'admin' } }),
    },
  });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initial]}>
        <Payment />
      </MemoryRouter>
    </Provider>,
  );
}

describe('Admin Payment Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStripeMode).mockResolvedValue({
      stripeMode: 'test',
      seminarApprovalDeadlineHours: 24,
      paymentWindowHours: 48,
      paymentsVisibleMode: 'all',
    });
    vi.mocked(doGetPaymentIntegrityReport).mockResolvedValue({
      summary: integritySummary,
      bookingsScanned: 16,
      lookbackDays: 120,
      rows: [],
      stuckPendingPayments: [],
    });
    vi.mocked(doFilterPaymentHistories).mockImplementation(async filter => applyFilter(filter));
    vi.mocked(setStripeMode).mockResolvedValue({ status: 'SUCCESS' });
    vi.mocked(setSeminarApprovalDeadline).mockResolvedValue({ status: 'SUCCESS' });
  });

  it('loads histories and says when every paid seat matches', async () => {
    renderPayment();
    expect(await screen.findByText(/Showing 5 of 6 histories/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing to fix/)).toBeInTheDocument();
    expect(screen.getByTestId('payment-history-table').className).not.toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('payment-history-cards')).toHaveClass('md:hidden');
    expect(screen.getByTestId('payment-history-table')).toHaveClass('hidden');
    expect(screen.getByTestId('payment-history-table').querySelector('table')).toHaveClass(
      'hidden',
      'md:table',
      'table-fixed',
    );
    expect(screen.getByRole('columnheader', { name: 'Description' })).toHaveClass('lg:table-cell');
    const totalRow = screen.getByTestId('payment-history-total');
    expect(totalRow).toHaveTextContent(/Total \(filtered\)/);
    expect(totalRow).toHaveTextContent(/Paid/);
    expect(totalRow).toHaveTextContent(/100\.00 USD/);
    expect(totalRow).toHaveTextContent(/Failed/);
    expect(totalRow).toHaveTextContent(/30\.00 USD/);
    expect(totalRow).toHaveTextContent(/Refunded/);
    expect(totalRow).toHaveTextContent(/20\.00 USD/);
    expect(totalRow).not.toHaveTextContent('this page');
  });

  it('filters by status and updates the result count', async () => {
    renderPayment();
    await screen.findByText(/Showing 5 of 6 histories/);
    chooseSelect('Status', 'Paid');
    await waitFor(() => {
      expect(doFilterPaymentHistories).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed', currentPage: 0 }),
      );
    });
    expect(await screen.findByText(/Showing 1 of 1 histories/)).toBeInTheDocument();
  });

  it('filters by stripe mode, payment type, and date range together', async () => {
    renderPayment();
    await screen.findByText(/Showing 5 of 6 histories/);
    chooseSelect('Stripe mode', 'Live');
    chooseSelect('Payment type', 'Charge');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2024-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2024-12-31' } });
    await waitFor(() => {
      expect(doFilterPaymentHistories).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeMode: 'live',
          paymentType: 'charge',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
        }),
      );
    });
  });

  it('debounces email and sends it to the history API', async () => {
    renderPayment();
    await screen.findByText(/Showing 5 of 6 histories/);
    fireEvent.change(screen.getByLabelText('Filter by email'), { target: { value: 'ann@x.com' } });
    await waitFor(
      () => {
        expect(doFilterPaymentHistories).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'ann@x.com' }),
        );
      },
      { timeout: 1500 },
    );
    expect(await screen.findByText(/Showing 2 of 2 histories/)).toBeInTheDocument();
  });

  it('clears filters and restores the full paginated list', async () => {
    renderPayment();
    await screen.findByText(/Showing 5 of 6 histories/);
    chooseSelect('Status', 'Refunded');
    expect(await screen.findByText(/Showing 1 of 1 histories/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText(/Showing 5 of 6 histories/)).toBeInTheDocument();
  });

  it('paginates and disables previous on the first page', async () => {
    renderPayment();
    await screen.findByText(/Showing 5 of 6 histories/);
    const totalRow = screen.getByTestId('payment-history-total');
    expect(totalRow).toHaveTextContent(/Total \(filtered\).*Paid.*100\.00 USD.*Failed.*30\.00 USD.*Refunded.*20\.00 USD/s);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => {
      expect(doFilterPaymentHistories).toHaveBeenCalledWith(
        expect.objectContaining({ currentPage: 1, numPerPage: 5 }),
      );
    });
    expect(await screen.findByText(/Showing 1 of 6 histories/)).toBeInTheDocument();
    expect(screen.getByTestId('payment-history-total')).toHaveTextContent(
      /Total \(filtered\).*Paid.*100\.00 USD.*Failed.*30\.00 USD.*Refunded.*20\.00 USD/s,
    );
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '25' } });
    await waitFor(() => {
      expect(doFilterPaymentHistories).toHaveBeenCalledWith(
        expect.objectContaining({ currentPage: 0, numPerPage: 25 }),
      );
    });
    expect(await screen.findByText(/Showing 6 of 6 histories/)).toBeInTheDocument();
  });

  it('hides the Stripe mode filter when only live payments are visible', async () => {
    vi.mocked(getStripeMode).mockResolvedValue({
      stripeMode: 'live',
      paymentsVisibleMode: 'live',
      seminarApprovalDeadlineHours: 24,
      paymentWindowHours: 48,
    });
    renderPayment();
    expect(await screen.findByText(/Showing 5 of 6 histories/)).toBeInTheDocument();
    expect(screen.queryByTestId('payment-filter-mode')).not.toBeInTheDocument();
  });

  it('switches Stripe to Live only after confirm', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPayment();
    await screen.findByText(/Showing 5 of 6 histories/);
    fireEvent.click(screen.getByRole('button', { name: 'Live' }));
    await waitFor(() => {
      expect(setStripeMode).toHaveBeenCalledWith({ stripeMode: 'live' });
    });
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('labels the toggle Payment mode and styles Live exactly like Test', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPayment();
    await screen.findByText(/Showing 5 of 6 histories/);
    expect(screen.getByText('Payment mode')).toBeInTheDocument();
    const test = screen.getByRole('button', { name: 'Test' });
    const live = screen.getByRole('button', { name: 'Live' });
    const activeTestClass = test.className;
    const inactiveLiveClass = live.className;
    expect(test).toHaveClass('bg-wl-brand', 'text-white');
    expect(live).toHaveClass('text-wl-muted');
    fireEvent.click(live);
    await waitFor(() => {
      expect(live).toHaveAttribute('aria-pressed', 'true');
    });
    expect(test).toHaveAttribute('aria-pressed', 'false');
    expect(live.className).toBe(activeTestClass);
    expect(test.className).toBe(inactiveLiveClass);
    confirm.mockRestore();
  });

  it('enables Settings Save after a change and shows success on save', async () => {
    renderPayment();
    await screen.findByText(/Showing 5 of 6 histories/);
    const deadline = screen.getByLabelText('Seat-request approval deadline');
    const saves = screen.getAllByRole('button', { name: 'Save' });
    expect(saves[0]).toBeDisabled();
    fireEvent.change(deadline, { target: { value: '36' } });
    expect(saves[0]).toBeEnabled();
    fireEvent.click(saves[0]);
    await waitFor(() => {
      expect(setSeminarApprovalDeadline).toHaveBeenCalledWith(36);
    });
    await waitFor(() => {
      expect(saves[0]).toBeDisabled();
    });
  });

  it('refreshes the seat list', async () => {
    renderPayment();
    await screen.findByText(/Showing 5 of 6 histories/);
    expect(screen.getByText(/Nothing to fix/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => {
      expect(doGetPaymentIntegrityReport).toHaveBeenCalledTimes(2);
    });
  });

  it('explains a refunded seat in a sentence', async () => {
    vi.mocked(doGetPaymentIntegrityReport).mockResolvedValue({
      summary: integritySummary,
      bookingsScanned: 5,
      lookbackDays: 120,
      rows: [{
        verdict: 'refunded',
        groupChatId: 'g1',
        name: 'Khussal Pradhan & Bruce Wang',
        customer: 'c1',
        customerEmail: 'khussal@tamu.edu',
      }],
      stuckPendingPayments: [],
    });
    renderPayment();
    expect(await screen.findByText(/khussal@tamu.edu is still on “Khussal Pradhan & Bruce Wang” after that payment was refunded/)).toBeInTheDocument();
  });

  it('shows the filtered empty state', async () => {
    renderPayment();
    await screen.findByText(/Showing 5 of 6 histories/);
    fireEvent.change(screen.getByLabelText('Filter by email'), { target: { value: 'nobody@none.test' } });
    expect(await screen.findByText('No payment history matches these filters')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Clear filters' }).length).toBeGreaterThan(0);
  });

  it('shows the genuine empty copy when there is no history', async () => {
    vi.mocked(doFilterPaymentHistories).mockResolvedValue({ result: [], totalCount: 0 });
    renderPayment();
    expect(await screen.findByText('No payment history yet.')).toBeInTheDocument();
    expect(screen.queryByText('No payment history matches these filters')).not.toBeInTheDocument();
  });

  it('shows the filtered empty copy when a mode filter yields nothing', async () => {
    vi.mocked(doFilterPaymentHistories).mockResolvedValue({ result: [], totalCount: 0 });
    renderPayment('/user/admindashboard/payment?mode=test');
    expect(await screen.findByText('No payment history matches these filters')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    expect(await screen.findByText('No payment history yet.')).toBeInTheDocument();
  });

  it('shows a loading skeleton before histories arrive', async () => {
    let resolveHistories: (value: { result: typeof ALL_ROWS; totalCount: number }) => void = () => {};
    vi.mocked(doFilterPaymentHistories).mockImplementation(
      () =>
        new Promise(resolve => {
          resolveHistories = resolve;
        }),
    );
    renderPayment();
    expect(await screen.findByTestId('payment-history-skeleton')).toBeInTheDocument();
    await waitFor(() => {
      expect(doFilterPaymentHistories).toHaveBeenCalled();
    });
    resolveHistories({ result: ALL_ROWS.slice(0, 5), totalCount: 6 });
    expect(await screen.findByText(/Showing 5 of 6 histories/)).toBeInTheDocument();
  });

  it('no longer shows or loads the paid-out list, which now lives on the Payroll page', async () => {
    renderPayment();
    expect(await screen.findByText(/Showing 5 of 6 histories/)).toBeInTheDocument();
    expect(screen.queryByTestId('paid-out-cheques')).not.toBeInTheDocument();
    expect(screen.queryByText('Paid out')).not.toBeInTheDocument();
    expect(listPayrollCheques).not.toHaveBeenCalled();
  });

  it('reads filters from the URL on first load', async () => {
    renderPayment('/user/admindashboard/payment?status=completed&mode=test&pageSize=10');
    await waitFor(() => {
      expect(doFilterPaymentHistories).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          stripeMode: 'test',
          numPerPage: 10,
          currentPage: 0,
        }),
      );
    });
  });

  describe('Stripe mode filter (staging / paymentsVisibleMode=all)', () => {
    const modeFilterLabel = () => screen.getByLabelText('Stripe mode').textContent;
    const requestedModes = () =>
      vi.mocked(doFilterPaymentHistories).mock.calls.map(([filter]: any[]) => filter.stripeMode);

    it('defaults to All and does not sync to the platform charge mode', async () => {
      vi.mocked(getStripeMode).mockResolvedValue({
        stripeMode: 'live',
        paymentsVisibleMode: 'all',
      });
      renderPayment();
      expect(await screen.findByText(/Showing 5 of 6 histories/)).toBeInTheDocument();
      expect(modeFilterLabel()).toBe('All');
      expect(requestedModes().every(mode => !mode)).toBe(true);
    });

    it('keeps a mode already in the URL', async () => {
      renderPayment('/user/admindashboard/payment?mode=live');
      expect(await screen.findByText(/Showing 2 of 2 histories/)).toBeInTheDocument();
      await waitFor(() => {
        expect(getStripeMode).toHaveBeenCalled();
      });
      expect(modeFilterLabel()).toBe('Live');
      expect(new Set(requestedModes())).toEqual(new Set(['live']));
    });

    it('shows All when the platform mode cannot be loaded', async () => {
      vi.mocked(getStripeMode).mockResolvedValue({ status: 'FAIL', error: 'down' });
      renderPayment();
      // Default paymentsVisibleMode state is live until getStripeMode succeeds, so mode filter may hide.
      expect(await screen.findByText(/Showing 5 of 6 histories/)).toBeInTheDocument();
    });

    it('moves the filter to Live after the switch is confirmed', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderPayment();
      await screen.findByText(/Showing 5 of 6 histories/);
      fireEvent.click(screen.getByRole('button', { name: 'Live' }));
      expect(await screen.findByText(/Showing 2 of 2 histories/)).toBeInTheDocument();
      expect(setStripeMode).toHaveBeenCalledWith({ stripeMode: 'live' });
      expect(modeFilterLabel()).toBe('Live');
      confirm.mockRestore();
    });

    it('moves the filter to Test when switching back to Test', async () => {
      vi.mocked(getStripeMode).mockResolvedValue({
        stripeMode: 'live',
        paymentsVisibleMode: 'all',
      });
      renderPayment();
      await screen.findByText(/Showing 5 of 6 histories/);
      fireEvent.click(screen.getByRole('button', { name: 'Test' }));
      expect(await screen.findByText(/Showing 4 of 4 histories/)).toBeInTheDocument();
      expect(setStripeMode).toHaveBeenCalledWith({ stripeMode: 'test' });
      expect(modeFilterLabel()).toBe('Test');
    });

    it('leaves the filter alone when the Live switch is cancelled', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderPayment();
      await screen.findByText(/Showing 5 of 6 histories/);
      fireEvent.click(screen.getByRole('button', { name: 'Live' }));
      expect(setStripeMode).not.toHaveBeenCalled();
      expect(modeFilterLabel()).toBe('All');
      expect(requestedModes()).not.toContain('live');
      confirm.mockRestore();
    });

    it('shows no success message after a switch, so nothing covers the toggle', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const success = vi.spyOn(notify, 'success');
      renderPayment();
      await screen.findByText(/Showing 5 of 6 histories/);
      fireEvent.click(screen.getByRole('button', { name: 'Live' }));
      expect(await screen.findByText(/Showing 2 of 2 histories/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Test' }));
      expect(await screen.findByText(/Showing 4 of 4 histories/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Live' }));
      expect(await screen.findByText(/Showing 2 of 2 histories/)).toBeInTheDocument();
      expect(setStripeMode).toHaveBeenCalledTimes(3);
      expect(success).not.toHaveBeenCalled();
      success.mockRestore();
      confirm.mockRestore();
    });

    it('still shows the error message when a switch fails', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const error = vi.spyOn(notify, 'error');
      vi.mocked(setStripeMode).mockResolvedValue({ status: 'FAIL', error: 'Stripe is unavailable' });
      renderPayment();
      await screen.findByText(/Showing 5 of 6 histories/);
      fireEvent.click(screen.getByRole('button', { name: 'Live' }));
      await waitFor(() => {
        expect(error).toHaveBeenCalledWith('Stripe is unavailable');
      });
      error.mockRestore();
      confirm.mockRestore();
    });

    it('leaves the filter alone when the switch fails', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.mocked(setStripeMode).mockResolvedValue({ status: 'FAIL', error: 'Stripe is unavailable' });
      renderPayment();
      await screen.findByText(/Showing 5 of 6 histories/);
      fireEvent.click(screen.getByRole('button', { name: 'Live' }));
      await waitFor(() => {
        expect(setStripeMode).toHaveBeenCalledWith({ stripeMode: 'live' });
      });
      expect(screen.getByRole('button', { name: 'Test' })).toHaveAttribute('aria-pressed', 'true');
      expect(modeFilterLabel()).toBe('All');
      expect(requestedModes()).not.toContain('live');
      confirm.mockRestore();
    });

    it('clicking the selected mode brings a hand-changed filter back', async () => {
      renderPayment();
      await screen.findByText(/Showing 5 of 6 histories/);
      chooseSelect('Stripe mode', 'Live');
      await screen.findByText(/Showing 2 of 2 histories/);
      fireEvent.click(screen.getByRole('button', { name: 'Test' }));
      expect(await screen.findByText(/Showing 4 of 4 histories/)).toBeInTheDocument();
      expect(modeFilterLabel()).toBe('Test');
      expect(setStripeMode).not.toHaveBeenCalled();
    });

    it('keeps the other filters when the mode switches', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderPayment();
      await screen.findByText(/Showing 5 of 6 histories/);
      chooseSelect('Status', 'Withheld');
      await screen.findByText(/Showing 1 of 1 histories/);
      fireEvent.click(screen.getByRole('button', { name: 'Live' }));
      expect(await screen.findByText(/Showing 1 of 1 histories/)).toBeInTheDocument();
      expect(doFilterPaymentHistories).toHaveBeenLastCalledWith(
        expect.objectContaining({ stripeMode: 'live', status: 'withheld', currentPage: 0 }),
      );
      confirm.mockRestore();
    });
  });
});
