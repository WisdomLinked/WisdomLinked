import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminMetricsPanel from './AdminMetricsPanel';
import type { SnapshotListType } from './adminSnapshotTypes';
import { doGetAdminDashboardStats, type AdminDashboardStatsData } from '../../api/api';
import {
  DEFAULT_SNAPSHOT_RANGE,
  resolveSnapshotSelection,
  snapshotRangeBounds,
  snapshotRangeQuery,
  type SnapshotCustomRange,
  type SnapshotRangeKey,
} from '../../utils/adminSnapshotRange';
import { DASHBOARD_PAGE_TITLE } from './pageTitle';

const emptyStats: AdminDashboardStatsData = {
  pendingApprovals: 0,
  newContactMessages: 0,
  unansweredChatbotQuestions: 0,
  expertCount: 0,
  customerCount: 0,
  oneOnOneSessions: 0,
  seminarsHeld: 0,
  totalPayments: 0,
  refundCount: 0,
  todayUpcomingEvents: 0,
};

/**
 * Admin Analytics — People + Sessions snapshot (Experts, Students, 1:1, Seminars).
 * Payments / Refunds stay on Overview.
 */
export default function AdminAnalytics({
  go,
}: {
  go: (id: string, search?: string) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { rangeKey, customRange } = resolveSnapshotSelection(searchParams);
  const [stats, setStats] = useState<AdminDashboardStatsData>(emptyStats);
  const [statsLoading, setStatsLoading] = useState(true);

  const writeRange = (next: SnapshotRangeKey, custom?: SnapshotCustomRange) => {
    const params: Record<string, string> = { range: next };
    if (next === 'custom' && custom) {
      params.startDate = custom.startDate;
      params.endDate = custom.endDate;
    }
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    if (!searchParams.get('range')) {
      setSearchParams({ range: DEFAULT_SNAPSHOT_RANGE }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      const res = await doGetAdminDashboardStats(snapshotRangeBounds(rangeKey, new Date(), customRange));
      if (!cancelled && res?.status === 'SUCCESS' && res.data) {
        setStats(res.data);
      }
      if (!cancelled) setStatsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [rangeKey, customRange?.startDate, customRange?.endDate]);

  return (
    <div className="px-4 py-7 sm:px-6">
      <div className="mx-auto max-w-[1400px] space-y-8">
        <section className="text-left">
          <h2 className={DASHBOARD_PAGE_TITLE}>Analytics</h2>
          <p className="mt-1 text-sm text-wl-muted">
            Experts, students, 1:1 sessions, and seminars across the platform.
          </p>
        </section>

        <div className="min-w-0">
          {statsLoading ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-wl-line bg-wl-card/50 text-sm text-wl-muted">
              Loading analytics…
            </div>
          ) : (
            <AdminMetricsPanel
              stats={stats}
              rangeKey={rangeKey}
              customRange={customRange}
              onRangeChange={writeRange}
              sections="analytics"
              title="Activity snapshot"
              onSelectList={(type: SnapshotListType) =>
                go(`snapshot/${type}`, snapshotRangeQuery(rangeKey, customRange))
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
