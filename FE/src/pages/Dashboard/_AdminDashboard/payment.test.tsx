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
  doGetAdminPaymentStats: vi.fn(),
  listPayrollCheques: vi.fn(async () => ({ cheques: [] })),
}));

vi.mock('../../../actions/appActions', () => ({
  SetLoadingStatus: vi.fn(),
}));

import {
  doFilterPaymentHistories,
  doGetAdminPaymentStats,
  doGetPaymentIntegrityReport,
  getStripeMode,
  processRefund,
  listPayrollCheques,
  sendPaymentLinkToUser,
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

/** Opens a row (by text on it, e.g. its amount) in the details panel. */
function openRow(text: string) {
  const row = within(screen.getByTestId('payment-history-table')).getAllByRole('row').find(r => (r.textContent || '').includes(text));
  if (!row) throw new Error('no row with ' + text);
  fireEvent.click(row);
}

/** The open details panel (the desktop column; the phone sheet holds the same content). */
const panel = () => screen.getAllByRole('complementary')[0];

/** The count line ("6 payments · all time") and the rows shown on this page. */
async function findShowing(rowsOnPage: number, total: number) {
  const line = new RegExp(`^` + total + ` payments?\\b`);
  await waitFor(() => {
    expect(screen.getByText(line)).toBeInTheDocument();
    const table = screen.getByTestId('payment-history-table');
    expect(within(table).getAllByRole('row').length - 1).toBe(rowsOnPage);
  });
  return screen.getByText(line);
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
    vi.mocked(doGetAdminPaymentStats).mockResolvedValue({
      status: 'SUCCESS',
      data: {
        paymentsCount: 4,
        paymentsAmountByCurrency: { usd: 30000 },
        monthly: [
          { month: '2026-09', count: 3, amountsByCurrency: { usd: 30000 } },
          { month: '2026-10', count: 1, amountsByCurrency: {} },
        ],
      },
    });
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
    expect(await findShowing(5, 6)).toBeInTheDocument();
    expect(screen.getByText(/Nothing to fix/)).toBeInTheDocument();
    expect(screen.getByTestId('payment-history-cards')).toHaveClass('md:hidden');
    expect(screen.getByTestId('payment-history-table')).toHaveClass('hidden', 'md:block');
    const headers = within(screen.getByTestId('payment-history-table')).getAllByRole('columnheader').map(h => h.textContent);
    expect(headers).toEqual(['User', 'Amount', 'Date', 'Type', 'Status']);
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
    await findShowing(5, 6);
    chooseSelect('Status', 'Paid');
    await waitFor(() => {
      expect(doFilterPaymentHistories).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed', currentPage: 0 }),
      );
    });
    expect(await findShowing(1, 1)).toBeInTheDocument();
  });

  it('filters by stripe mode, payment type, and a custom date range together, counting both end days', async () => {
    renderPayment();
    await findShowing(5, 6);
    chooseSelect('Stripe mode', 'Live');
    chooseSelect('Payment type', 'Charge');
    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2024-01-01' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2024-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => {
      expect(doFilterPaymentHistories).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeMode: 'live',
          paymentType: 'charge',
          dateFrom: new Date(2024, 0, 1).toISOString(),
          dateTo: new Date(2025, 0, 1).toISOString(),
        }),
      );
    });
  });

  it('has no From/To boxes any more: the date range control replaces them', async () => {
    renderPayment();
    await findShowing(5, 6);
    expect(screen.queryByLabelText('From')).toBeNull();
    expect(screen.queryByLabelText('To')).toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Date range' })).toBeInTheDocument();
  });

  it('starts on All time and asks for every date, for both the list and the summary', async () => {
    renderPayment();
    await findShowing(5, 6);
    expect(screen.getByRole('radio', { name: 'All time' })).toHaveAttribute('aria-checked', 'true');
    const listCall = vi.mocked(doFilterPaymentHistories).mock.calls.at(-1)?.[0] as any;
    expect(listCall.dateFrom).toBeUndefined();
    expect(listCall.dateTo).toBeUndefined();
    const statsCall = vi.mocked(doGetAdminPaymentStats).mock.calls.at(-1)?.[0] as any;
    expect(statsCall.dateFrom).toBeUndefined();
    expect(statsCall.dateTo).toBeUndefined();
  });

  it('shows Collected, Count and Average from the summary inside Payment History', async () => {
    renderPayment();
    const summary = await screen.findByTestId('payment-summary');
    await within(summary).findByText('Collected');
    const kpi = (label: string) => within(summary).getByText(label).parentElement as HTMLElement;
    expect(kpi('Collected').textContent).toContain('$300');
    expect(kpi('Count').textContent).toContain('4');
    expect(kpi('Count').textContent).toContain('Paid or partly refunded');
    expect(kpi('Average').textContent).toContain('$75.00');
    expect(within(summary).getByText('Payments collected per month')).toBeInTheDocument();
    expect(within(summary).queryByText('No payments in this range')).toBeNull();
    const section = summary.closest('section') as HTMLElement;
    expect(within(section).getByText('Payment History')).toBeInTheDocument();
    expect(summary.compareDocumentPosition(screen.getByTestId('payment-history-table'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('changing the range reloads the list and the summary with the same dates, from page 1', async () => {
    const now = Date.now();
    renderPayment('/user/admindashboard/payment?page=2');
    await waitFor(() => expect(doGetAdminPaymentStats).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('radio', { name: '3 months' }));
    await waitFor(() => {
      const list = vi.mocked(doFilterPaymentHistories).mock.calls.at(-1)?.[0] as any;
      const stats = vi.mocked(doGetAdminPaymentStats).mock.calls.at(-1)?.[0] as any;
      expect(list.dateFrom).toBeTruthy();
      expect(list.currentPage).toBe(0);
      expect(stats.dateFrom).toBe(list.dateFrom);
      expect(list.dateTo).toBeUndefined();
      expect(stats.dateTo).toBeUndefined();
      const months = (now - new Date(list.dateFrom).getTime()) / (1000 * 60 * 60 * 24 * 30.4);
      expect(months).toBeGreaterThan(2.8);
      expect(months).toBeLessThan(3.2);
    });
    expect(screen.getByRole('radio', { name: '3 months' })).toHaveAttribute('aria-checked', 'true');
  });

  it('summary follows Stripe mode but not email, status or type', async () => {
    renderPayment();
    await findShowing(5, 6);
    chooseSelect('Stripe mode', 'Test');
    await waitFor(() => expect((vi.mocked(doGetAdminPaymentStats).mock.calls.at(-1)?.[0] as any).stripeMode).toBe('test'));
    const before = vi.mocked(doGetAdminPaymentStats).mock.calls.length;
    chooseSelect('Status', 'Paid');
    chooseSelect('Payment type', 'Charge');
    await waitFor(() => expect(doFilterPaymentHistories).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', paymentType: 'charge' })));
    expect(vi.mocked(doGetAdminPaymentStats).mock.calls.length).toBe(before);
  });

  it('the range counts as a filter, and Clear filters puts it back to All time', async () => {
    renderPayment('/user/admindashboard/payment?range=6m');
    expect(await screen.findByText(/1 filter active/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'All time' })).toHaveAttribute('aria-checked', 'true'));
  });

  it('says when the summary cannot be loaded and can try again; the list still works', async () => {
    vi.mocked(doGetAdminPaymentStats).mockResolvedValueOnce(false);
    renderPayment();
    expect(await screen.findByText('Could not load the payment summary.')).toBeInTheDocument();
    expect(await findShowing(5, 6)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    const summary = screen.getByTestId('payment-summary');
    expect((await within(summary).findByText('Collected')).parentElement?.textContent).toContain('$300');
    expect(within(summary).queryByText('Could not load the payment summary.')).toBeNull();
  });

  it('refreshes the summary after a refund', async () => {
    vi.mocked(processRefund).mockResolvedValue({ status: 'SUCCESS', message: 'Refund processed successfully.' });
    renderPayment();
    await findShowing(5, 6);
    const before = vi.mocked(doGetAdminPaymentStats).mock.calls.length;
    openRow('$100.00');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Refund' }));
    fireEvent.change(await screen.findByPlaceholderText('Enter refund amount'), { target: { value: '10' } });
    fireEvent.change(screen.getByPlaceholderText('Please provide a reason for this refund...'), { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Process Refund' }));
    await waitFor(() => expect(processRefund).toHaveBeenCalled());
    await waitFor(() => expect(vi.mocked(doGetAdminPaymentStats).mock.calls.length).toBeGreaterThan(before));
  });

  it('debounces email and sends it to the history API', async () => {
    renderPayment();
    await findShowing(5, 6);
    fireEvent.change(screen.getByLabelText('Search description or email'), { target: { value: 'ann@x.com' } });
    await waitFor(
      () => {
        expect(doFilterPaymentHistories).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'ann@x.com' }),
        );
      },
      { timeout: 1500 },
    );
    expect(await findShowing(2, 2)).toBeInTheDocument();
  });

  it('clears filters and restores the full paginated list', async () => {
    renderPayment();
    await findShowing(5, 6);
    chooseSelect('Status', 'Refunded');
    expect(await findShowing(1, 1)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await findShowing(5, 6)).toBeInTheDocument();
  });

  it('paginates and disables previous on the first page', async () => {
    renderPayment();
    await findShowing(5, 6);
    const totalRow = screen.getByTestId('payment-history-total');
    expect(totalRow).toHaveTextContent(/Total \(filtered\).*Paid.*100\.00 USD.*Failed.*30\.00 USD.*Refunded.*20\.00 USD/s);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => {
      expect(doFilterPaymentHistories).toHaveBeenCalledWith(
        expect.objectContaining({ currentPage: 1, numPerPage: 5 }),
      );
    });
    expect(await findShowing(1, 6)).toBeInTheDocument();
    expect(screen.getByTestId('payment-history-total')).toHaveTextContent(
      /Total \(filtered\).*Paid.*100\.00 USD.*Failed.*30\.00 USD.*Refunded.*20\.00 USD/s,
    );
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '25' } });
    await waitFor(() => {
      expect(doFilterPaymentHistories).toHaveBeenCalledWith(
        expect.objectContaining({ currentPage: 0, numPerPage: 25 }),
      );
    });
    expect(await findShowing(6, 6)).toBeInTheDocument();
  });

  it('keeps the hidden filter labels anchored to their boxes, so the page does not grow a blank area below', async () => {
    renderPayment();
    await findShowing(5, 6);
    for (const id of ['payment-filter-status', 'payment-filter-type', 'payment-search']) {
      const label = document.querySelector(`label[for="${id}"]`) as HTMLElement;
      expect(label).toHaveClass('sr-only');
      expect(label.parentElement).toHaveClass('relative');
    }
  });

  it('a page past the end (typed link, or rows gone after a refund) moves to the last page', async () => {
    renderPayment('/user/admindashboard/payment?page=9');
    await waitFor(() => {
      expect(doFilterPaymentHistories).toHaveBeenCalledWith(expect.objectContaining({ currentPage: 8, numPerPage: 5 }));
    });
    expect(await findShowing(1, 6)).toBeInTheDocument();
    expect(doFilterPaymentHistories).toHaveBeenLastCalledWith(expect.objectContaining({ currentPage: 1, numPerPage: 5 }));
    expect(screen.getByText('6–6 of 6')).toBeInTheDocument();
  });

  it('hides the Stripe mode filter when only live payments are visible', async () => {
    vi.mocked(getStripeMode).mockResolvedValue({
      stripeMode: 'live',
      paymentsVisibleMode: 'live',
      seminarApprovalDeadlineHours: 24,
      paymentWindowHours: 48,
    });
    renderPayment();
    expect(await findShowing(5, 6)).toBeInTheDocument();
    expect(screen.queryByTestId('payment-filter-mode')).not.toBeInTheDocument();
  });

  it('switches Stripe to Live only after confirm', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPayment();
    await findShowing(5, 6);
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
    await findShowing(5, 6);
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
    await findShowing(5, 6);
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
    await findShowing(5, 6);
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
    await findShowing(5, 6);
    fireEvent.change(screen.getByLabelText('Search description or email'), { target: { value: 'nobody@none.test' } });
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
    expect(await findShowing(5, 6)).toBeInTheDocument();
  });

  it('no longer shows or loads the paid-out list, which now lives on the Payroll page', async () => {
    renderPayment();
    expect(await findShowing(5, 6)).toBeInTheDocument();
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

  describe('everything the old table did, in the new list and details panel', () => {
    it('clicking a row shows its full details: user, both emails, type, status, amount, description, date, intent, receipt', async () => {
      renderPayment();
      await findShowing(5, 6);
      openRow('$100.00');
      const p = within(panel());
      expect(p.getByText('ann@x.com → eli@x.com', { selector: 'div' })).toBeInTheDocument();
      expect(p.getByText('Student email').nextElementSibling?.textContent).toBe('ann@x.com');
      expect(p.getByText('Expert email').nextElementSibling?.textContent).toBe('eli@x.com');
      expect(p.getByText('test · charge')).toBeInTheDocument();
      expect(p.getAllByText('Paid').length).toBeGreaterThan(0);
      expect(p.getByText('Session A')).toBeInTheDocument();
      expect(p.getByText('pi_3UB4xxxxUfoa')).toBeInTheDocument();
      expect(p.getByRole('button', { name: 'Copy payment intent' })).toBeInTheDocument();
      expect(p.getByRole('link', { name: 'Open receipt' })).toHaveAttribute('href', 'https://example.com/r1');
      expect(p.getByRole('link', { name: 'View receipt' })).toHaveAttribute('href', 'https://example.com/r1');
    });

    it('tags a live payment as live in the details, like the old Type column', async () => {
      renderPayment();
      await findShowing(5, 6);
      openRow('$50.00');
      expect(within(panel()).getByText('live · charge')).toBeInTheDocument();
      expect(within(panel()).getAllByText('In Flight').length).toBeGreaterThan(0);
    });

    it('offers Retry and Refund only where the old menu did', async () => {
      renderPayment();
      await findShowing(5, 6);
      const buttonsFor = (amount: string) => {
        openRow(amount);
        return within(panel()).queryAllByRole('button').map(b => b.textContent?.trim()).filter(t => t === 'Retry' || t === 'Refund');
      };
      expect(buttonsFor('$100.00')).toEqual(['Retry', 'Refund']); // paid charge
      expect(buttonsFor('$20.00')).toEqual([]); // refund row
      expect(buttonsFor('$50.00')).toEqual(['Retry']); // in flight: retry, nothing to refund yet
      expect(buttonsFor('$80.00')).toEqual([]); // withheld
      expect(buttonsFor('$30.00')).toEqual([]); // a retry link itself
    });

    it('Retry from the panel sends the payment link for that payment', async () => {
      vi.mocked(sendPaymentLinkToUser).mockResolvedValue({ status: 'SUCCESS' });
      renderPayment();
      await findShowing(5, 6);
      openRow('$100.00');
      fireEvent.click(within(panel()).getByRole('button', { name: 'Retry' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Send Payment Link' }));
      await waitFor(() => expect(sendPaymentLinkToUser).toHaveBeenCalledWith(expect.objectContaining({ paymentHistoryId: '1' })));
    });

    it('keeps the same payment open after a refund reloads the list', async () => {
      vi.mocked(processRefund).mockResolvedValue({ status: 'SUCCESS', message: 'Refund processed successfully.' });
      renderPayment();
      await findShowing(5, 6);
      openRow('$100.00');
      const calls = vi.mocked(doFilterPaymentHistories).mock.calls.length;
      fireEvent.click(within(panel()).getByRole('button', { name: 'Refund' }));
      fireEvent.change(await screen.findByPlaceholderText('Enter refund amount'), { target: { value: '10' } });
      fireEvent.change(screen.getByPlaceholderText('Please provide a reason for this refund...'), { target: { value: 'x' } });
      fireEvent.click(screen.getByRole('button', { name: 'Process Refund' }));
      await waitFor(() => expect(vi.mocked(doFilterPaymentHistories).mock.calls.length).toBeGreaterThan(calls));
      await waitFor(() => expect(within(panel()).getByText('Session A')).toBeInTheDocument());
    });

    it('lists refund rows too, each tagged with its mode and kind, and shows the Payments page status names', async () => {
      renderPayment();
      await findShowing(5, 6);
      const table = screen.getByTestId('payment-history-table');
      expect(within(table).getByText('test · refund')).toBeInTheDocument();
      expect(within(table).getAllByText('live · charge')).toHaveLength(2);
      expect(within(table).getAllByText('Paid').length).toBe(1);
      expect(within(table).getByText('In Flight')).toBeInTheDocument();
      expect(within(table).queryByText('Completed')).toBeNull();
      expect(screen.getByRole('button', { name: 'Send Ad-hoc Payment' })).toBeInTheDocument();
    });

    it('search: words look in the description, an address looks up that user', async () => {
      renderPayment();
      await findShowing(5, 6);
      fireEvent.change(screen.getByLabelText('Search description or email'), { target: { value: 'Session' } });
      await waitFor(() => expect(doFilterPaymentHistories).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'Session' })));
      expect((vi.mocked(doFilterPaymentHistories).mock.calls.at(-1)?.[0] as any).email).toBeUndefined();
      fireEvent.change(screen.getByLabelText('Search description or email'), { target: { value: 'ann@x.com' } });
      await waitFor(() => expect(doFilterPaymentHistories).toHaveBeenLastCalledWith(expect.objectContaining({ email: 'ann@x.com' })));
    });

    it('Past bookings asks for sessions held in the range; Upcoming for every session still to come', async () => {
      renderPayment('/user/admindashboard/payment?range=3m');
      await waitFor(() => expect(doFilterPaymentHistories).toHaveBeenCalled());
      fireEvent.click(screen.getByRole('tab', { name: 'Past bookings' }));
      await waitFor(() => expect(doFilterPaymentHistories).toHaveBeenLastCalledWith(expect.objectContaining({ bookingScope: 'past', dateFrom: expect.any(String) })));
      fireEvent.click(screen.getByRole('tab', { name: 'Upcoming bookings' }));
      await waitFor(() => expect(doFilterPaymentHistories).toHaveBeenLastCalledWith(expect.objectContaining({ bookingScope: 'upcoming' })));
      expect((vi.mocked(doFilterPaymentHistories).mock.calls.at(-1)?.[0] as any).dateFrom).toBeUndefined();
      expect(await screen.findByText(/for upcoming sessions · not limited by the date range/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('tab', { name: 'All' }));
      await waitFor(() => expect((vi.mocked(doFilterPaymentHistories).mock.calls.at(-1)?.[0] as any).bookingScope).toBeUndefined());
    });

    it('shows an error with Try again when the list cannot load, instead of an empty list', async () => {
      vi.mocked(doFilterPaymentHistories).mockResolvedValueOnce(false);
      renderPayment();
      expect(await screen.findByText('Could not load payment history.')).toBeInTheDocument();
      expect(screen.queryByText('No payment history yet.')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await findShowing(5, 6)).toBeInTheDocument();
    });

    it('ignores a slower answer for filters the admin has already changed', async () => {
      let releaseOld: (v: any) => void = () => {};
      vi.mocked(doFilterPaymentHistories)
        .mockImplementationOnce(() => new Promise(r => { releaseOld = r; }))
        .mockImplementation(async filter => applyFilter(filter));
      renderPayment();
      await waitFor(() => expect(doFilterPaymentHistories).toHaveBeenCalledTimes(1));
      chooseSelect('Status', 'Paid');
      expect(await findShowing(1, 1)).toBeInTheDocument();
      releaseOld({ result: ALL_ROWS.slice(0, 5), totalCount: 6 });
      await new Promise(r => setTimeout(r, 30));
      expect(await findShowing(1, 1)).toBeInTheDocument();
    });

    it('phones get one card per payment with its amount, type and status', async () => {
      renderPayment();
      await findShowing(5, 6);
      const cards = within(screen.getByTestId('payment-history-cards')).getAllByRole('button');
      expect(cards).toHaveLength(5);
      expect(cards[0]).toHaveTextContent('$100.00');
      expect(cards[0]).toHaveTextContent('test · charge');
      expect(cards[0]).toHaveTextContent('Paid');
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
      expect(await findShowing(5, 6)).toBeInTheDocument();
      expect(modeFilterLabel()).toBe('Test and live');
      expect(requestedModes().every(mode => !mode)).toBe(true);
    });

    it('keeps a mode already in the URL', async () => {
      renderPayment('/user/admindashboard/payment?mode=live');
      expect(await findShowing(2, 2)).toBeInTheDocument();
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
      expect(await findShowing(5, 6)).toBeInTheDocument();
    });

    it('moves the filter to Live after the switch is confirmed', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderPayment();
      await findShowing(5, 6);
      fireEvent.click(screen.getByRole('button', { name: 'Live' }));
      expect(await findShowing(2, 2)).toBeInTheDocument();
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
      await findShowing(5, 6);
      fireEvent.click(screen.getByRole('button', { name: 'Test' }));
      expect(await findShowing(4, 4)).toBeInTheDocument();
      expect(setStripeMode).toHaveBeenCalledWith({ stripeMode: 'test' });
      expect(modeFilterLabel()).toBe('Test');
    });

    it('leaves the filter alone when the Live switch is cancelled', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderPayment();
      await findShowing(5, 6);
      fireEvent.click(screen.getByRole('button', { name: 'Live' }));
      expect(setStripeMode).not.toHaveBeenCalled();
      expect(modeFilterLabel()).toBe('Test and live');
      expect(requestedModes()).not.toContain('live');
      confirm.mockRestore();
    });

    it('shows no success message after a switch, so nothing covers the toggle', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const success = vi.spyOn(notify, 'success');
      renderPayment();
      await findShowing(5, 6);
      fireEvent.click(screen.getByRole('button', { name: 'Live' }));
      expect(await findShowing(2, 2)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Test' }));
      expect(await findShowing(4, 4)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Live' }));
      expect(await findShowing(2, 2)).toBeInTheDocument();
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
      await findShowing(5, 6);
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
      await findShowing(5, 6);
      fireEvent.click(screen.getByRole('button', { name: 'Live' }));
      await waitFor(() => {
        expect(setStripeMode).toHaveBeenCalledWith({ stripeMode: 'live' });
      });
      expect(screen.getByRole('button', { name: 'Test' })).toHaveAttribute('aria-pressed', 'true');
      expect(modeFilterLabel()).toBe('Test and live');
      expect(requestedModes()).not.toContain('live');
      confirm.mockRestore();
    });

    it('clicking the selected mode brings a hand-changed filter back', async () => {
      renderPayment();
      await findShowing(5, 6);
      chooseSelect('Stripe mode', 'Live');
      await findShowing(2, 2);
      fireEvent.click(screen.getByRole('button', { name: 'Test' }));
      expect(await findShowing(4, 4)).toBeInTheDocument();
      expect(modeFilterLabel()).toBe('Test');
      expect(setStripeMode).not.toHaveBeenCalled();
    });

    it('keeps the other filters when the mode switches', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderPayment();
      await findShowing(5, 6);
      chooseSelect('Status', 'Withheld');
      await findShowing(1, 1);
      fireEvent.click(screen.getByRole('button', { name: 'Live' }));
      expect(await findShowing(1, 1)).toBeInTheDocument();
      expect(doFilterPaymentHistories).toHaveBeenLastCalledWith(
        expect.objectContaining({ stripeMode: 'live', status: 'withheld', currentPage: 0 }),
      );
      confirm.mockRestore();
    });
  });
});
