import React, { useState, useEffect } from "react";
import gif from "../../../assets/images/typing.gif";
import { useAppSelector } from "../../../store";

const Typing = () => {
    const { auth: { userDetails }, chat: { chosenChatDetails, typing, chosenGroupChatDetails, groupTyping } } = useAppSelector(state => state);

    const [directChatTyping, set_directChatTyping] = useState<any>(null)
    const [typingUsers, set_typingUsers] = useState<Array<any>>([])

    useEffect(() => {
        if (typing && chosenChatDetails) {
            set_directChatTyping(typing.find((item: any) => item.userId === chosenChatDetails?.userId))
        } else if (groupTyping && chosenGroupChatDetails) {
            const typing = groupTyping.find((item) => item.chatId === chosenGroupChatDetails?.groupId);
            let temp: any = []
            if (typing) {
                for (let x in typing) {
                    if (typing[x] === true && x !== userDetails.userId) {
                        temp.push(chosenGroupChatDetails.participants?.find((item: any) => item._id === x)?.username)
                    }
                }
            }
            set_typingUsers([...temp])
        }
    }, [typing, groupTyping, chosenChatDetails, chosenGroupChatDetails])

    return (
        (directChatTyping?.typing) ?
            <div className="flex items-center font-bold pl-4 text-lightgrey">
                <>
                    {chosenChatDetails?.username}
                    <img
                        src={gif}
                        alt="dots"
                        className="w-[40px] h-auto ml-2"
                    />
                </>
            </div> :
            typingUsers?.length ?
                <div className="flex items-center font-bold pl-4 text-lightgrey">
                    <>
                        {
                            typingUsers.map((item: any, index: number) => {
                                return (
                                    <span key={index} className="mr-2">
                                        {item}{index !== typingUsers.length - 1 ? ',' : ''}
                                    </span>
                                )
                            })
                        }
                        <img
                            src={gif}
                            alt="dots"
                            className="w-[40px] h-auto ml-2"
                        />
                    </>
                </div> :
                null

    );
};

export default Typing;
