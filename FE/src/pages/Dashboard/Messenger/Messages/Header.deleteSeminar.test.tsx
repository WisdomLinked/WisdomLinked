import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
vi.mock("../../../../actions/groupChatActions", () => ({
    deleteGroupAction: vi.fn((payload: any) => ({ type: "test/deleteGroup", payload })),
    leaveGroupAction: vi.fn((payload: any) => ({ type: "test/leaveGroup", payload })),
    refreshSeminarMembers: vi.fn(() => ({ type: "test/refreshSeminarMembers" })),
}));

import { deleteGroupAction } from "../../../../actions/groupChatActions";
import MessagesHeader from "./Header";

const deleteGroup = vi.mocked(deleteGroupAction);
const APPROVAL = /I have approval from all the participants to delete this seminar/;

const renderSeminarHeader = (participants: string[]) => {
    const seminar = {
        _id: "sem1",
        groupId: "sem1",
        groupName: "Career planning",
        type: "seminar",
        duration: 60,
        admin: "host",
        participants,
        start: "2099-10-08T18:00:00.000Z",
        end: "2099-10-08T19:00:00.000Z",
    };
    const store = configureStore({
        reducer: {
            auth: () => ({ userDetails: { _id: "host", role: "expert", username: "Host", groupChats: [seminar], events: [] } }),
            chat: () => ({
                chosenChatDetails: null,
                chosenGroupChatDetails: seminar,
                currentEvent: null,
                conversationId: null,
            }),
            friends: () => ({ onlineUsers: [] }),
        },
        middleware: getDefault => getDefault({ serializableCheck: false, immutableCheck: false }),
    });
    return render(
        <Provider store={store}>
            <MessagesHeader events={[]} theme="light" />
        </Provider>,
    );
};

const openDeleteFromMenu = () => {
    fireEvent.click(screen.getByTestId("MoreVertIcon").closest("button")!);
    fireEvent.click(screen.getByRole("button", { name: /^Delete Seminar$/ }));
};
const dialog = () => screen.getByRole("dialog", { name: "Delete this seminar?" });
const approvalBox = () => within(dialog()).getByRole("checkbox", { name: APPROVAL });
const deleteButton = () => within(dialog()).getByRole("button", { name: "Delete Seminar" });

describe("deleting a seminar with students from the chat header", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("starts unticked with Delete disabled, and deletes nothing until ticked", () => {
        renderSeminarHeader(["host", "student-1"]);
        openDeleteFromMenu();
        expect(approvalBox()).not.toBeChecked();
        expect(deleteButton()).toBeDisabled();
        fireEvent.click(deleteButton());
        expect(deleteGroup).not.toHaveBeenCalled();
        expect(dialog()).toBeInTheDocument();
    });

    it("ticks when the approval text is clicked, and unticking disables Delete again", () => {
        renderSeminarHeader(["host", "student-1"]);
        openDeleteFromMenu();
        fireEvent.click(within(dialog()).getByText(APPROVAL));
        expect(approvalBox()).toBeChecked();
        expect(deleteButton()).toBeEnabled();
        fireEvent.click(approvalBox());
        expect(deleteButton()).toBeDisabled();
    });

    it("deletes the seminar once approval is ticked", async () => {
        renderSeminarHeader(["host", "student-1"]);
        openDeleteFromMenu();
        fireEvent.click(approvalBox());
        fireEvent.click(deleteButton());
        expect(deleteGroup).toHaveBeenCalledTimes(1);
        expect(deleteGroup).toHaveBeenCalledWith({ groupChatId: "sem1", groupChatName: "Career planning" });
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete this seminar?" })).not.toBeInTheDocument());
    });

    it("asks again after Cancel", async () => {
        renderSeminarHeader(["host", "student-1"]);
        openDeleteFromMenu();
        fireEvent.click(approvalBox());
        fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete this seminar?" })).not.toBeInTheDocument());
        openDeleteFromMenu();
        expect(approvalBox()).not.toBeChecked();
        expect(deleteButton()).toBeDisabled();
        expect(deleteGroup).not.toHaveBeenCalled();
    });

    it("asks again after closing with Escape", async () => {
        renderSeminarHeader(["host", "student-1"]);
        openDeleteFromMenu();
        fireEvent.click(approvalBox());
        fireEvent.keyDown(dialog(), { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete this seminar?" })).not.toBeInTheDocument());
        openDeleteFromMenu();
        expect(approvalBox()).not.toBeChecked();
        expect(deleteGroup).not.toHaveBeenCalled();
    });

    it("keeps the usual confirmation, with no approval checkbox, when no students have joined", () => {
        const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
        renderSeminarHeader(["host"]);
        openDeleteFromMenu();
        expect(confirm).toHaveBeenCalledWith("Delete this seminar for everyone? This cannot be undone.");
        expect(screen.queryByRole("dialog", { name: "Delete this seminar?" })).not.toBeInTheDocument();
        expect(deleteGroup).toHaveBeenCalledWith({ groupChatId: "sem1", groupChatName: "Career planning" });
        confirm.mockRestore();
    });
});
