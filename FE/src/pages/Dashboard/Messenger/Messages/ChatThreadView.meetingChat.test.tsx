import React from "react";
import { render, screen } from "@testing-library/react";
import ChatThreadView from "./ChatThreadView";

describe("ChatThreadView meeting chat line", () => {
  const author = { _id: "u1", username: "Tester", role: "customer", status: "active" };

  const guestMeetMessage = () => {
    const b64 = "eyJ2IjoxLCJhdXRob3IiOiJHdWVzdCIsImd1ZXN0Ijp0cnVlLCJtc2ciOiJIZWxsbyBtZWV0In0";
    const content = `__MEETING_CHAT__::meet-1::${b64}`;
    return [
      {
        _id: "rc-msg-1",
        content,
        author,
        createdAt: new Date("2026-01-15T12:00:00.000Z").toISOString(),
        type: "direct",
      },
    ];
  };

  const baseProps = {
    displayMessages: guestMeetMessage() as any,
    theme: "light",
    deliveryForMessage: () => undefined,
    groupSenderLabel: () => "Tester",
    chosenGroupChatDetails: null,
    chosenChatDetails: {},
    profileImages: new Map(),
    userDetails: { _id: "u2" },
    friends: [] as Array<{ _id?: string }>,
    handleDeleteMessage: async () => undefined,
    rcChannelId: "r1",
    conversationId: "c1",
    myRcUserId: null,
  };

  it("renders Meet bubble for __MEETING_CHAT__ guest payload (incoming, left)", () => {
    render(
      <ChatThreadView
        {...baseProps}
        isOutgoingMessage={() => false}
      />,
    );

    expect(screen.getByText(/Meet · Guest · Guest/)).toBeInTheDocument();
    expect(screen.getByText("Hello meet")).toBeInTheDocument();
    const row = screen.getByTestId("meeting-chat-in");
    expect(row.className).toMatch(/justify-start/);
    expect(row.className).not.toMatch(/justify-end/);
  });

  it("aligns outgoing meet chat to the right", () => {
    render(
      <ChatThreadView
        {...baseProps}
        isOutgoingMessage={() => true}
      />,
    );

    const row = screen.getByTestId("meeting-chat-out");
    expect(row.className).toMatch(/justify-end/);
    expect(row.className).not.toMatch(/justify-start/);
  });
});
