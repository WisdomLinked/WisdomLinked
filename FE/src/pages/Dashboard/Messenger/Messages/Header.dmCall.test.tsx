import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";

vi.mock("../../../../api/chatApi", () => ({
    startMeeting: vi.fn(async () => ({ error: "not in this test" })),
    fetchDirectCallHistory: vi.fn(async () => []),
    fetchChatUserProfile: vi.fn(async () => ({ success: false })),
}));
vi.mock("../../../../api/api", () => ({
    doLeftSeminar: vi.fn(),
    doUpdateProfile: vi.fn(),
    proposeIndividualAppointment: vi.fn(),
    leaveAdminChatRoom: vi.fn(),
}));

import { startMeeting } from "../../../../api/chatApi";
import MessagesHeader from "./Header";

const start = vi.mocked(startMeeting);

type Role = "customer" | "expert" | "admin";

const renderDmHeader = (role: Role, peerRole: Role, live = false) => {
    const event = {
        _id: "ev1",
        title: "PhD advice",
        status: "accepted",
        start: new Date(Date.now() - 5 * 60000).toISOString(),
        end: new Date(Date.now() + 55 * 60000).toISOString(),
    };
    const store = configureStore({
        reducer: {
            auth: () => ({ userDetails: { _id: "me", role, username: "Me", groupChats: [], events: [] } }),
            chat: () => ({
                chosenChatDetails: { userId: "peer", username: "Peer", peerRole: peerRole },
                chosenGroupChatDetails: null,
                currentEvent: live ? { _id: "ev1" } : null,
                conversationId: "conv1",
            }),
            friends: () => ({ onlineUsers: [] }),
        },
    });
    return render(
        <Provider store={store}>
            <MessagesHeader events={live ? [event] : []} theme="light" />
        </Provider>,
    );
};

const callButton = () => screen.queryByRole("button", { name: /start video call/i });

describe("direct message call button", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(window, "open").mockReturnValue(null);
    });

    it.each([
        ["an expert", "expert"],
        ["another student", "customer"],
        ["an admin", "admin"],
    ] as const)("a student messaging %s has no call button", (_label, peerRole) => {
        renderDmHeader("customer", peerRole);
        expect(screen.getByText("Peer")).toBeInTheDocument();
        expect(callButton()).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /more options/i })).toBeInTheDocument();
    });

    it("a student in a live scheduled session has no call button either", () => {
        renderDmHeader("customer", "expert", true);
        expect(screen.getByText("Live")).toBeInTheDocument();
        expect(callButton()).not.toBeInTheDocument();
    });

    it.each([
        ["an expert", "expert"],
        ["an admin", "admin"],
    ] as const)("%s keeps the call button, and it starts the call", async (_label, role) => {
        renderDmHeader(role, "customer");
        const button = callButton();
        expect(button).toBeInTheDocument();
        expect(button).toBeEnabled();
        fireEvent.click(button!);
        await waitFor(() => expect(start).toHaveBeenCalledWith({ conversationId: "conv1" }));
    });

    it("an expert in a live scheduled session keeps the call button", async () => {
        renderDmHeader("expert", "customer", true);
        expect(screen.getByText("Live")).toBeInTheDocument();
        const button = callButton();
        expect(button).toBeInTheDocument();
        fireEvent.click(button!);
        await waitFor(() => expect(start).toHaveBeenCalledWith({ conversationId: "conv1" }));
    });
});
