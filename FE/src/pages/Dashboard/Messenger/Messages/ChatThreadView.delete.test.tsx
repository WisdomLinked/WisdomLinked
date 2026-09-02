import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatThreadView from "./ChatThreadView";

describe("ChatThreadView message delete", () => {
    const me = { _id: "me-1", username: "Me", role: "customer", status: "active" };
    const peer = { _id: "peer-1", username: "Peer", role: "expert", status: "active" };

    const baseProps = {
        theme: "light",
        deliveryForMessage: () => "sent" as const,
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
    };

    it("shows delete on every bubble in a stacked outgoing group", () => {
        const t1 = new Date("2026-05-22T21:18:00.000Z").toISOString();
        const t2 = new Date("2026-05-22T21:19:00.000Z").toISOString();

        render(
            <ChatThreadView
                {...baseProps}
                isOutgoingMessage={(m) => String(m.author?._id) === "me-1"}
                displayMessages={[
                    {
                        _id: "out-1",
                        content: "hello professor",
                        author: me,
                        createdAt: t1,
                        type: "direct",
                    },
                    {
                        _id: "out-2",
                        content: "if u are free we can come on a call",
                        author: me,
                        createdAt: t2,
                        type: "direct",
                    },
                ] as any}
            />,
        );

        expect(screen.getAllByLabelText("Delete message")).toHaveLength(2);
    });

    it("shows delete for me only on stacked incoming peer messages", async () => {
        const user = userEvent.setup();
        const t1 = new Date("2026-05-22T21:18:00.000Z").toISOString();
        const t2 = new Date("2026-05-22T21:19:00.000Z").toISOString();

        render(
            <ChatThreadView
                {...baseProps}
                isOutgoingMessage={() => false}
                displayMessages={[
                    {
                        _id: "in-1",
                        content: "First from peer",
                        author: peer,
                        createdAt: t1,
                        type: "direct",
                    },
                    {
                        _id: "in-2",
                        content: "Second from peer",
                        author: peer,
                        createdAt: t2,
                        type: "direct",
                    },
                ] as any}
            />,
        );

        const deleteButtons = screen.getAllByLabelText("Delete message");
        expect(deleteButtons).toHaveLength(2);

        await user.click(deleteButtons[0]);
        expect(screen.getByText("Delete for me")).toBeInTheDocument();
        expect(screen.queryByText("Delete for everyone")).not.toBeInTheDocument();
    });
});
