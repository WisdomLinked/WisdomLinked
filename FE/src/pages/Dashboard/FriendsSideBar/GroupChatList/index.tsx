import React, { useEffect, useState } from "react";
import { useAppSelector } from "../../../../store";
import GroupChatListItem from "./GroupChatListItem";

const GroupChatList = () => {
    const { friends: { groupChatList }, auth: { userDetails } } = useAppSelector((state) => state);
    const [updatedGroupChats, set_updatedGroupChats] = useState<any>([])
    useEffect(() => {
        let temp: any = []
        groupChatList.sort((a: any, b: any) => a.start > b.start ? -1 : 1)
        groupChatList.forEach((item: any) => {
            temp.push({
                ...item,
                missedChats: userDetails.missedChats?.[item.groupId] || 0
            })
            set_updatedGroupChats([...temp])
        })

    }, [groupChatList, userDetails])

    return (
        <div className="w-full my-5">
            {updatedGroupChats.map((chat: any) => (
                <GroupChatListItem
                    chat={chat}
                    key={chat.groupId}
                    missedChats={chat.missedChats}
                    lastChatDate={chat.lastChatDate}
                />
            ))}
        </div>
    );
};

export default GroupChatList;
