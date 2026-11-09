import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { notify } from '../../../utils/notify';
import {
  doFilterPaymentHistories,
  doGetAdminPaymentStats,
  doGetPaymentIntegrityReport,
  type AdminPaymentStatsData,
  getStripeMode,
  processRefund,
  sendAdHocPaymentLink,
  sendPaymentLinkToUser,
  setPaymentWindow,
  setSeminarApprovalDeadline,
  setStripeMode,
} from '../../../api/api';
import { SetLoadingStatus } from '../../../actions/appActions';
import Pagination from '../../../components/Pagination';
import RetryPaymentModal from '../../../components/RetryPaymentModal';
import RefundPaymentModal from '../../../components/RefundPaymentModal';
import AdHocPaymentModal from '../../../components/AdHocPaymentModal';
import PaymentDetailsDrawer from './payment/PaymentDetailsDrawer';
import PaymentFilterBar from './payment/PaymentFilterBar';
import { PaymentHistoryCard, PaymentHistoryRow } from './payment/PaymentHistoryRow';
import PaymentIntegrityCard from './payment/PaymentIntegrityCard';
import PaymentSettingRow from './payment/PaymentSettingRow';
import {
  EMPTY_FILTERS,
  EMPTY_PAYMENT_STATUS_TOTALS,
  countActiveFilters,
  hasAnyParty,
  historyDateBounds,
  historySearchFromState,
  parseHistorySearch,
  type HistoryFilters,
  type PaymentHistoryRow as HistoryRow,
  type PaymentStatusTotals,
} from './payment/paymentHistoryUtils';
import PaymentStatusTotalsBar from './payment/PaymentStatusTotalsBar';
import SnapshotRangeControl from '../../../components/dashboard/SnapshotRangeControl';
import SnapshotKpiStrip, { paymentKpis } from '../../../components/dashboard/SnapshotKpiStrip';
import SnapshotMonthlyChart from '../../../components/dashboard/SnapshotMonthlyChart';
import { type SnapshotCustomRange, type SnapshotRangeKey } from '../../../utils/adminSnapshotRange';
import { DASHBOARD_PAGE_TITLE } from '../../../components/dashboard/pageTitle';

