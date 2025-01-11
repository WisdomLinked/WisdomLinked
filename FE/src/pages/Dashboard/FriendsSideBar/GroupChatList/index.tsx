import React, { useEffect, useState } from "react";
import { useAppSelector } from "../../../../store";
import GroupChatListItem from "./GroupChatListItem";

const GroupChatList = () => {
    const { friends: { groupChatList }, auth: { userDetails } } = useAppSelector((state) => state);
    const [updatedGroupChats, set_updatedGroupChats] = useState<any>([])

    useEffect(() => {
        const now = new Date().getTime();
        const upcomingChats = groupChatList.filter((chat: any) => new Date(chat.end).getTime() >= now);
        const pastChats = groupChatList.filter((chat: any) => new Date(chat.end).getTime() < now);

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

    return (
        <div className="w-full my-5">
            {updatedGroupChats.map((chat: any) => (
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
