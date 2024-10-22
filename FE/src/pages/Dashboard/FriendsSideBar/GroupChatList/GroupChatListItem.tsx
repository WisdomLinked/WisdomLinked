import React from "react";
import { useDispatch } from "react-redux";
import { useTheme } from "@mui/material/styles";
import { Tooltip } from "@mui/material";
import { setChosenGroupChatDetails } from "../../../../actions/chatActions";
import { useAppSelector } from "../../../../store";
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { formatDate, formatDateYYYY_MM_DD_h_m } from "../../../../actions/common";
import { actionTypes } from "../../../../actions/types";
import typing_image from '../../../../assets/images/typing.gif'

const GroupChatListItem = ({
    chat,
    clickHandler,
    isActive,
    missedChats,
    lastChatDate
}: any) => {
    const theme = useTheme();
    const dispatch = useDispatch();

    const { chat: { chosenGroupChatDetails, groupTyping }, auth: { userDetails } } = useAppSelector((state) => state);

    const isChatActive = clickHandler ? isActive : chosenGroupChatDetails?.groupId === chat.groupId;

    const [typingUsers, set_typingUsers] = React.useState<any>([]);
    React.useEffect(() => {
        const typing = groupTyping.find((item) => item.chatId === chat?.groupId);
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
                        dispatch(setChosenGroupChatDetails(chat));
                        dispatch({ type: actionTypes.updateMissedChats, payload: { groupId: chat.groupId, count: 0 } })
                    }
                }}
                className={`w-full rounded-md flex items-center space-x-4 px-2 py-[6px] ${isChatActive ? 'bg-darkgrey-1' : 'hover:bg-darkgrey-1'} relative`}
            >
                <div title={chat.admin?.status === 'review' ? 'Chat admin is under review' : ''} className={`w-10 h-10 flex items-center justify-center rounded-full border-2 border-lightgrey text-lightgrey ${chat.admin?.status === 'review' ? 'opacity-50' : ''}`}>
                    <CalendarMonthIcon fontSize="small" />
                </div>
                <div className="w-[calc(100%-50px)]">
                    <div className="text-md text-lightgrey text-left w-full truncate">{clickHandler ? chat.name : chat.groupName}</div>
                    <div className="text-sm text-grey text-left w-full truncate">{formatDateYYYY_MM_DD_h_m(chat.start)}</div>
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
                                <div className='px-1.5 rounded-full bg-red text-lightgrey text-sm drop-shadow-md'>
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

export default GroupChatListItem;
