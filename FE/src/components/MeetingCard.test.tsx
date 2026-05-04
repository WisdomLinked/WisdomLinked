import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import MeetingCard from "./MeetingCard";
import * as chatApi from "../api/chatApi";

vi.mock("../api/chatApi");

describe("MeetingCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "open").mockReturnValue({
      closed: false,
      location: { href: "" },
      close: vi.fn(),
    } as unknown as Window);
  });

  it("renders call join CTA and room link for active meetings", () => {
    render(
      <MeetingCard
        meetingThreadId="t1"
        jitsiRoomName="wl-room-xyz"
        starterName="Alice"
        isEnded={false}
        theme="light"
      />,
    );

    expect(screen.getByText("Join Call")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /wisdomlinked meet/i });
    expect(link).toBeInTheDocument();
  });

  it("shows meeting start local time when provided", () => {
    const startedAt = "2026-05-04T08:30:00.000Z";
    render(
      <MeetingCard
        meetingThreadId="t-time"
        jitsiRoomName="wl-room-time"
        starterName="Alice"
        startedAt={startedAt}
        isEnded={false}
        theme="light"
      />,
    );

    const startedByRow = screen.getByText(/Started by/i);
    expect(startedByRow).toHaveTextContent(/Started by Alice ·/);
    expect(startedByRow.textContent || "").not.toMatch(/GMT[+-]/i);
  });

  it("shows Joining... state and handles join flow correctly", async () => {
    const mockOnJoin = vi.fn();
    let resolveApi: any;
    vi.mocked(chatApi.getMeetingJoinInfo).mockReturnValue(new Promise(resolve => {
        resolveApi = resolve;
    }));

    render(
      <MeetingCard
        meetingThreadId="t1"
        jitsiRoomName="wl-room-xyz"
        starterName="Alice"
        isEnded={false}
        theme="light"
        onJoin={mockOnJoin}
      />,
    );

    const joinButton = screen.getByText("Join Call");
    fireEvent.click(joinButton);

    // Should immediately show Joining... and be disabled
    expect(screen.getByText("Joining…")).toBeInTheDocument();
    expect(screen.getByText("Joining…")).toBeDisabled();

    // Resolve the API call
    resolveApi({ success: true, jitsiUrl: "https://mock.jitsi.url" });

    // Should return to "Join Call" and call onJoin with the correct URL
    await waitFor(() => {
        expect(screen.getByText("Join Call")).toBeInTheDocument();
    });
    
    expect(mockOnJoin).toHaveBeenCalledWith("https://mock.jitsi.url");
  });

  it("navigates pre-opened tab to join url when popup opens", async () => {
    const popup = {
      closed: false,
      location: { href: "" },
      close: vi.fn(),
    } as unknown as Window;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(popup);
    vi.mocked(chatApi.getMeetingJoinInfo).mockResolvedValue({
      success: true,
      jitsiUrl: "https://mock.jitsi.url/mobile",
    });

    render(
      <MeetingCard
        meetingThreadId="t2"
        jitsiRoomName="wl-room-abc"
        starterName="Bob"
        isEnded={false}
        theme="light"
      />,
    );

    fireEvent.click(screen.getByText("Join Call"));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith("", "_blank");
      expect(popup.location.href).toBe("https://mock.jitsi.url/mobile");
    });
  });

  it("falls back to same-tab navigation when popup is blocked", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(chatApi.getMeetingJoinInfo).mockResolvedValue({
      success: true,
      jitsiUrl: "https://mock.jitsi.url/fallback",
    });

    render(
      <MeetingCard
        meetingThreadId="t3"
        jitsiRoomName="wl-room-def"
        starterName="Cara"
        isEnded={false}
        theme="light"
      />,
    );

    fireEvent.click(screen.getByText("Join Call"));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  it("does not open raw room URL when signed join fails", async () => {
    const popup = {
      closed: false,
      location: { href: "" },
      close: vi.fn(),
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.mocked(chatApi.getMeetingJoinInfo).mockResolvedValue({
      success: false,
      error: "Join token failed",
    });

    render(
      <MeetingCard
        meetingThreadId="t5"
        jitsiRoomName="wl-room-no-fallback"
        starterName="Eve"
        isEnded={false}
        theme="light"
      />,
    );

    fireEvent.click(screen.getByText("Join Call"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Join token failed");
      expect((popup.close as any)).toHaveBeenCalled();
      expect(popup.location.href).toBe("");
    });
  });

  it("copies normalized app invite URL for guest invite", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.mocked(chatApi.createMeetingGuestInvite).mockResolvedValue({
      success: true,
      inviteUrl: "https://meet.wisdomlinked.com/meeting/invite/invite-token-123",
    });

    render(
      <MeetingCard
        meetingThreadId="t4"
        jitsiRoomName="wl-room-ghi"
        starterName="Dana"
        isEnded={false}
        theme="light"
      />,
    );

    fireEvent.click(screen.getByText("Copy guest invite"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/meeting/invite/invite-token-123`);
    });
  });
});
