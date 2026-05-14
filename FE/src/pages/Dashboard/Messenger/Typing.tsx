import React, { useState, useEffect, useRef } from "react";
import gif from "../../../assets/images/typing.gif";
import { useAppSelector } from "../../../store";
import { onTyping } from "../../../services/rcRealtime";
import { toRocketChatUsername } from "../../../utils/rocketchatUsername";

const Typing = ({ theme = "dark" }: any) => {
    const { auth: { userDetails }, chat: { chosenChatDetails, chosenGroupChatDetails, rcChannelId } } = useAppSelector(state => state);

    const [typingUsers, set_typingUsers] = useState<string[]>([]);
    const typingExpiryTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const clearTypingExpiry = (username: string) => {
        const t = typingExpiryTimersRef.current[username];
        if (t) {
            clearTimeout(t);
            delete typingExpiryTimersRef.current[username];
        }
    };

    const clearAllTypingExpiry = () => {
        Object.values(typingExpiryTimersRef.current).forEach(clearTimeout);
        typingExpiryTimersRef.current = {};
    };

    const resolveDisplayName = (rcUsername: string): string => {
        const rcLower = String(rcUsername || '').toLowerCase();
        if (!rcLower) return 'Someone';

        // In 1:1 DM, any non-self typing event is the peer.
        if (chosenChatDetails?.username && chosenChatDetails?.userId) {
            return String(chosenChatDetails.username);
        }

        const participants = Array.isArray(chosenGroupChatDetails?.participants)
            ? chosenGroupChatDetails.participants
            : [];
        const peer = participants.find((p: any) => {
            const pEmail = p?.email ? toRocketChatUsername(String(p.email)).toLowerCase() : '';
            const pRc = p?.rocketChatUsername ? String(p.rocketChatUsername).toLowerCase() : '';
            return pEmail === rcLower || pRc === rcLower;
        });
        if (peer?.username) return String(peer.username);

        return rcUsername;
    };

    useEffect(() => {
        if (!rcChannelId) {
            set_typingUsers([]);
            clearAllTypingExpiry();
            return;
        }

        const unsub = onTyping(({ roomId, username, isTyping }) => {
            if (String(roomId) !== String(rcChannelId)) return;
            const myRc = userDetails?.email ? toRocketChatUsername(userDetails.email) : "";
            // RC sends email-derived slug for typing, not WL display name
            if (myRc && String(username).toLowerCase() === myRc.toLowerCase()) return;

            const displayName = resolveDisplayName(username);
            set_typingUsers(prev => {
                if (isTyping) {
                    return prev.includes(displayName) ? prev : [...prev, displayName];
                } else {
                    return prev.filter(u => u !== displayName);
                }
            });

            if (isTyping) {
                // RC sometimes misses a clean "stop typing" event; auto-expire stale indicators.
                clearTypingExpiry(displayName);
                typingExpiryTimersRef.current[displayName] = setTimeout(() => {
                    set_typingUsers((prev) => prev.filter((u) => u !== displayName));
                    clearTypingExpiry(displayName);
                }, 3500);
            } else {
                clearTypingExpiry(displayName);
            }
        });

        // Clear when chat changes
        set_typingUsers([]);
        clearAllTypingExpiry();

        return () => {
            unsub();
            set_typingUsers([]);
            clearAllTypingExpiry();
        };
    }, [rcChannelId, userDetails?.username, userDetails?.email, chosenChatDetails, chosenGroupChatDetails]);

    if (typingUsers.length === 0) return null;

    return (
        <div
            className={`flex items-center font-semibold px-4 py-2 ${
                theme === "light" ? "bg-wl-page text-stone-600" : "text-lightgrey"
            }`}
        >
            <>
                {typingUsers.map((username, index) => (
                    <span key={username} className="mr-1">
                        {username}
                        {typingUsers.length === 1 ? ' is typing' : index !== typingUsers.length - 1 ? ',' : ' are typing'}
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
