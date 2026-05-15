import { describe, expect, it } from "vitest";
import {
  formatCallDuration,
  formatCallEnded,
  formatCallStarted,
  resolveCallHistoryActive,
  resolveCallHistoryDurationSeconds,
} from "./callHistoryDisplay";

describe("callHistoryDisplay", () => {
  it("treats active rows as in progress with no duration", () => {
    const row = {
      status: "active",
      isActive: true,
      startedAt: "2026-05-15T18:00:00.000Z",
      endedAt: null,
      duration: 0,
    };
    expect(resolveCallHistoryActive(row)).toBe(true);
    expect(formatCallEnded(row.endedAt, true)).toBe("In progress");
    expect(formatCallDuration(resolveCallHistoryDurationSeconds(row), true)).toBe("—");
  });

  it("computes duration from ended and started timestamps", () => {
    const row = {
      status: "ended",
      isActive: false,
      startedAt: "2026-05-15T18:00:00.000Z",
      endedAt: "2026-05-15T18:07:10.000Z",
      duration: 999,
      durationSeconds: 430,
    };
    expect(resolveCallHistoryDurationSeconds(row)).toBe(430);
    expect(formatCallDuration(430, false)).toBe("7m 10s");
    expect(formatCallEnded(row.endedAt, false)).not.toBe("In progress");
  });

  it("formats started datetime", () => {
    const iso = "2026-05-15T13:59:17.000Z";
    expect(formatCallStarted(iso)).toBe(new Date(iso).toLocaleString());
  });
});
