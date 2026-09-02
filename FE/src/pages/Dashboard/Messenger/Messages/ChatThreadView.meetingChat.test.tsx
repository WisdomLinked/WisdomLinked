import React from "react";
import { render, screen } from "@testing-library/react";
import ChatThreadView from "./ChatThreadView";

function b64Payload(obj: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

describe("ChatThreadView meet chat in thread", () => {
  const author = { _id: "u1", username: "Tester", role: "customer", status: "active" };

  const baseProps = {
    theme: "light",
    deliveryForMessage: () => undefined,
    groupSenderLabel: () => "Tester",
    chosenGroupChatDetails: null,
    chosenChatDetails: { userId: "u2" },
    profileImages: new Map(),
    userDetails: { _id: "u2", username: "Student" },
    friends: [] as Array<{ _id?: string }>,
    handleDeleteMessage: async () => undefined,
    rcChannelId: "r1",
    conversationId: "c1",
    myRcUserId: null,
    isOutgoingMessage: () => false,
  };

  it("does not render __MEETING_CHAT__ lines in the thread", () => {
    const content = `__MEETING_CHAT__::meet-1::${b64Payload({
      v: 1,
      author: "Guest",
      guest: true,
      msg: "Hello meet",
    })}`;

    render(
      <ChatThreadView
        {...baseProps}
        displayMessages={[
          {
            _id: "rc-msg-1",
            content,
            author,
            createdAt: new Date("2026-01-15T12:00:00.000Z").toISOString(),
            type: "direct",
          },
        ] as any}
      />,
    );

    expect(screen.queryByTestId("meeting-chat-panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Hello meet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("meeting-chat-in")).not.toBeInTheDocument();
    expect(screen.queryByTestId("meeting-chat-out")).not.toBeInTheDocument();
  });

  it("shows incoming thread avatar photo when profileImages has the author", () => {
    const peerId = "peer-1";
    const photo = "data:image/png;base64,peerPhoto";
    const profileImages = new Map([[peerId, photo]]);

    render(
      <ChatThreadView
        {...baseProps}
        profileImages={profileImages}
        displayMessages={[
          {
            _id: "msg-1",
            content: "Hello there",
            author: { _id: peerId, username: "Peer User", role: "customer", status: "active" },
            createdAt: new Date("2026-01-15T12:00:00.000Z").toISOString(),
            type: "direct",
          },
        ] as any}
      />,
    );

    const img = screen.getByTestId("thread-incoming-avatar-photo");
    expect(img).toHaveAttribute("src", photo);
  });
});
