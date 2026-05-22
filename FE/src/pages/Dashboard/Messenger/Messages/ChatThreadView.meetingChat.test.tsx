import React from "react";
import { render, screen } from "@testing-library/react";
import ChatThreadView from "./ChatThreadView";

function b64Payload(obj: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

describe("ChatThreadView meeting chat", () => {
  const expertAuthor = { _id: "rc-expert", username: "expert.slug", role: "expert", status: "active" };

  const baseProps = {
    theme: "light",
    deliveryForMessage: () => undefined,
    groupSenderLabel: () => "Expert",
    chosenGroupChatDetails: null,
    chosenChatDetails: { userId: "expert-mongo-id" },
    profileImages: new Map(),
    friends: [] as Array<{ _id?: string }>,
    handleDeleteMessage: async () => undefined,
    rcChannelId: "r1",
    conversationId: "c1",
    myRcUserId: "rc-student",
    isOutgoingMessage: () => false,
  };

  it("renders guest meet line as incoming inside panel", () => {
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
            author: expertAuthor,
            createdAt: new Date("2026-01-15T12:00:00.000Z").toISOString(),
            type: "direct",
          },
        ] as any}
        userDetails={{ _id: "student-mongo-id", username: "Student User", email: "s@tamu.edu" }}
      />,
    );

    expect(screen.getByTestId("meeting-chat-panel")).toBeInTheDocument();
    expect(screen.getByText(/Meet · Guest · Guest/)).toBeInTheDocument();
    expect(screen.getByText("Hello meet")).toBeInTheDocument();
    const row = screen.getByTestId("meeting-chat-in");
    expect(row.className).toMatch(/justify-start/);
  });

  it("aligns student own meet line right via payload author when RC author is wrong", () => {
    const content = `__MEETING_CHAT__::meet-1::${b64Payload({
      v: 1,
      author: "Student User",
      guest: false,
      msg: "my meet msg",
      sub: "student-mongo-id",
    })}`;
    render(
      <ChatThreadView
        {...baseProps}
        displayMessages={[
          {
            _id: "rc-msg-2",
            content,
            author: expertAuthor,
            createdAt: new Date("2026-01-15T12:01:00.000Z").toISOString(),
            type: "direct",
          },
        ] as any}
        userDetails={{ _id: "student-mongo-id", username: "Student User", email: "s@tamu.edu" }}
      />,
    );

    const row = screen.getByTestId("meeting-chat-out");
    expect(row.className).toMatch(/justify-end/);
    expect(screen.getByText("my meet msg")).toBeInTheDocument();
  });

  it("groups consecutive meet lines into one panel", () => {
    const mk = (id: string, msg: string, author: string, sub?: string) => ({
      _id: id,
      content: `__MEETING_CHAT__::meet-1::${b64Payload({
        v: 1,
        author,
        guest: false,
        msg,
        ...(sub ? { sub } : {}),
      })}`,
      author: expertAuthor,
      createdAt: new Date("2026-01-15T12:00:00.000Z").toISOString(),
      type: "direct",
    });

    render(
      <ChatThreadView
        {...baseProps}
        displayMessages={
          [
            mk("m1", "one", "Expert Name", "expert-mongo-id"),
            mk("m2", "two", "Student User", "student-mongo-id"),
          ] as any
        }
        userDetails={{ _id: "student-mongo-id", username: "Student User", email: "s@tamu.edu" }}
      />,
    );

    expect(screen.getAllByTestId("meeting-chat-panel")).toHaveLength(1);
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
    expect(screen.getByTestId("meeting-chat-in")).toBeInTheDocument();
    expect(screen.getByTestId("meeting-chat-out")).toBeInTheDocument();
  });
});
