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
import RetryPaymentModal from '../../../components/RetryPaymentModal';
import RefundPaymentModal from '../../../components/RefundPaymentModal';
import AdHocPaymentModal from '../../../components/AdHocPaymentModal';
import PaymentHistoryList from './payment/PaymentHistoryList';
import PaymentIntegrityCard from './payment/PaymentIntegrityCard';
import PaymentSettingRow from './payment/PaymentSettingRow';
import {
  EMPTY_FILTERS,
  EMPTY_PAYMENT_STATUS_TOTALS,
  countActiveFilters,
  historyDateBounds,
  historyListParams,
  historySearchFromState,
  lastPageIndex,
  parseHistorySearch,
  type HistoryFilters,
  type PaymentHistoryRow as HistoryRow,
  type PaymentStatusTotals,
} from './payment/paymentHistoryUtils';
import SnapshotRangeControl from '../../../components/dashboard/SnapshotRangeControl';
import SnapshotKpiStrip, { paymentKpis } from '../../../components/dashboard/SnapshotKpiStrip';
import SnapshotMonthlyChart from '../../../components/dashboard/SnapshotMonthlyChart';
import { SnapshotMetricBody } from '../../../components/dashboard/AdminSnapshotMetricView';
import {
  alignMonthlyPoints,
  snapshotChartMonthKeys,
  snapshotRangePhrase,
  type SnapshotCustomRange,
  type SnapshotRangeKey,
} from '../../../utils/adminSnapshotRange';
import type { AdminSnapshotMonthlyPoint } from '../../../api/api';
import { DASHBOARD_PAGE_TITLE } from '../../../components/dashboard/pageTitle';

type SummaryView = 'payments' | 'refunds';

