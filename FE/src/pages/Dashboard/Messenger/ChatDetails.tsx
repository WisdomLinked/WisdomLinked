import React from "react";
import { styled } from "@mui/system";
import Messages from "./Messages";
import NewMessageInput from "./NewMessageInput";
import Typing from "./Typing";
import { useVideoChatContext } from "../../../components/VideoChat/VideoChatContext";

const Wrapper = styled("div")({
    flexGrow: 1,
});

const ChatDetails = () => {
    const { isRoomMinimized } = useVideoChatContext();
    return (
        <div className={
            isRoomMinimized 
                ? "w-full h-full flex flex-col relative"
                : "fixed top-[63px] right-0 w-[350px] h-[calc(100vh-63px-100px)]"
        }>
            <Messages />
            <Typing/>
            <NewMessageInput />
        </div>
    );
};

export default ChatDetails
