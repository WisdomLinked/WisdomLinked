import React, { useState } from "react";
import Messages from "./Messages";
import NewMessageInput from "./NewMessageInput";
import Typing from "./Typing";

export type ReplyDraft = {
    messageId: string;
    authorName: string;
    excerpt: string;
};

const ChatDetails = ({
    videoChaton,
    theme = "dark",
  }: any) => {
    const [replyTo, setReplyTo] = useState<ReplyDraft | null>(null);

    return (
        <div
            className={
                videoChaton
                    ? "fixed top-[63px] right-0 w-[350px] h-[calc(100vh-63px-100px)]"
                    : "w-full h-full min-h-0 flex flex-col relative"
            }
        >
            <div
                className={
                    theme === "light"
                        ? "w-full h-full min-h-0 flex flex-col rounded-2xl border-x border-b border-stone-200 bg-wl-page shadow-sm overflow-hidden"
                        : "w-full h-full min-h-0 flex flex-col overflow-hidden"
                }
            >
                <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
                    <Messages theme={theme} onReplyMessage={setReplyTo} />
                    <div className="shrink-0">
                        <Typing theme={theme} />
                    </div>
                    <div className="shrink-0">
                        <NewMessageInput theme={theme} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatDetails
