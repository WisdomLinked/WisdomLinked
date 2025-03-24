import React from "react";
import IconButton from "@mui/material/IconButton";
import ChatIcon from "@mui/icons-material/Chat";
import ChatOutlinedIcon from "@mui/icons-material/ChatOutlined";

interface ChatButtonProps {
  isChatOpen: boolean;
  toggleChat: () => void;
}

const ChatButton: React.FC<ChatButtonProps> = ({ isChatOpen, toggleChat }) => {
  return (
    <IconButton onClick={toggleChat} style={{ color: "white" }}>
      {isChatOpen ? <ChatIcon /> : <ChatOutlinedIcon />}
    </IconButton>
  );
};

export default ChatButton;
