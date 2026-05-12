import React from "react";
import Messages from "./Messages";
import NewMessageInput from "./NewMessageInput";
import Typing from "./Typing";

const ChatDetails = ({
    videoChaton,
    theme = "dark",
  }: any) => {
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
                        ? "w-full h-full min-h-0 flex flex-col rounded-2xl border-x border-b border-slate-200 bg-[#F6FAFF] shadow-sm overflow-hidden"
                        : "w-full h-full min-h-0 flex flex-col overflow-hidden"
                }
            >
                <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
                    <Messages theme={theme} />
                    <div className="shrink-0">
                        <Typing theme={theme} />
                    </div>
                    <div className="shrink-0">
                        <NewMessageInput theme={theme} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatDetails
