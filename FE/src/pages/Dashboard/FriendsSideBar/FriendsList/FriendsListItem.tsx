import React from "react";
import { useDispatch } from "react-redux";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { Tooltip } from "@mui/material";
import Avatar from "../../../../components/Avatar";
import { setChosenChatDetails } from "../../../../actions/chatActions";
import { useAppSelector } from "../../../../store";
import { formatDate } from "../../../../actions/common";
import typing_image from '../../../../assets/images/typing.gif'
import { actionTypes } from "../../../../actions/types";

interface FriendsListItemProps {
    id: string;
    username: string;
    email: string;
    isOnline: boolean;
    lastChatDate: any;
    missedChats: any
}

const FriendsListItem = ({
    id,
    username,
    isOnline,
    email,
    lastChatDate,
    missedChats,
    image,
    clickHandler,
    isActive,
    status
}: any) => {
    const dispatch = useDispatch();

    const { chosenChatDetails, typing } = useAppSelector((state) => state.chat);

    const isTyping = typing.find((item) => item.userId === id);

    // if this friend is same as the person/user typing and this friend is not the one
    // we are currently chatting with(i.e, chosenChatDetails.userId)
    const isFriendTyping =
        isTyping && isTyping.typing && id !== chosenChatDetails?.userId;

    const isChatActive = clickHandler ? isActive : chosenChatDetails?.userId === id;

    return (
        <Tooltip title={email}>
            <div
                className={`rounded-md w-full flex space-x-4 px-2 py-[6px] ${isChatActive ? 'bg-darkgrey-1' : 'hover:bg-darkgrey-1'} cursor-pointer mt-0 relative`}
                onClick={() => {
                    if (clickHandler) {
                        clickHandler()
                    } else {
                        dispatch(setChosenChatDetails({ userId: id, username, image: image }));
                        dispatch({ type: actionTypes.updateMissedChats, payload: { receiverId: id, count: 0 } })
                    }
                }}
            >
                <div title={status === 'review' ? 'User is under review' : ''} className={`${status === 'review' ? 'opacity-50' : ''}`}>
                    <Avatar username={username} isOnline={isOnline} image={image} />
                </div>
                <div className="flex flex-col w-[135px]">
                    <div className="text-md text-lightgrey w-full truncate">{username}</div>
                    <div className="text-sm text-grey w-full truncate">{email}</div>
                </div>
                <div className="h-full w-[100px] absolute top-0 right-0 py-2 pr-2 flex flex-col justify-between">
                    <div className="flex items-center justify-end space-x-2">
                        {
                            isFriendTyping ?
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
            </div>
        </Tooltip>
    );
};

export default FriendsListItem;
