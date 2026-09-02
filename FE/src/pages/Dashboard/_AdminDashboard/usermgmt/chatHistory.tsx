import React, { useEffect, useRef, useState } from "react";
import FriendsTitle from "../../FriendsSideBar/FriendsTitle";
import FriendsListItem from "../../FriendsSideBar/FriendsList/FriendsListItem";
import GroupChatListItem from "../../FriendsSideBar/GroupChatList/GroupChatListItem";
import DateSeparator from "../../Messenger/Messages/DateSeparator";
import Message from "../../Messenger/Messages/Message";
import { doGetDirectChatHistory, doGetGroupChatHistory } from "../../../../api/api";
import { formatDateHH_MM_AMPM } from "../../../../actions/common";
import GeneralChatList from "../../FriendsSideBar/GeneralChatList";
import GeneralChatListItem from "../../FriendsSideBar/GeneralChatList/GeneralChatListItem";

const ChatHistory = ({
    userDetails
}: any) => {
    console.log(userDetails, './//')
    const [isFirstLoad, set_isFirstLoad] = useState(true)
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [selectedChat, set_selectedChat] = useState<any>({});
    const [scrollPosition, setScrollPosition] = useState(0);
    const [isScrollToTop, set_isScrollToTop] = useState(false)
    const [gotAllChats, set_gotAllChats] = useState(false)
    const [currentPage, set_currentPage] = useState(0)
    const [messages, set_messages] = useState<Array<any>>([])


    const sameAuthor = (message: any, index: number) => {
        if (index === 0) {
            return false;
        }
        return message.author._id === messages[index - 1].author._id;
    }

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef?.current.scrollIntoView({ behavior: "smooth" });
            if (isFirstLoad)
                set_isFirstLoad(false)
        }
    };

    const getChatHistory = async (pageNum: any) => {
        set_currentPage(pageNum)
        const response: any =
            selectedChat?.admin ?
                await doGetGroupChatHistory({
                    currentPage: pageNum,
                    groupChatId: selectedChat._id,
                }) :
                await doGetDirectChatHistory({
                    currentPage: pageNum,
                    senderId: userDetails._id,
                    receiverId: selectedChat._id,
                })
        if (response) {
            if (!pageNum) {
                set_messages([...response.result])
            } else {
                set_messages([...response.result, ...messages])
            }
            set_gotAllChats(response.gotAllChats)
        }
    }

    const handleScroll = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
        setScrollPosition(e.currentTarget.scrollTop);
        if (e.currentTarget.scrollTop === 0 && e.currentTarget.scrollHeight !== e.currentTarget.clientHeight)
            set_isScrollToTop(true)
    };

    useEffect(() => {
        if (isScrollToTop && !gotAllChats) {
            console.log('SCROLL GETS TO TOP ------------------')
            getChatHistory(currentPage + 1)
        }
        set_isScrollToTop(false)
    }, [isScrollToTop])

    useEffect(() => {
        if (selectedChat?._id) {
            set_isFirstLoad(true)
            getChatHistory(0)
        }
    }, [selectedChat])

    useEffect(() => {
        if (messages.length && isFirstLoad) {

            scrollToBottom();
        }
    }, [isFirstLoad, messages]);

    return (
        <div className="w-full h-full flex flex-col lg:flex-row justify-between">
            <div className="hidden lg:block min-w-[260px] h-full border-r-[1px] border-lightgrey overflow-y-auto pt-6">
                <FriendsTitle title="General Chats" />
                <div className="pr-4">
                    {
                        userDetails?.generalChats?.map((chat: any, index: number) => {
                            if (chat.name === 'Global Chat') {
                                return
                            } else if (chat.name === 'Admin') {
                                return
                            } else if (chat.admin._id === userDetails._id) {
                                chat.type = 'mine'
                                chat.name = 'General Chat'
                            }
                            return (
                                <GeneralChatListItem
                                    chat={chat}
                                    key={chat._id}
                                    missedChats={chat.missedChats}
                                    lastChatDate={chat.updatedAt}
                                    clickHandler={() => set_selectedChat(chat)}
                                    isActive={selectedChat?._id === chat._id}
                                />
                            )
                        })
                    }
                </div>
                <FriendsTitle title="Private Chats" />
                <div className="pr-4">
                    {
                        userDetails?.friends?.map((f: any, index: number) => (
                            <FriendsListItem
                                key={f._id}
                                username={f.username}
                                id={f._id}
                                email={f.email}
                                image={f.image}
                                clickHandler={() => set_selectedChat(f)}
                                isActive={selectedChat?._id === f._id}
                            />
                        ))
                    }
                </div>
                <div className="bg-grey mt-4 w-[calc(100%-24px)] h-[1px]" />
                <div className="flex items-center mt-2">
                    <FriendsTitle title="Seminars" />
                </div>
                <div className="pr-4">
                    {
                        userDetails?.groupChats?.map((chat: any, index: number) => (
                            <GroupChatListItem
                                key={chat._id}
                                chat={chat}
                                clickHandler={() => set_selectedChat(chat)}
                                isActive={selectedChat?._id === chat._id}
                            />
                        ))
                    }
                </div>
            </div>
            <div className="w-full h-[100px] lg:hidden border-b-[1px] border-b-grey">

            </div>
            <div className="w-full h-[calc(100%-100px)] lg:h-full bg-wl-page overflow-auto py-3 flex flex-col items-center" onScroll={handleScroll}>
                {
                    gotAllChats ?
                        <div className="mt-[15px] text-[13px] text-grey text-center px-6">
                            {!selectedChat?.admin
                                ? `This is the beginning of your conversation with ${selectedChat?.username}`
                                : selectedChat?.type === 'community'
                                  ? 'This is the beginning of the conversation with your community.'
                                  : 'This is the beginning of the conversation with your friends!'}
                        </div>
                        : null
                }
                {messages.map((message, index) => {
                    const thisMessageDate = new Date(
                        message.createdAt
                    ).toDateString();
                    const prevMessageDate =
                        index > 0 &&
                        new Date(messages[index - 1]?.createdAt).toDateString();

                    const isSameDay =
                        index > 0 ? thisMessageDate === prevMessageDate : true;
                    const thisMessageTime = formatDateHH_MM_AMPM(new Date(message.createdAt));
                    const prevMessageTime = index > 0 && formatDateHH_MM_AMPM(new Date(messages[index - 1]?.createdAt));
                    const isSameTime = index > 0 ? thisMessageTime === prevMessageTime : false;
                    const incomingMessage =
                        message.author._id !== (userDetails as any)._id;

                    return (
                        <div key={message._id + index} style={{ width: "97%" }}>
                            {(!isSameDay || index === 0) && (
                                <DateSeparator date={message.createdAt} />
                            )}

                            <Message
                                content={message.content}
                                username={message.author.username}
                                image={message.author.image}
                                sameAuthor={sameAuthor(message, index)}
                                date={message.createdAt}
                                incomingMessage={incomingMessage}
                                hideDate={isSameDay && isSameTime}
                                hiddenDropDown={true}
                                myRole='admin'
                            />
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
};

export default ChatHistory;
