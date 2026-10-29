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

type Role = "customer" | "expert";
type Kind = "seminar" | "individual";

const renderSessionHeader = ({
    viewer,
    kind,
    live = true,
    name = "Quantum Basics",
}: { viewer: Role; kind: Kind; live?: boolean; name?: string }) => {
    const now = Date.now();
    const session = {
        _id: "gc1",
        name,
        type: kind,
        admin: "expert1",
        participants: ["expert1", "student1"],
        start: new Date(now + (live ? -5 : 60) * 60000).toISOString(),
        end: new Date(now + (live ? 55 : 120) * 60000).toISOString(),
        duration: 60,
    };
    const meId = viewer === "expert" ? "expert1" : "student1";
    const store = configureStore({
        reducer: {
            auth: () => ({
                userDetails: { _id: meId, role: viewer, username: "Me", groupChats: [session], events: [] },
            }),
            chat: () => ({
                chosenChatDetails: null,
                chosenGroupChatDetails: { ...session, groupId: "gc1", groupName: name },
                currentEvent: null,
                conversationId: null,
            }),
            friends: () => ({ onlineUsers: [] }),
        },
    });
    return render(
        <Provider store={store}>
            <MessagesHeader events={[]} theme="light" />
        </Provider>,
    );
};

const headerJoin = () => screen.getByRole("button", { name: /^join$/i });
const dialog = () => screen.queryByRole("dialog");
const dialogJoin = () => {
    const buttons = screen.getAllByRole("button", { name: /^join$/i });
    return buttons[buttons.length - 1];
};
const acknowledgeBox = () => screen.getByRole("checkbox", { name: /acknowledge official paid session/i });

