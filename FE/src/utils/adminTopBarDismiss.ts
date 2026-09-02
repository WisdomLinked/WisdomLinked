import type { AdminDashboardStatsData } from '../api/api';

export const ADMIN_TOPBAR_DISMISS_STORAGE_KEY = 'wl_admin_topbar_notif_dismiss_v1';

/** Last-seen snapshot counts: while current count equals stored value and work remains, treat as “viewed” and hide. */
export type AdminTopBarDismissState = {
  approval?: number;
  contact?: number;
  payment?: number;
  chatbot?: number;
};

export function loadAdminTopBarDismiss(): AdminTopBarDismissState {
  try {
    const raw = localStorage.getItem(ADMIN_TOPBAR_DISMISS_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as AdminTopBarDismissState;
    return typeof p === 'object' && p ? p : {};
  } catch {
    return {};
  }
}

export function saveAdminTopBarDismiss(next: AdminTopBarDismissState): void {
  try {
    localStorage.setItem(ADMIN_TOPBAR_DISMISS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Drop dismiss entries when the underlying queue is empty (resolved). */
export function pruneDismissForResolvedStats(
  dismiss: AdminTopBarDismissState,
  stats: AdminDashboardStatsData,
): AdminTopBarDismissState {
  const out = { ...dismiss };
  if (stats.pendingApprovals <= 0) delete out.approval;
  if (stats.newContactMessages <= 0) delete out.contact;
  if (stats.refundCount <= 0) delete out.payment;
  if (stats.unansweredChatbotQuestions <= 0) delete out.chatbot;
  return out;
}

export function shouldShowApproval(dismiss: AdminTopBarDismissState, pending: number): boolean {
  if (pending <= 0) return false;
  return dismiss.approval !== pending;
}

export function shouldShowContact(dismiss: AdminTopBarDismissState, newMessages: number): boolean {
  if (newMessages <= 0) return false;
  return dismiss.contact !== newMessages;
}

export function shouldShowPayment(dismiss: AdminTopBarDismissState, refundCount: number): boolean {
  if (refundCount <= 0) return false;
  return dismiss.payment !== refundCount;
}

export function shouldShowChatbot(dismiss: AdminTopBarDismissState, unanswered: number): boolean {
  if (unanswered <= 0) return false;
  return dismiss.chatbot !== unanswered;
}
