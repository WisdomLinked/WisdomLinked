import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { doFilterPaymentHistories } from '../../../../api/api';
import PaymentHistoryView from './audit/PaymentHistory';
import { paymentSummary } from './audit/auditModel';
import type { PaymentHistoryRow } from '../payment/paymentHistoryUtils';

const PaymentHistory = ({ userDetails }: { userDetails?: any }) => {
  const [numPerPage, set_numPerPage] = useState(5);
  const [currentPage, set_currentPage] = useState(0);
  const [totalCount, set_totalCount] = useState(0);
  const [histories, set_histories] = useState<PaymentHistoryRow[]>([]);
  const [allRows, set_allRows] = useState<PaymentHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const filterHistories = useCallback(
    async (pageNum: number) => {
      if (!userDetails?.email) return;
      set_currentPage(pageNum);
      setLoading(true);
      const response = await doFilterPaymentHistories({
        email: userDetails.email,
        currentPage: pageNum,
        numPerPage,
        sortBy: 'createdAt',
        sort: 'DESC',
      });
      if (response) {
        set_histories([...(response.result || [])]);
        set_totalCount(response.totalCount || 0);
      }
      setLoading(false);
    },
    [userDetails?.email, numPerPage],
  );

  const loadSummary = useCallback(async () => {
    if (!userDetails?.email) return;
    const pageSize = 100;
    const first = await doFilterPaymentHistories({
      email: userDetails.email,
      currentPage: 0,
      numPerPage: pageSize,
      sortBy: 'createdAt',
      sort: 'DESC',
    });
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
      });
      if (next?.result) rows = rows.concat(next.result);
    }
    set_allRows(rows);
  }, [userDetails?.email]);

  useEffect(() => {
    void filterHistories(0);
    void loadSummary();
  }, [filterHistories, loadSummary]);

  const summary = useMemo(() => paymentSummary(allRows.length ? allRows : histories), [allRows, histories]);

  return (
    <PaymentHistoryView
      rows={histories}
      summary={summary}
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
