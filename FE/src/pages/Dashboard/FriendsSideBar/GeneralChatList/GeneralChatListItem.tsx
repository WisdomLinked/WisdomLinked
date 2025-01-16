import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useTheme } from "@mui/material/styles";
import { Tooltip } from "@mui/material";
import { setChosenGroupChatDetails } from "../../../../actions/chatActions";
import { useAppSelector } from "../../../../store";
import { formatDate, formatDateYYYY_MM_DD_h_m } from "../../../../actions/common";
import InboxIcon from "@mui/icons-material/MoveToInbox";
import typing_image from '../../../../assets/images/typing.gif'

const GeneralChatListItem = ({
    chat,
    clickHandler,
    isActive,
    missedChats,
    lastChatDate
}: any) => {
    const theme = useTheme();
    const dispatch = useDispatch();

    const { chat: { chosenGroupChatDetails, groupTyping }, auth: { userDetails } } = useAppSelector((state) => state);
    const isChatActive = clickHandler ? isActive : chosenGroupChatDetails?.groupId === chat?._id;

    const [typingUsers, set_typingUsers] = React.useState<any>([]);
    useEffect(() => {
        const typing = groupTyping.find((item) => item.chatId === chat?._id);
        let temp: any = []
        if (typing) {
            for (let x in typing) {
                if (typing[x] === true && x !== userDetails.userId) {
                    temp.push(x)
                }
            }
        }
        set_typingUsers([...temp])
    }, [groupTyping])

    return (
        <Tooltip title={chat.groupName || chat.name}>
            <button
                onClick={() => {
                    if (clickHandler) {
                        clickHandler()
                    } else {
                        dispatch(setChosenGroupChatDetails({
                            ...chat,
                            groupId: chat?._id,
                            groupName: chat.name
                        }));
                        dispatch({ type: 'updateMissedChatsOfGeneralChat', payload: { receiverId: chat._id, count: 0 } })
                    }
                }}
                className={`w-full rounded-md mt-0 flex items-center space-x-4 px-2 py-[6px] ${isChatActive ? 'bg-darkgrey-1' : 'hover:bg-darkgrey-1'} relative ${chat.type === 'admin' ? 'text-brownyellow' : chat.type === 'global' ? 'text-blue' : chat.type === 'mine' ? 'text-green' : 'text-lightgrey'}`}
            >
                <div title={chat.admin?.status === 'review' ? 'Chat admin is under review' : ''} className={`w-10 h-10 flex items-center justify-center rounded-full border-2 ${chat.type === 'admin' ? 'border-brownyellow' : chat.type === 'global' ? 'border-blue' : chat.type === 'mine' ? 'border-green' : 'border-lightgrey'} ${chat.admin?.status === 'review' ? 'opacity-50' : ''}`}>
                    <InboxIcon fontSize="small" />
                </div>
                <div className="w-[calc(100%-50px)]">
                    {/*<div className="text-md text-left w-full truncate">{userDetails.userId === chat.admin?._id ? chat.description : chat.name}</div>*/}
                    {/*<div className="text-md text-left w-full truncate">{chat.name}</div>*/}
                    <div className="text-md text-left w-full truncate">
                        {chat.name} {chat.type === 'mine' && '(Me)'}
                    </div>

                </div>
                <div className="h-full w-[100px] absolute top-0 right-0 py-2 pr-2 flex flex-col justify-between">
                    <div className="flex items-center justify-end space-x-2">
                        {
                            !isChatActive && typingUsers.length ?
                                <img src={typing_image} className="w-[35px]" />
                                : null
                        }
                        {
                            missedChats ?
                                <div className='px-1.5 rounded-full bg-red text-sm drop-shadow-md text-lightgrey'>
                                    {missedChats}
                                </div> :
                                null
                        }
                    </div>
                    {
                        lastChatDate ?
                            <div className='px-1 rounded-full text-grey text-[12px] font-thin text-right'>
                                {formatDate(new Date(lastChatDate))}
                            </div> :
                            null
                    }
                </div>
            </button>
        </Tooltip>
    );
};

export default GeneralChatListItem;
