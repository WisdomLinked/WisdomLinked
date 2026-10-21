import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";

const holder = vi.hoisted(() => ({ store: null as any }));

vi.mock("../../../../store", async () => {
    const { useSelector } = await import("react-redux");
    return {
        useAppSelector: (selector: any) => useSelector(selector),
        get store() {
            return holder.store;
        },
    };
});
vi.mock("./Header", () => ({
    default: ({ openCalendarModal, openSeminarModal, openEditSeminarModal }: any) => (
        <div>
            <button onClick={openCalendarModal}>open calendar</button>
            <button onClick={openSeminarModal}>open details</button>
            <button onClick={openEditSeminarModal}>open edit</button>
        </div>
    ),
}));
vi.mock("./ChatThreadView", () => ({ default: () => null }));
vi.mock("./calendar", () => ({ default: () => <div>calendar body</div> }));
vi.mock("../../seminarDetails", () => ({ default: () => <div>details body</div> }));
vi.mock("../../_ExpertDashboard/seminar", () => ({
    default: ({ onSaved }: any) => (
        <div>
            edit body
            <button onClick={() => onSaved?.("active")}>save seminar</button>
        </div>
    ),
}));
vi.mock("../../../../api/chatApi", () => ({
    getOrCreateDM: vi.fn(async () => null),
    fetchDirectHistory: vi.fn(async () => ({ messages: [] })),
    fetchGroupHistory: vi.fn(async () => ({ messages: [] })),
    fetchGroupMemberByRcSlug: vi.fn(async () => null),
    markChatRead: vi.fn(async () => null),
    markChatReadOnExit: vi.fn(),
    getRCToken: vi.fn(async () => ({})),
    deleteChatMessage: vi.fn(async () => ({ success: true })),
    fetchReadReceiptsBatch: vi.fn(async () => null),
    fetchDmUnreadSnapshot: vi.fn(async () => null),
}));
vi.mock("../../../../api/api", () => ({
    doGetEventsBetweenCustomerAndExpert: vi.fn(async () => []),
    profileImageFetch: vi.fn(async () => null),
}));
vi.mock("../../../../services/rcRealtime", () => ({
    connectToRC: vi.fn(async () => undefined),
    subscribeToRoom: vi.fn(),
    unsubscribeFromRoom: vi.fn(),
    onNewMessage: vi.fn(() => () => undefined),
    isRCConnected: vi.fn(() => true),
    normalizeRcStreamRoomMessage: vi.fn((m: any) => m),
}));
vi.mock("../../../../hooks/useMarkRoomRead", () => ({ useMarkRoomRead: vi.fn() }));
vi.mock("../../../../hooks/useEndMeetingOnReturn", () => ({ useEndMeetingOnReturn: vi.fn() }));
vi.mock("../../../../actions/authActions", () => ({ updateMe: vi.fn(() => ({ type: "test/updateMe" })) }));
vi.mock("../../../../actions/groupChatActions", () => ({
    deleteGroupAction: vi.fn(() => ({ type: "test/deleteGroup" })),
}));

import Messages from "./index";

const seminar = (id: string, extra: Record<string, unknown> = {}) => ({
    _id: id,
    groupId: id,
    groupName: `Seminar ${id}`,
    type: "seminar",
    admin: "host",
    participants: ["host", "student-1"],
    ...extra,
});

const makeStore = () =>
    configureStore({
        reducer: {
            auth: (state: any = { userDetails: { _id: "host", role: "expert", groupChats: [], events: [] } }, action: any) =>
                action.type === "test/refreshUser"
                    ? { userDetails: { ...state.userDetails, groupChats: [...action.payload], events: [] } }
                    : state,
            chat: (
                state: any = {
                    chosenChatDetails: null,
                    chosenGroupChatDetails: seminar("sem1"),
                    messages: [],
                    gotAllChats: false,
                    isNewMessage: false,
                    conversationId: null,
                    rcChannelId: null,
                },
                action: any,
            ) => {
                if (action.type === "test/setGroup") {
                    return { ...state, chosenChatDetails: null, chosenGroupChatDetails: action.payload };
                }
                if (action.type === "test/setDm") {
                    return { ...state, chosenChatDetails: action.payload, chosenGroupChatDetails: null };
                }
                return state;
            },
            friends: () => ({ friends: [] }),
        },
        middleware: getDefault => getDefault({ serializableCheck: false, immutableCheck: false }),
    });

const renderMessages = () => {
    holder.store = makeStore();
    render(
        <Provider store={holder.store}>
            <Messages theme="light" />
        </Provider>,
    );
    return holder.store;
};

const POPUPS = [
    { open: "open calendar", body: "calendar body" },
    { open: "open details", body: "details body" },
    { open: "open edit", body: "edit body" },
];

/** What a background refresh does: fresh user data, and a fresh copy of the same open chat. */
const backgroundRefresh = (store: any) => {
    act(() => {
        store.dispatch({ type: "test/refreshUser", payload: [seminar("sem1", { updatedAt: Date.now() })] });
        store.dispatch({ type: "test/setGroup", payload: seminar("sem1", { participants: ["host", "student-1", "student-2"] }) });
    });
};

describe("chat popups stay open until the user closes them", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(POPUPS)("$open survives repeated background refreshes", ({ open, body }) => {
        const store = renderMessages();
        fireEvent.click(screen.getByRole("button", { name: open }));
        expect(screen.getByText(body)).toBeInTheDocument();
        backgroundRefresh(store);
        backgroundRefresh(store);
        expect(screen.getByText(body)).toBeInTheDocument();
    });

    it.each(POPUPS)("$open closes when a different chat is opened", ({ open, body }) => {
        const store = renderMessages();
        fireEvent.click(screen.getByRole("button", { name: open }));
        act(() => {
            store.dispatch({ type: "test/setGroup", payload: seminar("sem2") });
        });
        expect(screen.queryByText(body)).not.toBeInTheDocument();
    });

    it("closes when switching from the group to a direct message", () => {
        const store = renderMessages();
        fireEvent.click(screen.getByRole("button", { name: "open details" }));
        act(() => {
            store.dispatch({ type: "test/setDm", payload: { userId: "peer-1", username: "Peer" } });
        });
        expect(screen.queryByText("details body")).not.toBeInTheDocument();
    });

    it("details popup does not close on a click outside it", () => {
        renderMessages();
        fireEvent.click(screen.getByRole("button", { name: "open details" }));
        const body = screen.getByText("details body");
        const backdrop = body.closest("div.absolute.top-0.left-0") as HTMLElement;
        const outside = [backdrop, ...Array.from(backdrop.children).filter((el) => !el.contains(body))];
        outside.forEach((el) => fireEvent.click(el));
        expect(screen.getByText("details body")).toBeInTheDocument();
    });

    it("edit popup closes after a successful save", () => {
        renderMessages();
        fireEvent.click(screen.getByRole("button", { name: "open edit" }));
        fireEvent.click(screen.getByRole("button", { name: "save seminar" }));
        expect(screen.queryByText("edit body")).not.toBeInTheDocument();
    });
});
