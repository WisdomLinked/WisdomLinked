import React, { useEffect, useState } from "react";
import { useAppSelector } from "../../../../store";
import GroupChatListItem from "./GroupChatListItem";

import { styled } from "@mui/system";

const SearchInput = styled("input")({
    width: "100%",
    padding: "10px",
    marginBottom: "20px",
    borderRadius: "5px",
    border: "1px solid #444", // Darker border
    fontSize: "16px",
    backgroundColor: "#222", // Blackish background
    color: "#fff", // White text color for contrast
    outline: "none",
    caretColor: "#00ffff", // Highlighted cursor color to match the theme
    "::placeholder": {
        color: "#888", // Greyish placeholder color
    },
});

const GroupChatList = ({ type }: { type: string }) => {
    const { friends: { groupChatList }, auth: { userDetails } } = useAppSelector((state) => state);
    const [updatedGroupChats, set_updatedGroupChats] = useState<any>([])
    const [searchQuery, setSearchQuery] = useState<string>("");

    useEffect(() => {
        const now = new Date().getTime();
        // console.log("GroupChatList: groupChatList", groupChatList[0]);
        const upcomingChats = groupChatList.filter((chat: any) => new Date(chat.end).getTime() >= now && chat.type === type);
        const pastChats = groupChatList.filter((chat: any) => new Date(chat.end).getTime() < now && chat.type === type);

        // Sort upcoming chats in ascending order
        upcomingChats.sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());
        // Sort past chats in descending order
        pastChats.sort((a: any, b: any) => new Date(b.end).getTime() - new Date(a.end).getTime());

        // Combine sorted arrays and add isPast property
        const sortedChats = [...upcomingChats, ...pastChats].map((item: any) => ({
            ...item,
            missedChats: userDetails.missedChats?.[item.groupId] || 0,
            isPast: new Date(item.end).getTime() < now,
        }));

        set_updatedGroupChats(sortedChats);
    }, [groupChatList, userDetails]);

    const filteredChats = updatedGroupChats.filter((chat: any) =>
        chat.groupName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-full my-5">
            {/* Added Search Input */}
            <SearchInput
                type="text"
                placeholder="Search seminars..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            {filteredChats.map((chat: any) => (
                <GroupChatListItem
                    chat={chat}
                    key={chat.groupId}
                    missedChats={chat.missedChats}
                    lastChatDate={chat.lastChatDate}
                    isPast={chat.isPast}
                />
            ))}
        </div>
    );
};

export default GroupChatList;
