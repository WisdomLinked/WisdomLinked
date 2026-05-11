import { beforeEach, describe, expect, it } from "vitest";
import type { AdminDashboardStatsData } from "../api/api";
import {
  ADMIN_TOPBAR_DISMISS_STORAGE_KEY,
  loadAdminTopBarDismiss,
  pruneDismissForResolvedStats,
  saveAdminTopBarDismiss,
  shouldShowApproval,
  shouldShowChatbot,
  shouldShowContact,
  shouldShowPayment,
} from "./adminTopBarDismiss";

const baseStats = (): AdminDashboardStatsData => ({
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
});

describe("adminTopBarDismiss", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shouldShowApproval hides when zero pending", () => {
    expect(shouldShowApproval({}, 0)).toBe(false);
    expect(shouldShowApproval({ approval: 3 }, 0)).toBe(false);
  });

  it("shouldShowApproval shows when pending > 0 and snapshot differs", () => {
    expect(shouldShowApproval({}, 2)).toBe(true);
    expect(shouldShowApproval({ approval: 1 }, 2)).toBe(true);
  });

  it("shouldShowApproval hides while dismissed snapshot equals current count", () => {
    expect(shouldShowApproval({ approval: 4 }, 4)).toBe(false);
  });

  it("shouldShowContact mirrors approval rules", () => {
    expect(shouldShowContact({}, 0)).toBe(false);
    expect(shouldShowContact({}, 1)).toBe(true);
    expect(shouldShowContact({ contact: 2 }, 2)).toBe(false);
    expect(shouldShowContact({ contact: 2 }, 3)).toBe(true);
  });

  it("shouldShowPayment requires refundCount > 0", () => {
    expect(shouldShowPayment({}, 0)).toBe(false);
    expect(shouldShowPayment({}, 1)).toBe(true);
    expect(shouldShowPayment({ payment: 1 }, 1)).toBe(false);
  });

  it("shouldShowChatbot requires unanswered > 0", () => {
    expect(shouldShowChatbot({}, 0)).toBe(false);
    expect(shouldShowChatbot({}, 5)).toBe(true);
    expect(shouldShowChatbot({ chatbot: 5 }, 5)).toBe(false);
  });

  it("loadAdminTopBarDismiss and saveAdminTopBarDismiss round-trip JSON state", () => {
    const payload = { approval: 3, contact: 1, payment: 0 };
    saveAdminTopBarDismiss(payload);
    expect(loadAdminTopBarDismiss()).toEqual(payload);
    expect(localStorage.getItem(ADMIN_TOPBAR_DISMISS_STORAGE_KEY)).toContain("approval");
  });

  it("loadAdminTopBarDismiss returns {} on invalid JSON", () => {
    localStorage.setItem(ADMIN_TOPBAR_DISMISS_STORAGE_KEY, "{not-json");
    expect(loadAdminTopBarDismiss()).toEqual({});
  });

  it("pruneDismissForResolvedStats clears each key when corresponding stat is zero", () => {
    const dismiss = { approval: 3, contact: 2, payment: 1, chatbot: 4 };
    const empty = baseStats();

    expect(pruneDismissForResolvedStats(dismiss, { ...empty, pendingApprovals: 0 }).approval).toBeUndefined();
    expect(pruneDismissForResolvedStats(dismiss, { ...empty, newContactMessages: 0 }).contact).toBeUndefined();
    expect(pruneDismissForResolvedStats(dismiss, { ...empty, refundCount: 0 }).payment).toBeUndefined();
    expect(
      pruneDismissForResolvedStats(dismiss, { ...empty, unansweredChatbotQuestions: 0 }).chatbot,
    ).toBeUndefined();
  });
});
