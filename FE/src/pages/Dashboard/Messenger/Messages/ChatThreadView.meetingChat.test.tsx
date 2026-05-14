import React from "react";
import { render, screen } from "@testing-library/react";
import ChatThreadView from "./ChatThreadView";

describe("ChatThreadView meeting chat line", () => {
  const author = { _id: "u1", username: "Tester", role: "customer", status: "active" };

  it("renders Meet bubble for __MEETING_CHAT__ guest payload", () => {
    const b64 = "eyJ2IjoxLCJhdXRob3IiOiJHdWVzdCIsImd1ZXN0Ijp0cnVlLCJtc2ciOiJIZWxsbyBtZWV0In0";
    const content = `__MEETING_CHAT__::meet-1::${b64}`;
    const displayMessages = [
      {
        _id: "rc-msg-1",
        content,
        author,
        createdAt: new Date("2026-01-15T12:00:00.000Z").toISOString(),
        type: "direct",
      },
    ];

    render(
      <ChatThreadView
        displayMessages={displayMessages as any}
        theme="light"
        isOutgoingMessage={() => false}
        deliveryForMessage={() => undefined}
        groupSenderLabel={() => "Tester"}
        chosenGroupChatDetails={null}
        chosenChatDetails={{}}
        profileImages={new Map()}
        userDetails={{ _id: "u2" }}
        friends={[]}
        handleDeleteMessage={async () => undefined}
        rcChannelId="r1"
        conversationId="c1"
        myRcUserId={null}
      />,
    );

    expect(screen.getByText(/Meet · Guest · Guest/)).toBeInTheDocument();
    expect(screen.getByText("Hello meet")).toBeInTheDocument();
  });
});
