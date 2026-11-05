import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doFilterPaymentHistories, getPricingSettings, listExpertPayroll } from '../../../../api/api';
import PaymentHistoryView from './audit/PaymentHistory';
import {
  auditMoneyRole,
  paymentSummary,
  DEFAULT_AUDIT_RATES,
  type AuditCheque,
  type AuditCommissionRates,
} from './audit/auditModel';
import {
  EMPTY_AUDIT_RANGE,
  isChequeInRange,
  isRangeActive,
  paymentRangeParams,
  type AuditDateRange,
} from './audit/auditDateRange';
import type { PaymentHistoryRow } from '../payment/paymentHistoryUtils';

const PaymentHistory = ({ userDetails, range = EMPTY_AUDIT_RANGE }: { userDetails?: any; range?: AuditDateRange }) => {
  const [numPerPage, set_numPerPage] = useState(5);
  const [currentPage, set_currentPage] = useState(0);
  const [totalCount, set_totalCount] = useState(0);
  const [histories, set_histories] = useState<PaymentHistoryRow[]>([]);
  const [allRows, set_allRows] = useState<PaymentHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<AuditCommissionRates>(DEFAULT_AUDIT_RATES);
  const [cheques, setCheques] = useState<AuditCheque[]>([]);
  const pageSeq = useRef(0);
  const summarySeq = useRef(0);
  const { from, to } = range;
  const rangeParams = useMemo(() => paymentRangeParams({ from, to }), [from, to]);

  useEffect(() => {
    if (typeof getPricingSettings !== 'function') return;
    let cancelled = false;
    (async () => {
      const settings = await getPricingSettings();
      if (cancelled || !settings?.seminar || !settings?.oneToOne) return;
      setRates({
        seminarCommissionPercent: Number(settings.seminar.expertCommissionPercent) || 20,
        oneToOneCommissionPercent: Number(settings.oneToOne.expertCommissionPercent) || 20,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filterHistories = useCallback(
    async (pageNum: number) => {
      if (!userDetails?.email) return;
      const seq = ++pageSeq.current;
      set_currentPage(pageNum);
      setLoading(true);
      const response = await doFilterPaymentHistories({
        email: userDetails.email,
        currentPage: pageNum,
        numPerPage,
        sortBy: 'createdAt',
        sort: 'DESC',
        ...rangeParams,
      });
      if (seq !== pageSeq.current) return;
      if (response) {
        set_histories([...(response.result || [])]);
        set_totalCount(response.totalCount || 0);
      }
      setLoading(false);
    },
    [userDetails?.email, numPerPage, rangeParams],
  );

  const loadSummary = useCallback(async () => {
    if (!userDetails?.email) return;
    const seq = ++summarySeq.current;
    const pageSize = 100;
    const first = await doFilterPaymentHistories({
      email: userDetails.email,
      currentPage: 0,
      numPerPage: pageSize,
      sortBy: 'createdAt',
      sort: 'DESC',
      ...rangeParams,
    });
    if (seq !== summarySeq.current) return;
    if (!first) {
      set_allRows([]);
      return;
    }
    let rows: PaymentHistoryRow[] = [...(first.result || [])];
    const total = first.totalCount || rows.length;
    const pages = Math.ceil(total / pageSize);
    for (let page = 1; page < pages; page += 1) {
      const next = await doFilterPaymentHistories({
        email: userDetails.email,
        currentPage: page,
        numPerPage: pageSize,
        sortBy: 'createdAt',
        sort: 'DESC',
        ...rangeParams,
      });
      if (seq !== summarySeq.current) return;
      if (next?.result) rows = rows.concat(next.result);
    }
    set_allRows(rows);
  }, [userDetails?.email, rangeParams]);

  useEffect(() => {
    const expertId = userDetails?._id;
    if (auditMoneyRole(userDetails?.role) !== 'expert' || !expertId || typeof listExpertPayroll !== 'function') {
      setCheques([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const data = await listExpertPayroll(String(expertId));
      if (!cancelled) setCheques(Array.isArray(data?.cheques) ? data.cheques : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [userDetails?._id, userDetails?.role]);

  useEffect(() => {
    void filterHistories(0);
    void loadSummary();
  }, [filterHistories, loadSummary]);

  const chequesInRange = useMemo(
    () => cheques.filter(cheque => isChequeInRange(cheque, { from, to })),
    [cheques, from, to],
  );

  const summary = useMemo(
    () => paymentSummary(allRows.length ? allRows : histories, auditMoneyRole(userDetails?.role), rates, cheques, chequesInRange),
    [allRows, histories, userDetails?.role, rates, cheques, chequesInRange],
  );

  return (
    <PaymentHistoryView
      rows={histories}
      summary={summary}
      cheques={chequesInRange}
      rangeActive={isRangeActive(range)}
      rates={rates}
      totalCount={totalCount}
      currentPage={currentPage}
      pageSize={numPerPage}
      loading={loading}
      onPage={page => {
        void filterHistories(page);
      }}
      onPageSize={size => {
        set_numPerPage(size);
        set_currentPage(0);
      }}
    />
  );
};

export default PaymentHistory;
