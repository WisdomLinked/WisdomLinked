import React, { useState, useEffect } from "react";
import gif from "../../../assets/images/typing.gif";
import { useAppSelector } from "../../../store";
import { onTyping } from "../../../services/rcRealtime";
import { toRocketChatUsername } from "../../../utils/rocketchatUsername";

const Typing = ({ theme = "dark" }: any) => {
    const { auth: { userDetails }, chat: { chosenChatDetails, chosenGroupChatDetails, rcChannelId } } = useAppSelector(state => state);

    const [typingUsers, set_typingUsers] = useState<string[]>([]);

    useEffect(() => {
        if (!rcChannelId) {
            set_typingUsers([]);
            return;
        }

        const unsub = onTyping(({ roomId, username, isTyping }) => {
            if (String(roomId) !== String(rcChannelId)) return;
            const myRc = userDetails?.email ? toRocketChatUsername(userDetails.email) : "";
            // RC sends email-derived slug for typing, not WL display name
            if (myRc && String(username).toLowerCase() === myRc.toLowerCase()) return;

            set_typingUsers(prev => {
                if (isTyping) {
                    return prev.includes(username) ? prev : [...prev, username];
                } else {
                    return prev.filter(u => u !== username);
                }
            });
        });

        // Clear when chat changes
        set_typingUsers([]);

        return () => {
            unsub();
            set_typingUsers([]);
        };
    }, [rcChannelId, userDetails?.username, userDetails?.email]);

    if (typingUsers.length === 0) return null;

    return (
        <div className={`flex items-center font-semibold px-4 py-2 ${theme === "light" ? "text-slate-600" : "text-lightgrey"}`}>
            <>
                {typingUsers.map((username, index) => (
                    <span key={username} className="mr-1">
                        {username}{index !== typingUsers.length - 1 ? ',' : ''}
                    </span>
                ))}
                <img
                    src={gif}
                    alt="dots"
                    className="w-[40px] h-auto ml-2"
                />
            </>
        </div>
    );
};

export default Typing;
