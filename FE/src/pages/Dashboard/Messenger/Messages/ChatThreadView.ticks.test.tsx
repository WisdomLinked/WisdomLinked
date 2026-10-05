import React from "react";
import { render, screen } from "@testing-library/react";
import ChatThreadView from "./ChatThreadView";

describe("ChatThreadView delivery ticks", () => {
    const me = { _id: "me-1", username: "Me", role: "customer", status: "active" };
    const peer = { _id: "peer-1", username: "Peer", role: "expert", status: "active" };
    const t1 = new Date("2026-05-22T21:18:00.000Z").toISOString();

    const baseProps = {
        theme: "light",
        groupSenderLabel: (m: { author?: { username?: string } }) =>
            String(m.author?.username ?? "User"),
        chosenGroupChatDetails: null,
        chosenChatDetails: { userId: "peer-1", username: "Peer" },
        profileImages: new Map(),
        userDetails: me,
        friends: [] as Array<{ _id?: string }>,
        handleDeleteMessage: async () => undefined,
        rcChannelId: "room-1",
        conversationId: "conv-1",
        myRcUserId: null,
        isOutgoingMessage: (m: any) => String(m.author?._id) === "me-1",
    };

    const renderWith = (status: "delivered" | "seen" | undefined, content = "hello") =>
        render(
            <ChatThreadView
                {...baseProps}
                deliveryForMessage={() => status}
                displayMessages={[
                    { _id: "out-1", content, author: me, createdAt: t1, type: "direct" } as any,
                ]}
            />,
        );

    it("has no in-flight state, because a message is never rendered before the server has it", () => {
        renderWith("delivered");
        expect(screen.queryByLabelText("Sending")).not.toBeInTheDocument();
        expect(screen.getByLabelText("Delivered")).toBeInTheDocument();
    });

    it("shows grey double ticks once the message has reached the server", () => {
        renderWith("delivered");
        const ticks = screen.getByLabelText("Delivered");
        expect(ticks).toBeInTheDocument();
        expect(ticks.querySelectorAll("svg")).toHaveLength(2);
        expect(ticks.className).not.toMatch(/text-green/);
    });

    it("turns the double ticks green once the peer has read it", () => {
        renderWith("seen");
        const ticks = screen.getByLabelText("Seen");
        expect(ticks).toBeInTheDocument();
        expect(ticks.querySelectorAll("svg")).toHaveLength(2);
        expect(ticks.className).toMatch(/\btext-green\b/);
    });

    it("never uses a numbered green shade, which compiles to nothing in this project", () => {
        renderWith("seen");
        expect(screen.getByLabelText("Seen").className).not.toMatch(/text-green-\d/);
    });

    it("shows no ticks at all on an incoming message", () => {
        render(
            <ChatThreadView
                {...baseProps}
                deliveryForMessage={() => undefined}
                displayMessages={[
                    { _id: "in-1", content: "hi", author: peer, createdAt: t1, type: "direct" } as any,
                ]}
            />,
        );
        expect(screen.queryByLabelText("Delivered")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Seen")).not.toBeInTheDocument();
    });

    it("drops the old hardcoded gold double-tick glyph", () => {
        const { container } = renderWith("seen");
        expect(container.textContent).not.toContain("✓✓");
        expect(container.innerHTML).not.toContain("C9A84C");
    });

    it("shows no ticks on an incoming file message, which is handed a status either way", () => {
        render(
            <ChatThreadView
                {...baseProps}
                deliveryForMessage={() => undefined}
                displayMessages={[
                    {
                        _id: "in-file",
                        content: "Chatfile: https://x.digitaloceanspaces.com/chatFiles/1_a.pdf#####a.pdf",
                        author: peer,
                        createdAt: t1,
                        type: "direct",
                    } as any,
                ]}
            />,
        );
        expect(screen.queryByLabelText("Delivered")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Seen")).not.toBeInTheDocument();
    });

    it("shows no ticks when the message is mine by id but has no known delivery state", () => {
        render(
            <ChatThreadView
                {...baseProps}
                isOutgoingMessage={() => false}
                deliveryForMessage={() => undefined}
                displayMessages={[
                    { _id: "out-1", content: "hello", author: me, createdAt: t1, type: "direct" } as any,
                ]}
            />,
        );
        expect(screen.queryByLabelText("Delivered")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Seen")).not.toBeInTheDocument();
    });

    it("reports the same state on a file message, which takes the other render path", () => {
        renderWith("seen", "Chatfile: https://x.digitaloceanspaces.com/chatFiles/1_a.pdf#####a.pdf");
        const ticks = screen.getByLabelText("Seen");
        expect(ticks.className).toMatch(/\btext-green\b/);
    });

    it("shows one tick group per stacked run, reflecting the run's latest message", () => {
        render(
            <ChatThreadView
                {...baseProps}
                deliveryForMessage={() => "seen" as const}
                displayMessages={[
                    { _id: "out-1", content: "one", author: me, createdAt: t1, type: "direct" } as any,
                    {
                        _id: "out-2",
                        content: "two",
                        author: me,
                        createdAt: new Date("2026-05-22T21:19:00.000Z").toISOString(),
                        type: "direct",
                    } as any,
                ]}
            />,
        );
        expect(screen.getAllByLabelText("Seen")).toHaveLength(1);
    });
});
