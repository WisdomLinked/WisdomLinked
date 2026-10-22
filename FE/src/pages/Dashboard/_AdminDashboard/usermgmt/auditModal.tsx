import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { doGetFullUserDataByEmail, doFilterPaymentHistories } from '../../../../api/api';
import ChatHistory from './chatHistory';
import PaymentHistory from './paymentHistory';
import AuditHeader from './audit/AuditHeader';
import SummaryStrip from './audit/SummaryStrip';
import AuditTabs from './audit/AuditTabs';
import {
  buildConversations,
  buildExportPayload,
  lastActiveFromAccount,
  paymentSummary,
  type AuditTab,
} from './audit/auditModel';
import type { PaymentHistoryRow } from '../payment/paymentHistoryUtils';

const AuditModal = ({
  selectedUser,
  closeModal,
}: {
  selectedUser?: any;
  closeModal: () => void;
}) => {
  const titleId = useId();
  const [userDetails, set_userDetails] = useState<any>();
  const [selectedTab, set_selectedTab] = useState<AuditTab>('chat');
  const [paymentRows, setPaymentRows] = useState<PaymentHistoryRow[]>([]);
  const [paymentCount, setPaymentCount] = useState(0);

  const getFullUserData = useCallback(async (email: string) => {
    const res = await doGetFullUserDataByEmail(email);
    if (res) {
      set_userDetails(res.result);
    }
  }, []);

  useEffect(() => {
    if (selectedUser?.email) {
      void getFullUserData(selectedUser.email);
    }
  }, [selectedUser?.email, getFullUserData]);

  useEffect(() => {
    const email = selectedUser?.email || userDetails?.email;
    if (!email) return;
    let cancelled = false;
    (async () => {
      const pageSize = 100;
      const first = await doFilterPaymentHistories({
        email,
        currentPage: 0,
        numPerPage: pageSize,
        sortBy: 'createdAt',
        sort: 'DESC',
      });
      if (!first || cancelled) return;
      let rows: PaymentHistoryRow[] = [...(first.result || [])];
      const total = first.totalCount || rows.length;
      setPaymentCount(total);
      const pages = Math.ceil(total / pageSize);
      for (let page = 1; page < pages; page += 1) {
        const next = await doFilterPaymentHistories({
          email,
          currentPage: page,
          numPerPage: pageSize,
          sortBy: 'createdAt',
          sort: 'DESC',
        });
        if (cancelled) return;
        if (next?.result) rows = rows.concat(next.result);
      }
      if (!cancelled) setPaymentRows(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedUser?.email, userDetails?.email]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeModal]);

  const conversations = useMemo(() => buildConversations(userDetails), [userDetails]);
  const paySummary = useMemo(() => paymentSummary(paymentRows), [paymentRows]);
  const lastActive = lastActiveFromAccount(userDetails, conversations.all);

  const onExport = () => {
    const payload = buildExportPayload({
      userDetails,
      conversations: conversations.all,
      payments: paymentRows,
      summary: paySummary,
    });
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-${userDetails?.email || 'account'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="absolute inset-0 z-10 flex items-stretch justify-center bg-black/25 sm:items-center sm:p-6">
      <div className="absolute inset-0 cursor-pointer" onClick={closeModal} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden bg-audit-surface sm:h-auto sm:max-h-full sm:rounded-2xl sm:border sm:border-audit-line sm:shadow-xl"
      >
        <AuditHeader userDetails={userDetails || selectedUser} titleId={titleId} onExport={onExport} onClose={closeModal} />
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-8">
          <SummaryStrip
            conversationCount={conversations.group.length + conversations.privateChats.length}
            seminarCount={conversations.seminars.length}
            netEarningsCents={paySummary.net}
            lastActive={lastActive}
          />
          <AuditTabs
            selected={selectedTab}
            onSelect={set_selectedTab}
            chatCount={conversations.all.length}
            paymentCount={paymentCount}
          />
          <div
            role="tabpanel"
            id={`audit-panel-${selectedTab}`}
            aria-labelledby={`audit-tab-${selectedTab}`}
            className="min-h-0 flex-1"
          >
            {selectedTab === 'chat' ? (
              <ChatHistory userDetails={userDetails} />
            ) : (
              <PaymentHistory userDetails={userDetails} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditModal;
