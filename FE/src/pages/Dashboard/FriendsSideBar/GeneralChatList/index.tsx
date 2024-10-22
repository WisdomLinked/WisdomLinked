import { useState, useEffect } from "react";
import { useAppSelector } from "../../../../store";
import GeneralChatListItem from "./GeneralChatListItem";

const GeneralChatList = () => {
    const { auth: { userDetails } } = useAppSelector((state) => state);
    const [updatedGeneralChats, set_updatedGeneralChats] = useState<any>([])
    useEffect(() => {
        let temp: any = []
        let globalChat: any, adminChat: any, generalChat: any
        userDetails.generalChats?.forEach((item: any) => {
            const chat = {
                ...item,
                missedChats: userDetails?.missedChats?.[item?._id] || 0
            }
            if (item.name === 'Global Chat') {
                chat.type = 'global'
                globalChat = chat
            } else if (item.name === 'Admin') {
                chat.type = 'admin'
                adminChat = chat
            } else if (item.admin._id === userDetails.userId) {
                chat.type = 'mine'
                generalChat = chat
            } else {
                temp.push(chat)
            }
        })
        if (generalChat) {
            temp.unshift(generalChat)
        }
        if (globalChat) {
            temp.unshift(globalChat)
        }
        if (adminChat) {
            temp.unshift(adminChat)
        }
        set_updatedGeneralChats([...temp])

    }, [userDetails])
    return (
        <div className="w-full my-5">
            {updatedGeneralChats.map((chat: any) => (
                <GeneralChatListItem
                    chat={chat}
                    key={chat._id}
                    missedChats={chat.missedChats}
                    lastChatDate={chat.updatedAt}
                />
            ))}
        </div>
    );
};

export default GeneralChatList;
