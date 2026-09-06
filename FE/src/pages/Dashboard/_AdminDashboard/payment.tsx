import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { showErrorAlert, showSuccessAlert } from "../../../actions/alertActions";
import { doFilterPaymentHistories, getStripeMode, setStripeMode, setSeminarApprovalDeadline, setPaymentWindow, sendPaymentLinkToUser, processRefund, sendAdHocPaymentLink, doGetPaymentIntegrityReport } from "../../../api/api";
import { SetLoadingStatus } from "../../../actions/appActions";
import SelectionWithCheckBox from "../../../components/SelectionWithCheckBox";
import { DateRangePicker, createStaticRanges } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import Pagination from "../../../components/Pagination";
import { formatDateYYYY_MM_DD_h_m } from "../../../actions/common";
import RetryPaymentModal from "../../../components/RetryPaymentModal";
import RefundPaymentModal from "../../../components/RefundPaymentModal";
import AdHocPaymentModal from "../../../components/AdHocPaymentModal";

const STATUS_LABELS: Record<string, string> = {
    withheld: 'Withheld',
    pending: 'Pending',
    completed: 'Completed',
    released: 'Released',
    failed: 'Failed',
    refunded: 'Refunded',
};

const STATUS_STYLES: Record<string, string> = {
    withheld: 'bg-amber-500/20 text-amber-600',
    pending: 'bg-yellow-500/20 text-yellow-500',
    completed: 'bg-green/20 text-green',
    released: 'bg-slate-500/20 text-slate-600',
    failed: 'bg-red-500/20 text-red-500',
    refunded: 'bg-blue-500/20 text-blue-500',
};

const STATUS_HINTS: Record<string, string> = {
    withheld: 'Card authorized, not charged — waiting on the host or expert to decide.',
    pending: 'A capture is in flight, or the row needs manual reconciliation.',
    completed: 'Money captured and settled.',
    released: 'Authorization released. The card was never charged.',
    failed: 'The payment did not go through.',
    refunded: 'Money was captured, then returned to the customer.',
};

const eventTypeLabel = (item: any) => {
    if (item?.event) return 'Event';
    const type = item?.groupChat?.type;
    if (type === 'seminar') return 'Seminar';
    if (type === 'individual') return '1:1 Session';
    if (type) return 'Chat';
    return item?.groupChat ? 'Session' : '—';
};

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const currentDate = new Date().getDate();

