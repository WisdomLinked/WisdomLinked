import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { getStatusLabel } from "./ChatHeader";
import ChatHeader from "./ChatHeader";

describe("ChatHeader status label", () => {
  it("shows online directly", () => {
    expect(getStatusLabel("online")).toBe("Online");
  });

  it("keeps Offline visible when showing last seen details", () => {
    const label = getStatusLabel("offline", new Date("2026-05-10T12:00:00Z"));
    expect(label).toMatch(/^Offline - last seen /);
  });

  it("renders profile photo when image is a displayable data URL", () => {
    render(
      <ChatHeader
        name="Alex"
        status="online"
        avatarInitials="A"
        image="data:image/png;base64,iVBORw0KGgo="
      />,
    );

    const img = screen.getByRole("img", { name: "Alex" });
    expect(img).toHaveAttribute("src", "data:image/png;base64,iVBORw0KGgo=");
  });

  it("shows one call action, not separate video and voice buttons", () => {
    render(
      <ChatHeader
        name="Alex"
        status="online"
        avatarInitials="A"
        onVideoClick={() => {}}
        onMoreClick={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: /start video call/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start voice call/i })).not.toBeInTheDocument();
  });
});
