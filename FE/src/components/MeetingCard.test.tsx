import React from "react";
import { render, screen } from "@testing-library/react";
import MeetingCard from "./MeetingCard";

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

    expect(screen.getByText("Join call")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /wisdomlinked meet/i });
    expect(link).toBeInTheDocument();
  });
});

