import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JoinMeeting from "./JoinMeeting";
import * as chatApi from "../../api/chatApi";

vi.mock("../../api/chatApi");

describe("JoinMeeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps join disabled until a meeting id is entered", () => {
    render(<JoinMeeting />);
    expect(screen.getByRole("button", { name: /join meeting/i })).toBeDisabled();
  });

  it("joins by meetingThreadId using the signed backend URL", async () => {
    const popup = {
      closed: false,
      location: { href: "" },
      close: vi.fn(),
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    vi.mocked(chatApi.getMeetingJoinInfo).mockResolvedValue({
      success: true,
      jitsiUrl: "https://meet.wisdomlinked.com/wl-room?jwt=abc",
    });

    render(<JoinMeeting />);
    fireEvent.change(screen.getByLabelText("Meeting ID"), {
      target: { value: " meeting-thread-123 " },
    });
    fireEvent.click(screen.getByRole("button", { name: /join meeting/i }));

    await waitFor(() => {
      expect(chatApi.getMeetingJoinInfo).toHaveBeenCalledWith("meeting-thread-123");
      expect(popup.location.href).toBe("https://meet.wisdomlinked.com/wl-room?jwt=abc");
    });
  });

  it("shows backend errors and does not navigate", async () => {
    const popup = {
      closed: false,
      location: { href: "" },
      close: vi.fn(),
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    vi.mocked(chatApi.getMeetingJoinInfo).mockResolvedValue({
      success: false,
      error: "You do not have access to this meeting",
    });

    render(<JoinMeeting />);
    fireEvent.change(screen.getByLabelText("Meeting ID"), {
      target: { value: "meeting-thread-456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /join meeting/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("You do not have access to this meeting");
      expect(popup.close as any).toHaveBeenCalled();
      expect(popup.location.href).toBe("");
    });
  });
});