const Payment = () => {
    const dispatch = useDispatch();
    const modes = [
        {
            value: "",
            label: "All"
        },
        {
            value: "test",
            label: "Test"
        },
        {
            value: "live",
            label: "Live"
        }
    ]
    const types = [
        {
            value: "",
            label: "All"
        },
        {
            value: "charge",
            label: "Charge"
        },
        {
            value: "refund",
            label: "Refund"
        }
    ]
    const statuses = [
        {
            value: "",
            label: "All"
        },
        {
            value: "withheld",
            label: "Withheld"
        },
        {
            value: "pending",
            label: "Pending"
        },
        {
            value: "completed",
            label: "Completed"
        },
        {
            value: "released",
            label: "Released"
        },
        {
            value: "failed",
            label: "Failed"
        },
        {
            value: "refunded",
            label: "Refunded"
        }
    ]
    const pageSizeOptions = [
        { value: 5, label: "5" },
        { value: 10, label: "10" },
        { value: 25, label: "25" },
        { value: 50, label: "50" },
    ]
    const [stripeMode, set_stripeMode] = useState('test');
    const [approvalDeadlineHours, set_approvalDeadlineHours] = useState<number>(24);
    const [deadlineInput, set_deadlineInput] = useState<string>('24');
    const [paymentWindowHours, set_paymentWindowHours] = useState<number>(48);
    const [paymentWindowInput, set_paymentWindowInput] = useState<string>('48');
    const [integrityReport, set_integrityReport] = useState<any>(null);
    const [integrityLoading, set_integrityLoading] = useState(false);
    const [email, set_email] = useState('');
    const [selectedMode, set_selectedMode] = useState(modes[0]);
    const [selectedType, set_selectedType] = useState(types[0]);
    const [selectedStatus, set_selectedStatus] = useState(statuses[0]);
    const [dateRange, set_dateRange] = useState({
        dateFrom: '',
        dateTo: '',
    });
    const [datePickerShow, set_datePickerShow] = useState(false);

    const [numPerPage, set_numPerPage] = useState(5)
    const [currentPage, set_currentPage] = useState(0)
    const [totalCount, set_totalCount] = useState(-1)
    const [totalPage, set_totalPage] = useState(0)
    const [histories, set_histories] = useState<Array<any>>([])
    const [isFirstLoad, set_isFirstLoad] = useState(true)
    const [isRetryModalOpen, setIsRetryModalOpen] = useState(false)
    const [selectedPaymentItem, setSelectedPaymentItem] = useState<any>(null)
    const [isRefundModalOpen, setIsRefundModalOpen] = useState(false)
    const [selectedRefundItem, setSelectedRefundItem] = useState<any>(null)
    const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false)

    const customStaticRanges = [
        ...createStaticRanges([
            {
                label: ' Last month',
                range: () => ({
                    startDate: new Date(currentYear, currentMonth - 2, currentDate - 1),
                    endDate: new Date(currentYear, currentMonth - 1, currentDate - 1),
                }),
            },
            {
                label: 'Last quarter',
                range: () => ({
                    startDate: new Date(currentYear, currentMonth - 4, currentDate - 1),
                    endDate: new Date(currentYear, currentMonth - 1, currentDate - 1),
                }),
            },
            {
                label: 'Last 6 months',
                range: () => ({
                    startDate: new Date(currentYear, currentMonth - 7, currentDate - 1),
                    endDate: new Date(currentYear, currentMonth - 1, currentDate - 1),
                }),
            },
            {
                label: 'Last year',
                range: () => ({
                    startDate: new Date(currentYear - 1, currentMonth - 1, currentDate - 1),
                    endDate: new Date(currentYear, currentMonth - 1, currentDate - 1),
                }),
            },
        ]),
    ];

    const formatDateYYYY_MM_DD = (dateString: string) => {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = `0${date.getMonth() + 1}`.slice(-2);
        const day = `0${date.getDate()}`.slice(-2);
        return `${year}-${month}-${day}`;
    };

    const [selectionRange, set_selectionRange] = useState({
        startDate: new Date(),
        endDate: new Date(),
        key: 'selection',
    });

    const clearDateRange = () => {
        set_dateRange({
            dateFrom: '',
            dateTo: '',
        });
        set_selectionRange({
            startDate: new Date(),
            endDate: new Date(),
            key: 'selection',
        });
    };

    const handleSelect = (ranges: any) => {
        console.log(ranges);
        set_dateRange({
            dateFrom: formatDateYYYY_MM_DD(ranges.selection.startDate),
            dateTo: formatDateYYYY_MM_DD(ranges.selection.endDate),
        });
        set_selectionRange({
            startDate: new Date(ranges.selection.startDate),
            endDate: new Date(ranges.selection.endDate),
            key: 'selection',
        });
    };

    const updateStripeMode = async (stripeMode: string) => {
        SetLoadingStatus(true)
        const response = await setStripeMode({ stripeMode });
        console.log(response, '///////');
        set_stripeMode(stripeMode);
        SetLoadingStatus(false)
    }

    const getCurrentStripeMode = async () => {
        const response = await getStripeMode();
        console.log(response, '///////');
        if (response) {
            set_stripeMode(response.stripeMode || 'test');
            const hours = typeof response.seminarApprovalDeadlineHours === 'number'
                ? response.seminarApprovalDeadlineHours
                : 24;
            set_approvalDeadlineHours(hours);
            set_deadlineInput(String(hours));
            const windowHours = typeof response.paymentWindowHours === 'number'
                ? response.paymentWindowHours
                : 48;
            set_paymentWindowHours(windowHours);
            set_paymentWindowInput(String(windowHours));
        }
    }

    const saveApprovalDeadline = async () => {
        const hours = Number(deadlineInput);
        if (!Number.isFinite(hours) || hours < 0 || hours > 168) {
            dispatch(showErrorAlert('Enter a value between 0 and 168 hours.'));
            return;
        }
        SetLoadingStatus(true);
        const response = await setSeminarApprovalDeadline(hours);
        SetLoadingStatus(false);
        if (response === false || response?.error) {
            dispatch(showErrorAlert(response?.error || 'Could not save the approval deadline.'));
            return;
        }
        set_approvalDeadlineHours(hours);
        dispatch(showSuccessAlert('Seminar approval deadline updated.'));
    }

    const savePaymentWindow = async () => {
        const hours = Number(paymentWindowInput);
        if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
            dispatch(showErrorAlert('Enter a value between 1 and 168 hours.'));
            return;
        }
        SetLoadingStatus(true);
        const response = await setPaymentWindow(hours);
        SetLoadingStatus(false);
        if (response === false || response?.error) {
            dispatch(showErrorAlert(response?.error || 'Could not save the payment window.'));
            return;
        }
        set_paymentWindowHours(hours);
        dispatch(showSuccessAlert('Payment window updated.'));
    }

    const loadIntegrityReport = async () => {
        set_integrityLoading(true);
        try {
            const res = await doGetPaymentIntegrityReport(true);
            if (res && res.summary) {
                set_integrityReport(res);
            } else {
                set_integrityReport(null);
                if (res !== false) {
                    dispatch(showErrorAlert('Could not load payment integrity report.'));
                }
            }
        } catch (err) {
            console.error(err);
            set_integrityReport(null);
            dispatch(showErrorAlert('Could not load payment integrity report.'));
        } finally {
            set_integrityLoading(false);
        }
    }

    useEffect(() => {
        getCurrentStripeMode();
        loadIntegrityReport();
    }, [])

    const filterHisotries = async (pageNum: number) => {
        set_currentPage(pageNum)
        SetLoadingStatus(true)
        const response = await doFilterPaymentHistories({
            currentPage: pageNum,
            numPerPage: numPerPage,
            email: email,
            stripeMode: selectedMode.value,
            paymentType: selectedType.value,
            status: selectedStatus.value,
            dateFrom: dateRange.dateFrom,
            dateTo: dateRange.dateTo,
            sortBy: 'createdAt',
            sort: 'DESC',
        })
        if (response) {
            console.log(response, '/////')
            set_histories([...response.result])
            set_totalCount(response.totalCount)
            set_totalPage(response.totalCount % numPerPage ? Math.floor(response.totalCount / numPerPage) : response.totalCount / numPerPage - 1)
        }
        set_isFirstLoad(false)
        SetLoadingStatus(false)
    }

    useEffect(() => {
        if (!isFirstLoad) {
            let timer = setTimeout(() => {
                filterHisotries(0)
            }, 500)
            return (() => clearTimeout(timer))
        }
    }, [dateRange, email, selectedMode, selectedType, selectedStatus])

    useEffect(() => {
        if (!isFirstLoad) {
            filterHisotries(0)
        }
    }, [numPerPage])

    useEffect(() => {
        if (!isFirstLoad) {
            filterHisotries(currentPage)
        }
    }, [currentPage])

    useEffect(() => {
        filterHisotries(0)
    }, [])

    const handleRetryPaymentClick = (paymentItem: any) => {
        setSelectedPaymentItem(paymentItem);
        setIsRetryModalOpen(true);
    };

    const handleRetryModalClose = () => {
        setIsRetryModalOpen(false);
        setSelectedPaymentItem(null);
    };

    const handleRefundClick = (paymentItem: any) => {
        setSelectedRefundItem(paymentItem);
        setIsRefundModalOpen(true);
    };

    const handleRefundModalClose = () => {
        setIsRefundModalOpen(false);
        setSelectedRefundItem(null);
    };

    const handleAdHocPaymentClick = () => {
        setIsAdHocModalOpen(true);
    };

    const handleAdHocModalClose = () => {
        setIsAdHocModalOpen(false);
    };

    const handleRetryPaymentConfirm = async (customizedPayment: {
        amount: number;
        description: string;
        customerEmail: string;
    }) => {
        try {
            SetLoadingStatus(true);
            
            const response = await sendPaymentLinkToUser({
                paymentHistoryId: selectedPaymentItem._id,
                customerEmail: customizedPayment.customerEmail,
                customAmount: Math.round(customizedPayment.amount * 100),
                customDescription: customizedPayment.description
            });
            
            if (response?.status === 'SUCCESS') {
                dispatch(showSuccessAlert('Payment link has been sent successfully to the customer.'));
                handleRetryModalClose();
            } else {
                const errorMessage = typeof response?.message === 'string' 
                    ? response.message 
                    : 'Unknown error';
                dispatch(showErrorAlert('Failed to send payment link: ' + errorMessage));
            }
        } catch (error: any) {
            console.error('Error sending payment link:', error);
            const errorMessage = typeof error?.message === 'string' 
                ? error.message 
                : typeof error === 'string'
                ? error
                : 'An unexpected error occurred';
            dispatch(showErrorAlert('Failed to send payment link: ' + errorMessage));
        } finally {
            SetLoadingStatus(false);
        }
    };

    const handleRefundConfirm = async (refundData: {
        amount: number;
        reason: string;
    }) => {
        try {
            SetLoadingStatus(true);
            
            const response = await processRefund({
                paymentHistoryId: selectedRefundItem._id,
                refundAmount: refundData.amount,
                refundReason: refundData.reason
            });
            
            if (response?.status === 'SUCCESS') {
                dispatch(showSuccessAlert('Refund processed successfully.'));
                handleRefundModalClose();
                // Refresh the payment history to show the refund
                filterHisotries(currentPage);
            } else {
                const errorMessage = typeof response?.message === 'string' 
                    ? response.message 
                    : 'Unknown error';
                dispatch(showErrorAlert('Failed to process refund: ' + errorMessage));
            }
        } catch (error: any) {
            console.error('Error processing refund:', error);
            const errorMessage = typeof error?.message === 'string' 
                ? error.message 
                : typeof error === 'string'
                ? error
                : 'An unexpected error occurred';
            dispatch(showErrorAlert('Failed to process refund: ' + errorMessage));
        } finally {
            SetLoadingStatus(false);
        }
    };

    const handleAdHocPaymentConfirm = async (paymentData: {
        amount: number;
        description: string;
        customerEmail: string;
        customerName?: string;
    }) => {
        try {
            SetLoadingStatus(true);
            
            const response = await sendAdHocPaymentLink({
                amount: paymentData.amount,
                description: paymentData.description,
                customerEmail: paymentData.customerEmail,
                customerName: paymentData.customerName
            });
            
            if (response?.status === 'SUCCESS') {
                dispatch(showSuccessAlert('Payment link sent successfully to customer.'));
                handleAdHocModalClose();
                // Refresh the payment history to show the new pending payment
                filterHisotries(currentPage);
            } else {
                const errorMessage = typeof response?.message === 'string' 
                    ? response.message 
                    : 'Unknown error';
                dispatch(showErrorAlert('Failed to send payment link: ' + errorMessage));
            }
        } catch (error: any) {
            console.error('Error sending ad-hoc payment link:', error);
            const errorMessage = typeof error?.message === 'string' 
                ? error.message 
                : typeof error === 'string'
                ? error
                : 'An unexpected error occurred';
            dispatch(showErrorAlert('Failed to send payment link: ' + errorMessage));
        } finally {
            SetLoadingStatus(false);
        }
    };

    return (
        <div className="w-full h-full pt-10 overflow-y-auto text-wl-ink px-[18px]">
            <div className="w-full max-w-[1500px] mx-auto text-wl-ink">
                <div className="text-center text-2xl font-semibold text-wl-brand">Payment Management</div>
                <div className="flex items-center justify-center space-x-6 mt-6">
                    <div className="text-wl-muted">Toggle Stripe Mode</div>
                    <div className="rounded-full border border-wl-line overflow-hidden bg-wl-card shadow-sm">
                        <button
                            className={`w-16 h-8 text-sm font-medium ${stripeMode === 'test' ? 'bg-wl-brand text-white' : 'text-wl-muted hover:bg-wl-pageAlt'}`}
                            disabled={stripeMode === 'test'}
                            onClick={() => updateStripeMode('test')}
                        >
                            Test
                        </button>
                        <button
                            className={`w-16 h-8 text-sm font-medium ${stripeMode === 'live' ? 'bg-wl-brand text-white' : 'text-wl-muted hover:bg-wl-pageAlt'}`}
                            disabled={stripeMode === 'live'}
                            onClick={() => updateStripeMode('live')}
                        >
                            Live
                        </button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                    <div className="text-wl-muted">Seminar seat-request approval deadline (hours before start)</div>
                    <input
                        type="number"
                        min={0}
                        max={168}
                        value={deadlineInput}
                        onChange={(e) => set_deadlineInput(e.target.value)}
                        className="w-24 rounded-[10px] h-9 bg-white border border-lightgrey text-[14px] px-3 text-wl-ink"
                    />
                    <button
                        onClick={saveApprovalDeadline}
                        disabled={String(approvalDeadlineHours) === deadlineInput.trim()}
                        className="h-9 rounded-full bg-wl-brand px-4 text-sm font-medium text-white disabled:opacity-50"
                    >
                        Save
                    </button>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
                    <div className="text-wl-muted">Booking payment window (hours before session start)</div>
                    <input
                        type="number"
                        min={1}
                        max={168}
                        value={paymentWindowInput}
                        onChange={(e) => set_paymentWindowInput(e.target.value)}
                        className="w-24 rounded-[10px] h-9 bg-white border border-lightgrey text-[14px] px-3 text-wl-ink"
                    />
                    <button
                        onClick={savePaymentWindow}
                        disabled={String(paymentWindowHours) === paymentWindowInput.trim()}
                        className="h-9 rounded-full bg-wl-brand px-4 text-sm font-medium text-white disabled:opacity-50"
                    >
                        Save
                    </button>
                </div>

                <div className="mt-6 max-w-[1100px] mx-auto rounded-2xl border border-wl-line bg-wl-card shadow-sm p-4 text-left">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="text-lg font-semibold text-wl-brand">Payment integrity</div>
                            <p className="text-sm text-wl-muted mt-0.5">
                                Actionable mismatches: unpaid seats, refunded-but-enrolled, and stuck pending charges.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={loadIntegrityReport}
                            disabled={integrityLoading}
                            className="h-9 rounded-full border border-wl-line bg-white px-4 text-sm font-medium text-wl-brand hover:bg-wl-brandSoft disabled:opacity-50"
                        >
                            {integrityLoading ? 'Refreshing…' : 'Refresh'}
                        </button>
                    </div>
                    {integrityLoading && !integrityReport ? (
                        <p className="mt-4 text-sm text-wl-muted">Loading integrity report…</p>
                    ) : integrityReport ? (
                        <>
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                                {(['unpaid', 'refunded', 'in_flight', 'withheld', 'paid', 'free'] as const).map((key) => (
                                    <div key={key} className="rounded-xl border border-wl-line bg-wl-pageAlt/60 px-3 py-2 text-center">
                                        <div className="text-[10px] uppercase tracking-wide text-wl-muted">{key.replace('_', ' ')}</div>
                                        <div className="text-lg font-semibold tabular-nums text-wl-ink">
                                            {integrityReport.summary?.[key] ?? 0}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-2 text-xs text-wl-muted">
                                Scanned {integrityReport.bookingsScanned ?? 0} paid bookings
                                {integrityReport.lookbackDays ? ` (last ${integrityReport.lookbackDays} days)` : ''}
                                {integrityReport.truncated ? ' — truncated' : ''}.
                            </p>
                            {(integrityReport.rows?.length > 0 || integrityReport.stuckPendingPayments?.length > 0) ? (
                                <div className="mt-4 space-y-4">
                                    {integrityReport.rows?.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <div className="text-sm font-medium text-wl-ink mb-2">Booking mismatches</div>
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs uppercase bg-wl-brandSoft text-wl-brand">
                                                    <tr>
                                                        <th className="px-3 py-2">Verdict</th>
                                                        <th className="px-3 py-2">Session</th>
                                                        <th className="px-3 py-2">Type</th>
                                                        <th className="px-3 py-2">Customer</th>
                                                        <th className="px-3 py-2">Expert</th>
                                                        <th className="px-3 py-2 text-right">Price</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {integrityReport.rows.slice(0, 50).map((row: any, i: number) => (
                                                        <tr key={`${row.groupChatId}-${row.customer}-${i}`} className="border-b border-wl-line">
                                                            <td className="px-3 py-2">
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                                    row.verdict === 'unpaid' ? 'bg-red-500/15 text-red-600' :
                                                                    row.verdict === 'refunded' ? 'bg-blue-500/15 text-blue-600' :
                                                                    'bg-amber-500/15 text-amber-700'
                                                                }`}>
                                                                    {row.verdict}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 max-w-[180px] truncate" title={row.name}>{row.name}</td>
                                                            <td className="px-3 py-2">{row.type}</td>
                                                            <td className="px-3 py-2">{row.customerEmail || row.customer}</td>
                                                            <td className="px-3 py-2">{row.expertEmail || row.expert}</td>
                                                            <td className="px-3 py-2 text-right tabular-nums">
                                                                {typeof row.priceCents === 'number' ? (row.priceCents / 100).toFixed(2) : '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : null}
                                    {integrityReport.stuckPendingPayments?.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <div className="text-sm font-medium text-wl-ink mb-2">Stuck pending payments (&gt;1h)</div>
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs uppercase bg-wl-brandSoft text-wl-brand">
                                                    <tr>
                                                        <th className="px-3 py-2">Updated</th>
                                                        <th className="px-3 py-2">Amount</th>
                                                        <th className="px-3 py-2">Mode</th>
                                                        <th className="px-3 py-2">Intent</th>
                                                        <th className="px-3 py-2">Description</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {integrityReport.stuckPendingPayments.slice(0, 30).map((row: any, i: number) => (
                                                        <tr key={`${row.paymentIntent || i}`} className="border-b border-wl-line">
                                                            <td className="px-3 py-2 whitespace-nowrap">
                                                                {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}
                                                            </td>
                                                            <td className="px-3 py-2 tabular-nums">
                                                                {typeof row.amount === 'number' ? `${(row.amount / 100).toFixed(2)} ${row.currency || ''}`.trim() : '—'}
                                                            </td>
                                                            <td className="px-3 py-2">{row.stripeMode}</td>
                                                            <td className="px-3 py-2 font-mono text-xs">{row.paymentIntent || 'N/A'}</td>
                                                            <td className="px-3 py-2 max-w-[220px] truncate" title={row.description}>{row.description || '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <p className="mt-4 text-sm text-green">No actionable payment mismatches found.</p>
                            )}
                        </>
                    ) : (
                        <p className="mt-4 text-sm text-wl-muted">Integrity report unavailable.</p>
                    )}
                </div>

                <div className="max-w-[800px] mx-auto w-full py-1">
                    <div className="flex justify-between mt-4">
                        <div className="w-[calc(100%-174px)] sm:w-[calc(100%-324px)]">
                            <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by email</div>
                            <input
                                className="w-full rounded-[15px] h-[50px] bg-white border border-lightgrey text-[14px] leading-[21px] px-[24px] text-wl-ink placeholder:text-grey"
                                placeholder="Input email"
                                value={email}
                                onChange={(e) => set_email(e.target.value)}
                            />
                        </div>
                        <div className="w-[150px] sm:w-[300px]">
                            <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by stripe Mode</div>
                            <SelectionWithCheckBox
                                options={modes}
                                selectedOptions={selectedMode}
                                set_selectedOptions={set_selectedMode}
                                placeholder="Filter by mode"
                                isMulti={false}
                            />
                        </div>
                    </div>
                    <div className="flex justify-between mt-2">
                        <div className="w-[calc(100%-174px)] sm:w-[calc(100%-324px)] relative">
                            <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by status</div>
                            <SelectionWithCheckBox
                                options={statuses}
                                selectedOptions={selectedStatus}
                                set_selectedOptions={set_selectedStatus}
                                placeholder="Filter by status"
                                isMulti={false}
                            />
                        </div>
                        <div className="w-[150px] sm:w-[300px]">
                            <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by payment type</div>
                            <SelectionWithCheckBox
                                options={types}
                                selectedOptions={selectedType}
                                set_selectedOptions={set_selectedType}
                                placeholder="Filter by type"
                                isMulti={false}
                            />
                        </div>
                    </div>
                    <div className="flex justify-between mt-2">
                        <div className="w-[calc(100%-174px)] sm:w-[calc(100%-324px)] relative">
                            <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Time periods</div>
                            <div
                                className={`w-full rounded-[15px] h-[50px] bg-white border border-lightgrey text-[14px] leading-[21px] px-[24px] flex items-center justify-between cursor-pointer ${dateRange.dateFrom && dateRange.dateTo
                                    ? 'text-wl-ink'
                                    : 'text-wl-muted hover:text-wl-ink'
                                    }`}
                                onClick={() => set_datePickerShow(!datePickerShow)}
                            >

                                <div className="w-[calc(100%-30px)] text-[13px] leading-[16px] sm:text-[16px] sm:leading-[20px] flex justify-between items-center">
                                    {dateRange.dateFrom && dateRange.dateTo ? (
                                        <span>
                                            {dateRange.dateFrom} ~ {dateRange.dateTo}
                                        </span>
                                    ) : (
                                        <span>Date Range</span>
                                    )}
                                    <button
                                        className={`ml-3 text-[16px] leading-[20px] font-bold tracking-[-0.18px] z-10 text-green ${dateRange.dateFrom && dateRange.dateTo ? 'hidden sm:block' : 'hidden'
                                            }`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            clearDateRange();
                                        }}
                                    >
                                        Clear
                                    </button>
                                </div>
                                <svg
                                    className={`${datePickerShow ? 'rotate-180' : ''} transition-all`}
                                    width="14"
                                    height="9"
                                    viewBox="0 0 14 9"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M13.7812 1.46094C13.9375 1.58594 13.9375 1.83594 13.7812 1.99219L7.25 8.52344C7.09375 8.67969 6.875 8.67969 6.71875 8.52344L0.1875 1.99219C0.03125 1.83594 0.03125 1.58594 0.1875 1.46094L0.78125 0.835938C0.9375 0.679688 1.1875 0.679688 1.3125 0.835938L7 6.49219L12.6562 0.835938C12.7812 0.679688 13.0312 0.679688 13.1875 0.835938L13.7812 1.46094Z"
                                        fill="currentColor"
                                    />
                                </svg>
                            </div>
                            {datePickerShow ? (
                                <>
                                    <div
                                        className="fixed top-0 left-0 z-10 w-full h-full"
                                        onClick={() => set_datePickerShow(false)}
                                    ></div>
                                    <div
                                        id="dateRangePickerInSearch"
                                        className={`left-0 absolute top-20 md:top-[80px] border border-[#CECECE] text-darkgrey w-fit z-10 pb-0`}
                                    >
                                        <DateRangePicker
                                            rangeColors={['#31B099']}
                                            ranges={[selectionRange]}
                                            onChange={handleSelect}
                                            staticRanges={customStaticRanges}
                                            inputRanges={[]}
                                            direction="vertical"
                                        />
                                        {dateRange.dateFrom && dateRange.dateTo ? (
                                            <button
                                                className={`left-7 absolute hidden sm:block bottom-7  text-[16px] leading-[20px] font-bold tracking-[-0.18px] text-darkgrey`}
                                                onClick={clearDateRange}
                                            >
                                                Reset
                                            </button>
                                        ) : null}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
                <div className="w-full rounded-2xl border border-wl-line bg-wl-card shadow-sm overflow-hidden mt-4">
                    <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 gap-4 border-b border-wl-line bg-wl-pageAlt/50">
                        <div>
                            <div className="text-wl-ink font-medium">Total of {totalCount} histories</div>
                        </div>
                        <Pagination
                            currentPage={currentPage}
                            totalPage={totalPage}
                            goFirst={() => set_currentPage(0)}
                            goPrev={() => set_currentPage((currentPage - 1) || 0)}
                            goNext={() => set_currentPage(currentPage < totalPage ? currentPage + 1 : totalPage)}
                            goLast={() => set_currentPage(totalPage)}
                        />
                    </div>
                    
                    {/* Ad-hoc Payment Button */}
                    <div className="flex justify-end px-4 mb-4">
                        <button
                            onClick={handleAdHocPaymentClick}
                            className="bg-wl-brand hover:brightness-95 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            title="Send custom payment request to any customer"
                        >
                            Send Ad-hoc Payment
                        </button>
                    </div>
                    
                    <div className="relative overflow-x-auto w-full px-4">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-wl-brandSoft text-wl-brand">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        No
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Date
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Amount
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Currency
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Expert
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Customer
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Event Type
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Description
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Mode
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Payment Type
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Status
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Payment Intent
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-center">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {
                                    histories.map((item, index) => {
                                        return (
                                            <tr key={index} className="border-b border-wl-line hover:bg-wl-pageAlt text-wl-ink">
                                                <td className='py-2 px-2 text-center'>{numPerPage * currentPage + index + 1}</td>
                                                <td className='px-2'>{formatDateYYYY_MM_DD_h_m(new Date(item.createdAt))}</td>
                                                <td className='text-center px-2'>{item.amount / 100}</td>
                                                <td className='text-center px-2'>{item.currency}</td>
                                                <td className='text-center px-2'>{item.expert?.email}</td>
                                                <td className='text-center px-2'>{item.customer?.email}</td>
                                                <td className='px-2 text-center'>{eventTypeLabel(item)}</td>
                                                <td className='px-2 max-w-[200px] truncate'>{item.description}</td>
                                                <td className='px-2 text-center'>{item.stripeMode}</td>
                                                <td className='px-2 text-center'>{item.paymentType}</td>
                                                <td className='px-2 text-center'>
                                                    <span
                                                        className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[item.status] || 'bg-grey/20 text-grey'}`}
                                                        title={STATUS_HINTS[item.status] || ''}
                                                    >
                                                        {STATUS_LABELS[item.status] || item.status || 'Completed'}
                                                    </span>
                                                </td>
                                                <td className='px-2'>{item.paymentIntent || 'N/A'}</td>
                                                <td className='px-2 text-center'>
                                                    <div className="flex gap-2 justify-center">
                                                        {/* Show Retry button only for non-refunded payments and non-refund records */}
                                                        {item.status !== 'refunded' && item.status !== 'withheld' && item.status !== 'released' && item.paymentType !== 'refund' && item.paymentType !== 'retry' && (
                                                            <button
                                                                onClick={() => handleRetryPaymentClick(item)}
                                                                className='bg-green hover:bg-green/80 text-white px-3 py-1 rounded text-sm font-medium transition-colors'
                                                                title='Customize and send new payment link'
                                                            >
                                                                Retry
                                                            </button>
                                                        )}
                                                        {/* Show Refund button only for completed payments that are not refund records */}
                                                        {item.status === 'completed' && 
                                                         item.paymentIntent && 
                                                         item.paymentType !== 'refund' && (
                                                            <button
                                                                onClick={() => handleRefundClick(item)}
                                                                className='bg-red hover:bg-red/80 text-white px-3 py-1 rounded text-sm font-medium transition-colors'
                                                                title='Process refund for this payment'
                                                            >
                                                                Refund
                                                            </button>
                                                        )}
                                                        {item.status === 'withheld' && (
                                                            <span className="text-grey text-sm italic">Awaiting decision</span>
                                                        )}
                                                        {(item.status === 'refunded' || item.status === 'released' || item.paymentType === 'refund') && (
                                                            <span className="text-grey text-sm italic">No actions available</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                }
                            </tbody>
                        </table>
                    </div>
                    <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 gap-4">
                        <div className="w-full max-w-[200px]">
                            <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Show rows</div>
                            <SelectionWithCheckBox
                                options={pageSizeOptions}
                                selectedOptions={
                                    pageSizeOptions.find((o) => o.value === numPerPage) ?? pageSizeOptions[0]
                                }
                                set_selectedOptions={(opt: { value: number }) => set_numPerPage(opt.value)}
                                placeholder="Rows per page"
                                isMulti={false}
                            />
                        </div>
                        <Pagination
                            currentPage={currentPage}
                            totalPage={totalPage}
                            goFirst={() => set_currentPage(0)}
                            goPrev={() => set_currentPage((currentPage - 1) || 0)}
                            goNext={() => set_currentPage(currentPage < totalPage ? currentPage + 1 : totalPage)}
                            goLast={() => set_currentPage(totalPage)}
                        />
                    </div>
                </div>
            </div>
            <RetryPaymentModal
                paymentItem={selectedPaymentItem}
                isOpen={isRetryModalOpen}
                onClose={handleRetryModalClose}
                onConfirm={handleRetryPaymentConfirm}
            />
            <RefundPaymentModal
                paymentItem={selectedRefundItem}
                isOpen={isRefundModalOpen}
                onClose={handleRefundModalClose}
                onConfirm={handleRefundConfirm}
            />
            <AdHocPaymentModal
                isOpen={isAdHocModalOpen}
                onClose={handleAdHocModalClose}
                onConfirm={handleAdHocPaymentConfirm}
            />
        </div>
    );
};

export default Payment;
