import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MeetingGuestInvite from "./MeetingGuestInvite";
import * as chatApi from "../api/chatApi";
import * as api from "../api/api";

const mockNavigate = vi.fn();

vi.mock("../api/chatApi");
vi.mock("../api/api", () => ({
  callLogout: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ token: "invite-token-123" }),
  };
});

describe("MeetingGuestInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.mocked(chatApi.joinMeetingFromGuestInvite as any).mockResolvedValue({
      success: false,
      error: "No access",
    });
    vi.mocked(chatApi.resolveMeetingGuestInvite).mockResolvedValue({
      success: true,
      jitsiUrl: "https://meet.wisdomlinked.com/room-abc",
      expiresAt: new Date().toISOString(),
    });
  });

  it("routes unauthenticated users to login from full-experience CTA", async () => {
    render(<MeetingGuestInvite />);

    await waitFor(() => {
      expect(screen.getByText("Continue as guest")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Login for full experience"));
    expect(mockNavigate).toHaveBeenCalledWith("/login?redirect=%2Fmeeting%2Finvite%2Finvite-token-123");
  });

  it("auto-enters the meeting for signed-in users (skips invite page)", async () => {
    const replaceSpy = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace: replaceSpy });
    vi.mocked(chatApi.joinMeetingFromGuestInvite as any).mockResolvedValue({
      success: true,
      jitsiUrl: "https://meet.wisdomlinked.com/authed-room",
    });
    window.localStorage.setItem("currentUser", JSON.stringify({ email: "c@x.com", role: "customer" }));

    render(<MeetingGuestInvite />);

    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalledWith("https://meet.wisdomlinked.com/authed-room");
    });
  });

  it("falls back to guest invite UI when signed-in user cannot join as participant", async () => {
    window.localStorage.setItem("currentUser", JSON.stringify({ email: "c@x.com", role: "customer" }));
    vi.mocked(chatApi.joinMeetingFromGuestInvite as any).mockResolvedValue({
      success: false,
      error: "You do not have access to this meeting",
    });

    render(<MeetingGuestInvite />);

    await waitFor(() => {
      expect(screen.getByText("Continue as guest")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/cannot join this private meeting directly/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Switch account for full experience")).toBeInTheDocument();
  });

  it("signed-in user without access can still switch account for full experience", async () => {
    window.localStorage.setItem("currentUser", JSON.stringify({ email: "other@x.com", role: "customer" }));
    window.localStorage.setItem("isLoginRemembered", "true");
    vi.mocked(chatApi.joinMeetingFromGuestInvite as any).mockResolvedValue({
      success: false,
      error: "You do not have access to this meeting",
    });

    render(<MeetingGuestInvite />);

    await waitFor(() => {
      expect(
        screen.getByText(/cannot join this private meeting directly/i),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Switch account for full experience"));

    await waitFor(() => {
      expect(api.callLogout).toHaveBeenCalled();
    });
    expect(mockNavigate).toHaveBeenCalledWith("/login?redirect=%2Fmeeting%2Finvite%2Finvite-token-123");
  });
});