const Payment = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const parsed = useMemo(() => parseHistorySearch(searchParams), [searchParams]);
  const filters = parsed.filters;
  /** One set of dates for the list and the summary, worked out when the range is picked. */
  const dateBounds = useMemo(
    () => historyDateBounds(filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.range, filters.startDate, filters.endDate],
  );
  const currentPage = parsed.page;
  const pageSize = parsed.pageSize;

  const [emailDraft, setEmailDraft] = useState(filters.email);
  const [stripeMode, setPlatformStripeMode] = useState('test');
  /** Server gate: live = prod (hide mode filter); all = staging (All/Live/Test). null until known. */
  const [paymentsVisibleMode, setPaymentsVisibleMode] = useState<'live' | 'all' | null>(null);
  const [historiesReady, setHistoriesReady] = useState(() => Boolean(filters.mode));
  const [approvalDeadlineHours, setApprovalDeadlineHours] = useState(24);
  const [deadlineInput, setDeadlineInput] = useState('24');
  const [paymentWindowHours, setPaymentWindowHours] = useState(48);
  const [paymentWindowInput, setPaymentWindowInput] = useState('48');
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [savingWindow, setSavingWindow] = useState(false);
  const [integrityReport, setIntegrityReport] = useState<any>(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [histories, setHistories] = useState<HistoryRow[]>([]);
  const [statusTotals, setStatusTotals] = useState<PaymentStatusTotals>(EMPTY_PAYMENT_STATUS_TOTALS);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);
  const [selectedPaymentItem, setSelectedPaymentItem] = useState<any>(null);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedRefundItem, setSelectedRefundItem] = useState<any>(null);
  const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false);
  const [detailsItem, setDetailsItem] = useState<HistoryRow | null>(null);
  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeCount = countActiveFilters(filters);
  const showParty = hasAnyParty(histories);
  const genuineEmpty = hasLoaded && !loading && totalCount === 0 && activeCount === 0;
  const filteredEmpty = hasLoaded && !loading && totalCount === 0 && activeCount > 0;

  const parsedRef = useRef(parsed);
  parsedRef.current = parsed;

  const writeParams = useCallback(
    (nextFilters: HistoryFilters, page: number, size: number) => {
      setSearchParams(historySearchFromState(nextFilters, page, size), { replace: true });
    },
    [setSearchParams],
  );
  const writeParamsRef = useRef(writeParams);
  writeParamsRef.current = writeParams;

  const patchFilters = useCallback(
    (patch: Partial<HistoryFilters>) => {
      const next = { ...parsedRef.current.filters, ...patch };
      parsedRef.current = { ...parsedRef.current, filters: next, page: 0 };
      writeParams(next, 0, parsedRef.current.pageSize);
    },
    [writeParams],
  );

  const clearFilters = useCallback(() => {
    setEmailDraft('');
    parsedRef.current = { ...parsedRef.current, filters: EMPTY_FILTERS, page: 0 };
    writeParams(EMPTY_FILTERS, 0, parsedRef.current.pageSize);
  }, [writeParams]);

  useEffect(() => {
    setEmailDraft(filters.email);
  }, [filters.email]);

  useEffect(() => {
    if (emailTimer.current) clearTimeout(emailTimer.current);
    if (emailDraft === filters.email) return;
    emailTimer.current = setTimeout(() => {
      const next = { ...parsedRef.current.filters, email: emailDraft.trim() };
      parsedRef.current = { ...parsedRef.current, filters: next, page: 0 };
      writeParams(next, 0, parsedRef.current.pageSize);
    }, 300);
    return () => {
      if (emailTimer.current) clearTimeout(emailTimer.current);
    };
  }, [emailDraft, filters.email, writeParams]);

  const loadHistories = useCallback(async () => {
    setLoading(true);
    const response = await doFilterPaymentHistories({
      currentPage,
      numPerPage: pageSize,
      email: filters.email,
      stripeMode: filters.mode,
      paymentType: filters.type,
      status: filters.status,
      ...dateBounds,
      sortBy: 'createdAt',
    });
    if (response) {
      setHistories(Array.isArray(response.result) ? response.result : []);
      setTotalCount(Number(response.totalCount) || 0);
      setStatusTotals(response.totals || EMPTY_PAYMENT_STATUS_TOTALS);
      if (response.paymentsVisibleMode === 'all' || response.paymentsVisibleMode === 'live') {
        setPaymentsVisibleMode(response.paymentsVisibleMode);
      }
    } else {
      setHistories([]);
      setTotalCount(0);
      setStatusTotals(EMPTY_PAYMENT_STATUS_TOTALS);
    }
    setHasLoaded(true);
    setLoading(false);
  }, [currentPage, pageSize, filters.email, filters.mode, filters.status, filters.type, dateBounds]);

  const [paymentStats, setPaymentStats] = useState<AdminPaymentStatsData | null>(null);
  const [paymentStatsError, setPaymentStatsError] = useState(false);
  const statsSeq = useRef(0);

  /** Summary follows the date range and the Stripe mode only, like the Overview Payments view. */
  const loadPaymentStats = useCallback(async () => {
    const seq = ++statsSeq.current;
    setPaymentStats(null);
    setPaymentStatsError(false);
    const res = await doGetAdminPaymentStats({ ...dateBounds, stripeMode: filters.mode || undefined });
    if (seq !== statsSeq.current) return;
    if (res && res.status === 'SUCCESS' && res.data) setPaymentStats(res.data);
    else setPaymentStatsError(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.mode, dateBounds]);

  useEffect(() => {
    if (!historiesReady) return;
    void loadPaymentStats();
  }, [historiesReady, loadPaymentStats]);

  const changeRange = useCallback(
    (range: SnapshotRangeKey, custom?: SnapshotCustomRange) => {
      patchFilters({
        range,
        startDate: range === 'custom' && custom ? custom.startDate : '',
        endDate: range === 'custom' && custom ? custom.endDate : '',
      });
    },
    [patchFilters],
  );

  useEffect(() => {
    if (!historiesReady) return;
    void loadHistories();
  }, [historiesReady, loadHistories]);

  const loadIntegrityReport = useCallback(async () => {
    setIntegrityLoading(true);
    try {
      const res = await doGetPaymentIntegrityReport(true);
      if (res && res.summary) setIntegrityReport(res);
      else {
        setIntegrityReport(null);
        if (res !== false) notify.error('Could not load payment integrity report.');
      }
    } catch {
      setIntegrityReport(null);
      notify.error('Could not load payment integrity report.');
    } finally {
      setIntegrityLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const response = await getStripeMode();
      if (response && response.stripeMode) {
        setPlatformStripeMode(response.stripeMode || 'test');
        const visible =
          response.paymentsVisibleMode === 'all' || response.paymentsVisibleMode === 'live'
            ? response.paymentsVisibleMode
            : 'live';
        setPaymentsVisibleMode(visible);
        const current = parsedRef.current;
        // Production: only live data exists — clear a stale test/live URL filter.
        // Staging: default All (do not sync filter to the platform charge mode).
        if (visible === 'live' && current.filters.mode) {
          const next = { ...current.filters, mode: '' };
          parsedRef.current = { ...current, filters: next };
          writeParamsRef.current(next, current.page, current.pageSize);
        }
        const hours =
          typeof response.seminarApprovalDeadlineHours === 'number'
            ? response.seminarApprovalDeadlineHours
            : 24;
        setApprovalDeadlineHours(hours);
        setDeadlineInput(String(hours));
        const windowHours =
          typeof response.paymentWindowHours === 'number' ? response.paymentWindowHours : 48;
        setPaymentWindowHours(windowHours);
        setPaymentWindowInput(String(windowHours));
      } else {
        // Fail-safe: treat as live-only when the server does not answer.
        setPaymentsVisibleMode('live');
      }
      setHistoriesReady(true);
    })();
    void loadIntegrityReport();
  }, [loadIntegrityReport]);

  // Keep filter in sync when admin toggles platform charge mode (staging only).
  const syncHistoryModeOnPlatformSwitch = paymentsVisibleMode === 'all';
  const showStripeModeFilter = paymentsVisibleMode === 'all';

  const updateStripeMode = async (next: string) => {
    if (next === stripeMode) {
      if (syncHistoryModeOnPlatformSwitch && parsedRef.current.filters.mode !== next) {
        patchFilters({ mode: next });
      }
      return;
    }
    if (next === 'live' && !window.confirm('Switch Stripe to Live mode? Charges will use real money.')) {
      return;
    }
    SetLoadingStatus(true);
    const response = await setStripeMode({ stripeMode: next });
    SetLoadingStatus(false);
    if (response === false || response?.error) {
      notify.error(response?.error || 'Could not update Stripe mode.');
      return;
    }
    setPlatformStripeMode(next);
    if (syncHistoryModeOnPlatformSwitch) patchFilters({ mode: next });
  };

  const saveApprovalDeadline = async () => {
    const hours = Number(deadlineInput);
    if (!Number.isFinite(hours) || hours < 0 || hours > 168) {
      notify.error('Enter a value between 0 and 168 hours.');
      return;
    }
    setSavingDeadline(true);
    const response = await setSeminarApprovalDeadline(hours);
    setSavingDeadline(false);
    if (response === false || response?.error) {
      notify.error(response?.error || 'Could not save the approval deadline.');
      return;
    }
    setApprovalDeadlineHours(hours);
    notify.success('Seminar approval deadline updated.');
  };

  const savePaymentWindow = async () => {
    const hours = Number(paymentWindowInput);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
      notify.error('Enter a value between 1 and 168 hours.');
      return;
    }
    setSavingWindow(true);
    const response = await setPaymentWindow(hours);
    setSavingWindow(false);
    if (response === false || response?.error) {
      notify.error(response?.error || 'Could not save the payment window.');
      return;
    }
    setPaymentWindowHours(hours);
    notify.success('Payment window updated.');
  };

  const handleRetryPaymentConfirm = async (customizedPayment: {
    amount: number;
    description: string;
    customerEmail: string;
  }) => {
    const response = await sendPaymentLinkToUser({
      paymentHistoryId: selectedPaymentItem._id,
      customerEmail: customizedPayment.customerEmail,
      customAmount: Math.round(customizedPayment.amount * 100),
      customDescription: customizedPayment.description,
    });
    if (response?.status === 'SUCCESS') {
      notify.success('Payment link has been sent successfully to the customer.');
      setIsRetryModalOpen(false);
      setSelectedPaymentItem(null);
    } else {
      notify.error(
          'Failed to send payment link: ' +
            (typeof response?.message === 'string' ? response.message : 'Unknown error'),
        );
    }
  };

  const handleRefundConfirm = async (refundData: { amount: number; reason: string }) => {
    const response = await processRefund({
      paymentHistoryId: selectedRefundItem._id,
      refundAmount: refundData.amount,
      refundReason: refundData.reason,
    });
    if (response?.status === 'SUCCESS') {
      notify.success(
        typeof response.message === 'string' && response.message
          ? response.message
          : 'Refund processed successfully.',
      );
      setIsRefundModalOpen(false);
      setSelectedRefundItem(null);
      void loadHistories();
      void loadPaymentStats();
      void loadIntegrityReport();
    } else {
      notify.error(
          'Failed to process refund: ' +
            (typeof response?.message === 'string' ? response.message : 'Unknown error'),
        );
    }
  };

  const handleAdHocPaymentConfirm = async (paymentData: {
    amount: number;
    description: string;
    customerEmail: string;
    customerName?: string;
  }) => {
    const response = await sendAdHocPaymentLink({
      amount: paymentData.amount,
      description: paymentData.description,
      customerEmail: paymentData.customerEmail,
      customerName: paymentData.customerName,
    });
    if (response?.status === 'SUCCESS') {
      notify.success('Payment link sent successfully to customer.');
      setIsAdHocModalOpen(false);
      void loadHistories();
      void loadIntegrityReport();
    } else {
      notify.error(
          'Failed to send payment link: ' +
            (typeof response?.message === 'string' ? response.message : 'Unknown error'),
        );
    }
  };

  const resultLabel = loading
    ? 'Loading payment histories…'
    : `Showing ${histories.length} of ${totalCount} histories`;

  return (
    <div className="h-full w-full overflow-y-auto px-[18px] pt-10 pb-10 text-wl-ink">
      <div className="mx-auto w-full max-w-[1500px] space-y-6">
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <h2 className={DASHBOARD_PAGE_TITLE}>Payment Management</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-wl-muted">Payment mode</span>
            <div className="overflow-hidden rounded-full border border-wl-line bg-wl-card shadow-sm">
              <button
                type="button"
                className={`h-8 w-16 text-sm font-medium ${
                  stripeMode === 'test' ? 'bg-wl-brand text-white' : 'text-wl-muted hover:bg-wl-pageAlt'
                }`}
                aria-pressed={stripeMode === 'test'}
                onClick={() => updateStripeMode('test')}
              >
                Test
              </button>
              <button
                type="button"
                className={`h-8 w-16 text-sm font-medium ${
                  stripeMode === 'live' ? 'bg-wl-brand text-white' : 'text-wl-muted hover:bg-wl-pageAlt'
                }`}
                aria-pressed={stripeMode === 'live'}
                onClick={() => updateStripeMode('live')}
              >
                Live
              </button>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-wl-line bg-wl-card p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-wl-brand">Settings</h3>
          <div className="space-y-5">
            <PaymentSettingRow
              id="seminar-deadline"
              label="Seat-request approval deadline"
              hint="Hours before seminar start (0–168)."
              value={deadlineInput}
              min={0}
              max={168}
              savedValue={approvalDeadlineHours}
              saving={savingDeadline}
              onChange={setDeadlineInput}
              onSave={saveApprovalDeadline}
            />
            <PaymentSettingRow
              id="payment-window"
              label="Booking payment window"
              hint="Hours before session start (1–168)."
              value={paymentWindowInput}
              min={1}
              max={168}
              savedValue={paymentWindowHours}
              saving={savingWindow}
              onChange={setPaymentWindowInput}
              onSave={savePaymentWindow}
            />
          </div>
        </section>

        <PaymentIntegrityCard
          report={integrityReport}
          loading={integrityLoading}
          onRefresh={loadIntegrityReport}
        />

        <section className="overflow-hidden rounded-2xl border border-wl-line bg-wl-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wl-line px-4 py-4">
            <h3 className="text-lg font-semibold text-wl-brand">Payment History</h3>
            <button
              type="button"
              onClick={() => setIsAdHocModalOpen(true)}
              className="rounded-lg bg-wl-brand px-4 py-2 text-sm font-medium text-white hover:brightness-95"
            >
              Send Ad-hoc Payment
            </button>
          </div>
          <div className="space-y-4 border-b border-wl-line px-4 py-4" data-testid="payment-summary">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-wl-muted">
                Collected, count, chart and the list below all use this date range.
              </p>
              <SnapshotRangeControl
                id="payment-range"
                value={filters.range}
                customRange={
                  filters.range === 'custom' ? { startDate: filters.startDate, endDate: filters.endDate } : null
                }
                onChange={changeRange}
              />
            </div>
            {paymentStatsError ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-rose-700">
                Could not load the payment summary.
                <button
                  type="button"
                  onClick={() => void loadPaymentStats()}
                  className="rounded-full border border-wl-line bg-white px-3 py-1 text-sm font-medium text-wl-brand"
                >
                  Try again
                </button>
              </div>
            ) : !paymentStats ? (
              <SnapshotKpiStrip kpis={[]} loadingLabel="Loading payment summary…" />
            ) : (
              <>
                <SnapshotKpiStrip kpis={paymentKpis(paymentStats)} />
                <SnapshotMonthlyChart
                  points={paymentStats.monthly}
                  useAmount
                  title="Payments collected per month"
                  emptyLabel="No payments in this range"
                />
              </>
            )}
          </div>
          <PaymentFilterBar
            filters={filters}
            emailDraft={emailDraft}
            activeCount={activeCount}
            resultLabel={resultLabel}
            onEmailDraft={setEmailDraft}
            onChange={patchFilters}
            onClear={clearFilters}
            showStripeModeFilter={showStripeModeFilter}
          />
          <div className="space-y-4 p-4">
            {loading ? (
              <div className="space-y-2" data-testid="payment-history-skeleton">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-wl-pageAlt" />
                ))}
              </div>
            ) : filteredEmpty ? (
              <div className="rounded-2xl border border-dashed border-wl-line bg-wl-card/60 px-6 py-16 text-center">
                <p className="text-sm text-wl-muted">No payment history matches these filters</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 rounded-full border border-wl-line bg-white px-4 py-1.5 text-sm font-medium text-wl-brand"
                >
                  Clear filters
                </button>
              </div>
            ) : genuineEmpty ? (
              <div className="rounded-2xl border border-dashed border-wl-line bg-wl-card/60 px-6 py-16 text-center text-sm text-wl-muted">
                No payment history yet.
              </div>
            ) : (
              <>
                <div className="md:hidden space-y-3" data-testid="payment-history-cards">
                  {histories.map(item => (
                    <PaymentHistoryCard
                      key={item._id}
                      item={item}
                      onDetails={() => setDetailsItem(item)}
                      onRetry={() => {
                        setSelectedPaymentItem(item);
                        setIsRetryModalOpen(true);
                      }}
                      onRefund={() => {
                        setSelectedRefundItem(item);
                        setIsRefundModalOpen(true);
                      }}
                    />
                  ))}
                  <div
                    data-testid="payment-history-total-cards"
                    className="rounded-xl border border-wl-line bg-wl-brandSoft/60 px-4 py-4"
                  >
                    <PaymentStatusTotalsBar totals={statusTotals} />
                  </div>
                </div>
                <div className="hidden max-h-[640px] overflow-y-auto md:block" data-testid="payment-history-table">
                  <table className="hidden w-full table-fixed text-left text-sm md:table">
                    <thead className="sticky top-0 z-10 bg-wl-brandSoft text-xs uppercase text-wl-brand">
                      <tr>
                        <th className="w-12 px-3 py-3 text-center">No</th>
                        <th className="w-32 px-3 py-3">Date</th>
                        <th className="w-28 px-3 py-3">Amount</th>
                        {showParty ? <th className="px-3 py-3">Party</th> : null}
                        <th className="w-24 px-3 py-3">Event</th>
                        <th className="hidden px-3 py-3 lg:table-cell">Description</th>
                        <th className="w-28 px-3 py-3">Type</th>
                        <th className="w-24 px-3 py-3">Status</th>
                        <th className="hidden px-3 py-3 lg:table-cell">Intent</th>
                        <th className="w-12 px-3 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {histories.map((item, index) => (
                        <PaymentHistoryRow
                          key={item._id || index}
                          item={item}
                          index={pageSize * currentPage + index + 1}
                          showParty={showParty}
                          onDetails={() => setDetailsItem(item)}
                          onRetry={() => {
                            setSelectedPaymentItem(item);
                            setIsRetryModalOpen(true);
                          }}
                          onRefund={() => {
                            setSelectedRefundItem(item);
                            setIsRefundModalOpen(true);
                          }}
                        />
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-wl-brandSoft text-sm text-wl-ink">
                      <tr data-testid="payment-history-total">
                        <td className="px-3 py-4" colSpan={showParty ? 10 : 9}>
                          <PaymentStatusTotalsBar totals={statusTotals} />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}

            <Pagination
              id="payment-page-size"
              currentPage={currentPage}
              totalCount={totalCount}
              pageSize={pageSize}
              onPage={page => {
                parsedRef.current = { ...parsedRef.current, page };
                writeParams(parsedRef.current.filters, page, parsedRef.current.pageSize);
              }}
              onPageSize={size => {
                parsedRef.current = { ...parsedRef.current, page: 0, pageSize: size };
                writeParams(parsedRef.current.filters, 0, size);
              }}
            />
          </div>
        </section>
      </div>
      {detailsItem ? (
        <PaymentDetailsDrawer item={detailsItem} onClose={() => setDetailsItem(null)} />
      ) : null}
      <RetryPaymentModal
        paymentItem={selectedPaymentItem}
        isOpen={isRetryModalOpen}
        onClose={() => {
          setIsRetryModalOpen(false);
          setSelectedPaymentItem(null);
        }}
        onConfirm={handleRetryPaymentConfirm}
      />
      <RefundPaymentModal
        paymentItem={selectedRefundItem}
        isOpen={isRefundModalOpen}
        onClose={() => {
          setIsRefundModalOpen(false);
          setSelectedRefundItem(null);
        }}
        onConfirm={handleRefundConfirm}
      />
      <AdHocPaymentModal
        isOpen={isAdHocModalOpen}
        onClose={() => setIsAdHocModalOpen(false)}
        onConfirm={handleAdHocPaymentConfirm}
      />
    </div>
  );
};

export default Payment;
