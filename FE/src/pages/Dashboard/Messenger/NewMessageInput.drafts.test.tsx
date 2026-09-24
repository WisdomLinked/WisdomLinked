import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDispatch = vi.fn();
let storeState: any;

vi.mock("react-redux", () => ({
    useDispatch: () => mockDispatch,
    useSelector: (fn: any) => fn(storeState),
}));

const sendRoomTyping = vi.fn((..._args: any[]) => {});
vi.mock("../../../services/rcRealtime", () => ({
    sendRoomTyping: (...args: any[]) => sendRoomTyping(...args),
    connectToRC: vi.fn(),
}));

const sendGroupMessage = vi.fn(async (..._args: any[]) => ({ message: { _id: "m1", content: "sent" } }));
vi.mock("../../../api/chatApi", () => ({
    sendGroupMessage: (...args: any[]) => sendGroupMessage(...args),
    sendDirectMessage: vi.fn(async () => ({ message: { _id: "m2" } })),
    getOrCreateDM: vi.fn(async () => ({ conversationId: "c1", rcChannelId: "r1" })),
}));

vi.mock("../../../api/api", () => ({ callApi: vi.fn() }));
vi.mock("../../../utils/notify", () => ({ notify: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@emoji-mart/data", () => ({ default: {} }));
vi.mock("@emoji-mart/react", () => ({ default: () => null }));
vi.mock("react-quill", () => ({
    default: React.forwardRef((props: any, ref: any) => (
        <textarea
            ref={ref}
            aria-label="composer"
            value={props.value}
            onChange={(e) => props.onChange?.(e.target.value)}
            onBlur={props.onBlur}
            onKeyDown={props.onKeyDown}
        />
    )),
}));

import NewMessageInput from "./NewMessageInput";
import { readDraft } from "../../../utils/chatDraftStore";

const ME = { _id: "me", email: "me@test.com" };

const withGroup = (groupId: string, rcChannelId = `rc-${groupId}`) => ({
    chat: {
        chosenChatDetails: null,
        chosenGroupChatDetails: { groupId },
        conversationId: null,
        rcChannelId,
    },
    auth: { userDetails: ME },
});

const composer = () => screen.getByLabelText("composer") as HTMLTextAreaElement;

const typeInto = (text: string) => fireEvent.change(composer(), { target: { value: text } });

const typingOnCalls = () => sendRoomTyping.mock.calls.filter((c) => c[2] === true);

beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    storeState = withGroup("seminar-1");
});

describe("composer drafts", () => {
    it("keeps unsent text when the conversation is left and re-opened", () => {
        const view = render(<NewMessageInput theme="light" />);
        typeInto("<p>half written</p>");
        view.unmount();

        render(<NewMessageInput theme="light" />);
        expect(composer().value).toBe("<p>half written</p>");
    });

    it("hands the composer over between conversations without mixing them up", () => {
        const view = render(<NewMessageInput theme="light" />);
        typeInto("<p>for the seminar</p>");

        storeState = withGroup("community-1");
        view.rerender(<NewMessageInput theme="light" />);
        expect(composer().value).toBe("");

        typeInto("<p>for the community</p>");

        storeState = withGroup("seminar-1");
        view.rerender(<NewMessageInput theme="light" />);
        expect(composer().value).toBe("<p>for the seminar</p>");

        storeState = withGroup("community-1");
        view.rerender(<NewMessageInput theme="light" />);
        expect(composer().value).toBe("<p>for the community</p>");
    });

    it("stores the draft against its own conversation", () => {
        render(<NewMessageInput theme="light" />);
        typeInto("<p>mine</p>");
        fireEvent.blur(composer());

        expect(readDraft("me|group|seminar-1")).toBe("<p>mine</p>");
        expect(readDraft("me|group|community-1")).toBe("");
    });

    it("drops the stored draft once the message is sent", async () => {
        render(<NewMessageInput theme="light" />);
        typeInto("<p>going out</p>");
        fireEvent.blur(composer());
        expect(readDraft("me|group|seminar-1")).toBe("<p>going out</p>");

        fireEvent.click(screen.getByRole("button", { name: /send message/i }));

        await waitFor(() => expect(sendGroupMessage).toHaveBeenCalled());
        await waitFor(() => expect(readDraft("me|group|seminar-1")).toBe(""));
        expect(composer().value).toBe("");
    });

    it("never files a pending save under the conversation just left", async () => {
        const view = render(<NewMessageInput theme="light" />);
        typeInto("<p>seminar text</p>");

        storeState = withGroup("community-1");
        view.rerender(<NewMessageInput theme="light" />);
        typeInto("<p>community text</p>");

        await new Promise((r) => setTimeout(r, 700));

        expect(readDraft("me|group|seminar-1")).toBe("<p>seminar text</p>");
        expect(readDraft("me|group|community-1")).toBe("<p>community text</p>");
    });

    it("keeps text that is being typed when rcChannelId arrives late", () => {
        storeState = withGroup("seminar-1", "");
        const view = render(<NewMessageInput theme="light" />);
        typeInto("<p>typed before the room resolved</p>");

        storeState = withGroup("seminar-1", "rc-late");
        view.rerender(<NewMessageInput theme="light" />);

        expect(composer().value).toBe("<p>typed before the room resolved</p>");
    });

    it("keeps text when the same conversation is re-dispatched as a new object", () => {
        const view = render(<NewMessageInput theme="light" />);
        typeInto("<p>still here</p>");

        storeState = withGroup("seminar-1");
        view.rerender(<NewMessageInput theme="light" />);

        expect(composer().value).toBe("<p>still here</p>");
    });
});

describe("the typing indicator is not triggered by a restored draft", () => {
    it("announces typing when the person actually types", () => {
        render(<NewMessageInput theme="light" />);
        typeInto("<p>hello</p>");

        expect(typingOnCalls()).toHaveLength(1);
        expect(typingOnCalls()[0][0]).toBe("rc-seminar-1");
    });

    it("stays silent when a draft is restored on open", () => {
        const view = render(<NewMessageInput theme="light" />);
        typeInto("<p>saved earlier</p>");
        view.unmount();
        sendRoomTyping.mockClear();

        render(<NewMessageInput theme="light" />);

        expect(composer().value).toBe("<p>saved earlier</p>");
        expect(typingOnCalls()).toHaveLength(0);
    });

    it("stays silent when a draft is restored by switching back", () => {
        const view = render(<NewMessageInput theme="light" />);
        typeInto("<p>seminar draft</p>");

        storeState = withGroup("community-1");
        view.rerender(<NewMessageInput theme="light" />);
        sendRoomTyping.mockClear();

        storeState = withGroup("seminar-1");
        view.rerender(<NewMessageInput theme="light" />);

        expect(composer().value).toBe("<p>seminar draft</p>");
        expect(typingOnCalls()).toHaveLength(0);
    });

    it("stays silent if the editor re-fires onChange with the restored text unchanged", () => {
        const view = render(<NewMessageInput theme="light" />);
        typeInto("<p>saved earlier</p>");
        view.unmount();
        sendRoomTyping.mockClear();

        render(<NewMessageInput theme="light" />);
        typeInto("<p>saved earlier</p>");

        expect(typingOnCalls()).toHaveLength(0);
    });

    it("announces typing when the same text is written again after sending it", async () => {
        const view = render(<NewMessageInput theme="light" />);
        typeInto("<p>saved earlier</p>");
        view.unmount();
        render(<NewMessageInput theme="light" />);

        fireEvent.click(screen.getByRole("button", { name: /send message/i }));
        await waitFor(() => expect(composer().value).toBe(""));
        sendRoomTyping.mockClear();

        typeInto("<p>saved earlier</p>");

        expect(typingOnCalls()).toHaveLength(1);
    });

    it("announces typing again once the person edits a restored draft", () => {
        const view = render(<NewMessageInput theme="light" />);
        typeInto("<p>saved earlier</p>");
        view.unmount();
        sendRoomTyping.mockClear();

        render(<NewMessageInput theme="light" />);
        typeInto("<p>saved earlier and more</p>");

        expect(typingOnCalls()).toHaveLength(1);
    });

    it("tells the room it was typing in to stop, not the room being opened", () => {
        const view = render(<NewMessageInput theme="light" />);
        typeInto("<p>hello</p>");
        sendRoomTyping.mockClear();

        storeState = withGroup("community-1");
        view.rerender(<NewMessageInput theme="light" />);

        const stops = sendRoomTyping.mock.calls.filter((c) => c[2] === false);
        expect(stops).toHaveLength(1);
        expect(stops[0][0]).toBe("rc-seminar-1");
    });
});
