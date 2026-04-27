import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import MeetingCard from "./MeetingCard";
import * as chatApi from "../api/chatApi";

vi.mock("../api/chatApi");

describe("MeetingCard", () => {
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
});