describe("host acknowledges the official paid session before joining", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(window, "open").mockReturnValue(null);
    });

    it.each([
        ["seminar", "seminar"],
        ["1:1 appointment", "individual"],
    ] as const)("the expert's Join on a %s opens the popup and starts nothing", async (label, kind) => {
        renderSessionHeader({ viewer: "expert", kind });
        fireEvent.click(headerJoin());

        expect(dialog()).toBeInTheDocument();
        expect(
            screen.getByText(
                `I understand that joining now starts the official paid session of the ${label} - Quantum Basics.`,
            ),
        ).toBeInTheDocument();
        expect(acknowledgeBox()).not.toBeChecked();
        expect(dialogJoin()).toBeDisabled();
        expect(start).not.toHaveBeenCalled();
        expect(window.open).not.toHaveBeenCalled();
    });

    it("Join stays disabled until the box is ticked, then starts the call", async () => {
        renderSessionHeader({ viewer: "expert", kind: "seminar" });
        fireEvent.click(headerJoin());

        fireEvent.click(dialogJoin());
        expect(start).not.toHaveBeenCalled();

        fireEvent.click(acknowledgeBox());
        expect(dialogJoin()).toBeEnabled();
        fireEvent.click(dialogJoin());

        expect(window.open).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(start).toHaveBeenCalledWith({ groupChatId: "gc1" }));
        await waitFor(() => expect(dialog()).not.toBeInTheDocument());
    });

    it.each([
        ["a double-click", (el: HTMLElement) => { fireEvent.click(el); fireEvent.click(el); fireEvent.doubleClick(el); }],
        ["two quick clicks", (el: HTMLElement) => { fireEvent.click(el); fireEvent.click(el); }],
    ])("%s on the popup's Join starts only one call", async (_label, clickTwice) => {
        renderSessionHeader({ viewer: "expert", kind: "seminar" });
        fireEvent.click(headerJoin());
        fireEvent.click(acknowledgeBox());
        clickTwice(dialogJoin());

        await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
        await new Promise((r) => setTimeout(r, 50));
        expect(start).toHaveBeenCalledTimes(1);
        expect(window.open).toHaveBeenCalledTimes(1);
    });

    it("the box is unticked the moment Join is clicked, so the fading popup's Join is disabled", async () => {
        renderSessionHeader({ viewer: "expert", kind: "seminar" });
        fireEvent.click(headerJoin());
        fireEvent.click(acknowledgeBox());
        const join = dialogJoin();
        fireEvent.click(join);
        expect(join).toBeDisabled();
    });

    it("after a successful join, a fresh popup can join again (rejoin)", async () => {
        renderSessionHeader({ viewer: "expert", kind: "individual" });
        fireEvent.click(headerJoin());
        fireEvent.click(acknowledgeBox());
        fireEvent.click(dialogJoin());
        await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(dialog()).not.toBeInTheDocument());

        fireEvent.click(headerJoin());
        fireEvent.click(acknowledgeBox());
        fireEvent.click(dialogJoin());
        await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
        expect(window.open).toHaveBeenCalledTimes(2);
    });

    it("a click outside the popup does not close it (a double-clicked Join keeps it open)", async () => {
        renderSessionHeader({ viewer: "expert", kind: "seminar" });
        fireEvent.click(headerJoin());
        const container = document.querySelector(".MuiDialog-container") as HTMLElement;
        fireEvent.mouseDown(container);
        fireEvent.click(container);
        // Longer than MUI's ~225ms exit transition, so a closing dialog would be gone by now.
        await new Promise((r) => setTimeout(r, 500));
        expect(dialog()).toBeInTheDocument();
        expect(start).not.toHaveBeenCalled();
    });

    it("Escape closes the popup without starting anything", async () => {
        renderSessionHeader({ viewer: "expert", kind: "seminar" });
        fireEvent.click(headerJoin());
        fireEvent.click(acknowledgeBox());
        fireEvent.keyDown(dialog()!, { key: "Escape" });
        await waitFor(() => expect(dialog()).not.toBeInTheDocument());
        expect(start).not.toHaveBeenCalled();
    });

    it("Cancel closes the popup without starting anything", async () => {
        renderSessionHeader({ viewer: "expert", kind: "seminar" });
        fireEvent.click(headerJoin());
        fireEvent.click(acknowledgeBox());
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

        await waitFor(() => expect(dialog()).not.toBeInTheDocument());
        expect(start).not.toHaveBeenCalled();
        expect(window.open).not.toHaveBeenCalled();
    });

    it("a box ticked before Cancel is unticked when the popup opens again", async () => {
        renderSessionHeader({ viewer: "expert", kind: "individual" });
        fireEvent.click(headerJoin());
        fireEvent.click(acknowledgeBox());
        expect(acknowledgeBox()).toBeChecked();
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
        await waitFor(() => expect(dialog()).not.toBeInTheDocument());

        fireEvent.click(headerJoin());
        expect(acknowledgeBox()).not.toBeChecked();
        expect(dialogJoin()).toBeDisabled();
    });

    it("the box must be ticked again on every join, even after a successful one", async () => {
        renderSessionHeader({ viewer: "expert", kind: "seminar" });
        fireEvent.click(headerJoin());
        fireEvent.click(acknowledgeBox());
        fireEvent.click(dialogJoin());
        await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(dialog()).not.toBeInTheDocument());

        fireEvent.click(headerJoin());
        expect(acknowledgeBox()).not.toBeChecked();
        expect(dialogJoin()).toBeDisabled();
        expect(start).toHaveBeenCalledTimes(1);
    });

    it.each([
        ["seminar", "seminar"],
        ["1:1 appointment", "individual"],
    ] as const)("a student's Join on a %s goes straight to the call with no popup", async (_label, kind) => {
        renderSessionHeader({ viewer: "customer", kind });
        fireEvent.click(headerJoin());

        expect(dialog()).not.toBeInTheDocument();
        expect(window.open).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(start).toHaveBeenCalledWith({ groupChatId: "gc1" }));
    });

    it("before the start time the header Join stays disabled and no popup can open", () => {
        renderSessionHeader({ viewer: "expert", kind: "seminar", live: false });
        expect(headerJoin()).toBeDisabled();
        fireEvent.click(headerJoin());
        expect(dialog()).not.toBeInTheDocument();
    });
});
