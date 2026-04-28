import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MeetingGuestInvite from "./MeetingGuestInvite";
import * as chatApi from "../api/chatApi";

const mockNavigate = vi.fn();

vi.mock("../api/chatApi");
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
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("routes signed-in users to login from full-experience CTA", async () => {
    window.localStorage.setItem("currentUser", JSON.stringify({ email: "c@x.com", role: "customer" }));
    render(<MeetingGuestInvite />);

    await waitFor(() => {
      expect(screen.getByText("Continue as guest")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Login for full experience"));
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});