const SUMMARY_VIEWS: ReadonlyArray<{ value: SummaryView; label: string }> = [
  { value: 'payments', label: 'Payments' },
  { value: 'refunds', label: 'Refunds' },
];

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

  const [searchDraft, setSearchDraft] = useState(filters.search);
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
  const [loadError, setLoadError] = useState(false);
  const listSeq = useRef(0);
  const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);
  const [selectedPaymentItem, setSelectedPaymentItem] = useState<any>(null);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedRefundItem, setSelectedRefundItem] = useState<any>(null);
  const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeCount = countActiveFilters(filters);

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
    setSearchDraft('');
    parsedRef.current = { ...parsedRef.current, filters: EMPTY_FILTERS, page: 0 };
    writeParams(EMPTY_FILTERS, 0, parsedRef.current.pageSize);
  }, [writeParams]);

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchDraft.trim() === filters.search) return;
    searchTimer.current = setTimeout(() => {
      const next = { ...parsedRef.current.filters, search: searchDraft.trim() };
      parsedRef.current = { ...parsedRef.current, filters: next, page: 0 };
      writeParams(next, 0, parsedRef.current.pageSize);
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchDraft, filters.search, writeParams]);

  const loadHistories = useCallback(async () => {
    const seq = ++listSeq.current;
    setLoading(true);
    const response = await doFilterPaymentHistories({
      currentPage,
      numPerPage: pageSize,
      stripeMode: filters.mode,
      paymentType: filters.type,
      status: filters.status,
      ...historyListParams(filters, dateBounds),
      sortBy: 'createdAt',
    });
    // A slower answer for filters the admin has already changed must not replace the newer list.
    if (seq !== listSeq.current) return;
    setLoadError(response === false);
    if (response) {
      const total = Number(response.totalCount) || 0;
      const lastPage = lastPageIndex(total, pageSize);
      // Past the end (a typed link, or rows that left the filter after a refund): go to the last page instead of a blank one.
      if (currentPage > lastPage) {
        parsedRef.current = { ...parsedRef.current, page: lastPage };
        writeParams(parsedRef.current.filters, lastPage, parsedRef.current.pageSize);
        return;
      }
      setHistories(Array.isArray(response.result) ? response.result : []);
      setTotalCount(total);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, filters.search, filters.when, filters.mode, filters.status, filters.type, dateBounds, writeParams]);

  const [paymentStats, setPaymentStats] = useState<AdminPaymentStatsData | null>(null);
  const [paymentStatsError, setPaymentStatsError] = useState(false);
  const statsSeq = useRef(0);

  const [summaryView, setSummaryView] = useState<SummaryView>('payments');

  /** Same month axis as the Overview charts: 3 months → 3 bars, not the 4 calendar months the dates touch. */
  const chartMonthKeys = useMemo(() => {
    if (!paymentStats) return undefined;
    const custom = filters.range === 'custom' ? { startDate: filters.startDate, endDate: filters.endDate } : null;
    return snapshotChartMonthKeys(
      filters.range,
      custom,
      (paymentStats.monthly || []).map(p => p.month),
    );
  }, [paymentStats, filters.range, filters.startDate, filters.endDate]);
  const chartPoints = useMemo(
    () =>
      chartMonthKeys && paymentStats
        ? (alignMonthlyPoints(chartMonthKeys, paymentStats.monthly) as AdminSnapshotMonthlyPoint[])
        : undefined,
    [chartMonthKeys, paymentStats],
  );
  const rangeCustom: SnapshotCustomRange | null =
    filters.range === 'custom' ? { startDate: filters.startDate, endDate: filters.endDate } : null;

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
            <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-label="Summary view">
              {SUMMARY_VIEWS.map(view => (
                <button
                  key={view.value}
                  type="button"
                  aria-pressed={summaryView === view.value}
                  onClick={() => setSummaryView(view.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50 ${
                    summaryView === view.value ? 'bg-wl-brand text-white' : 'bg-surface text-muted ring-1 ring-line'
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-wl-muted">
                {summaryView === 'refunds'
                  ? 'Money returned to students, from Stripe and admin actions. Everything below uses this date range.'
                  : 'Collected, count, chart and the list below all use this date range.'}
              </p>
              <SnapshotRangeControl
                id="payment-range"
                value={filters.range}
                customRange={rangeCustom}
                onChange={changeRange}
              />
            </div>
            {summaryView === 'refunds' ? (
              <div data-testid="refunds-view">
                <SnapshotMetricBody listType="refunds" rangeKey={filters.range} customRange={rangeCustom} />
              </div>
            ) : paymentStatsError ? (
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
                  points={chartPoints}
                  useAmount
                  title="Payments collected per month"
                  emptyLabel="No payments in this range"
                />
              </>
            )}
          </div>
          {summaryView === 'payments' ? (
            <PaymentHistoryList
              filters={filters}
              searchDraft={searchDraft}
              onSearchDraft={setSearchDraft}
              onChange={patchFilters}
              onClear={clearFilters}
              activeCount={activeCount}
              showStripeModeFilter={showStripeModeFilter}
              rangePhrase={snapshotRangePhrase(
                filters.range,
                filters.range === 'custom' ? { startDate: filters.startDate, endDate: filters.endDate } : null,
              )}
              histories={histories}
              totalCount={totalCount}
              loading={loading}
              loadError={loadError}
              onRetryLoad={() => void loadHistories()}
              hasLoaded={hasLoaded}
              statusTotals={statusTotals}
              currentPage={currentPage}
              pageSize={pageSize}
              onPage={page => {
                parsedRef.current = { ...parsedRef.current, page };
                writeParams(parsedRef.current.filters, page, parsedRef.current.pageSize);
              }}
              onPageSize={size => {
                parsedRef.current = { ...parsedRef.current, page: 0, pageSize: size };
                writeParams(parsedRef.current.filters, 0, size);
              }}
              onRetryPayment={item => {
                setSelectedPaymentItem(item);
                setIsRetryModalOpen(true);
              }}
              onRefundPayment={item => {
                setSelectedRefundItem(item);
                setIsRefundModalOpen(true);
              }}
            />
          ) : null}
        </section>
      </div>
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
