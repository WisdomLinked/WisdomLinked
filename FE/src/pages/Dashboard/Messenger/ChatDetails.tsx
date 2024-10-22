import React from "react";
import { styled } from "@mui/system";
import Messages from "./Messages";
import NewMessageInput from "./NewMessageInput";
import Typing from "./Typing";

const Wrapper = styled("div")({
    flexGrow: 1,
});


const ChatDetails = () => {
    
    return (
        <div className="w-full h-full flex flex-col relative">
            <Messages />
            <Typing/>
            <NewMessageInput />
        </div>
    );
};

export default ChatDetails
