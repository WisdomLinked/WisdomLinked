import React from "react";
import Messages from "./Messages";
import NewMessageInput from "./NewMessageInput";
import Typing from "./Typing";
import { useVideoChatContext } from "../../../components/VideoChat/VideoChatContext";

const ChatDetails = ({
    videoChaton,
    theme = "dark",
  }: any) => {
    const { isRoomMinimized } = useVideoChatContext();
    return (
        <div
            className={
                videoChaton && !isRoomMinimized
                    ? "fixed top-[63px] right-0 w-[350px] h-[calc(100vh-63px-100px)]"
                    : "w-full h-full flex flex-col relative"
            }
        >
            <div
                className={
                    theme === "light"
                        ? "w-full h-full flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                        : "w-full h-full flex flex-col"
                }
            >
                <Messages theme={theme} />
                <Typing theme={theme} />
                <NewMessageInput theme={theme} />
            </div>
        </div>
    );
};

export default ChatDetails
