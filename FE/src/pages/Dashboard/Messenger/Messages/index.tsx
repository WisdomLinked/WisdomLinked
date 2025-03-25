import React, { useState, useEffect, useRef } from "react";
import MessagesHeader from "./Header";
import Message from "./Message";
import { useAppSelector } from "../../../../store";
import { fetchDirectChatHistory, fetchGroupChatHistory, notifyChatLeft } from "../../../../socket/socketConnection";
import { Message as MessageType } from "../../../../actions/types";
import DateSeparator from "./DateSeparator";
import { doGetEventsBetweenCustomerAndExpert } from "../../../../api/api";
import { useDispatch } from "react-redux";
import { formatDateHH_MM_AMPM, isTheEventGoingOn } from "../../../../actions/common";
import MessageCalendar from "./calendar";
import CloseIcon from '@mui/icons-material/Close';
import SeminarDetails from "../../seminarDetails";
import ExpertSeminar from "../../_ExpertDashboard/seminar";

const Messages = () => {
    const dispatch = useDispatch();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const prevMessagesLength = useRef(0);

    const { chat, auth: { userDetails }, videoChat: { otherUserId }, friends: { friends } } = useAppSelector((state) => state);
    const { chosenChatDetails, messages, chosenGroupChatDetails, currentPage, gotAllChats, isNewMessage } = chat;

    const [scrollPosition, setScrollPosition] = useState(0);
    const [isScrollToTop, set_isScrollToTop] = useState(false);
    const [isFirstLoad, set_isFirstLoad] = useState(true);

    const [events, set_events] = useState<Array<any>>([]);
    const [eventsModalShow, set_eventsModalShow] = useState(false);
    const [seminarDetailsModalShow, set_seminarDetailsModalShow] = useState(false);
    const [editSeminarModalShow, set_editSeminarModalShow] = useState(false);

    const sameAuthor = (message: MessageType, index: number) => {
        if (index === 0) return false;
        return message.author._id === messages[index - 1].author._id;
    };

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
            if (isFirstLoad) set_isFirstLoad(false);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
        setScrollPosition(e.currentTarget.scrollTop);
        if (e.currentTarget.scrollTop === 0 && e.currentTarget.scrollHeight !== e.currentTarget.clientHeight) {
            set_isScrollToTop(true);
        }
    };

    const getChatHistory = () => {
        if (chosenChatDetails) {
            fetchDirectChatHistory({ receiverUserId: chosenChatDetails.userId, currentPage });
        }
        if (chosenGroupChatDetails) {
            fetchGroupChatHistory({ groupChatId: chosenGroupChatDetails.groupId, currentPage });
        }
    };

    const setEvents = async () => {
        const expertId = userDetails?.role === 'expert' ? userDetails?._id : chosenChatDetails?.userId;
        const customerId = userDetails?.role !== 'expert' ? userDetails?._id : chosenChatDetails?.userId;

        if (chosenChatDetails) {
            const temp = userDetails.events.filter((x: any) => {
                return userDetails?.role === 'expert' ? x.customer._id === customerId || x.customer === customerId : x.expert._id === expertId || x.expert === expertId;
            });
            set_events([...temp]);
        } else if (chosenGroupChatDetails) {
            const temp = userDetails.groupChats.filter((x: any) => x._id === chosenGroupChatDetails.groupId);
            set_events([...temp]);
        }
    };

    useEffect(() => {
        setEvents();
        set_eventsModalShow(false);
        set_seminarDetailsModalShow(false);
        set_editSeminarModalShow(false);
    }, [chosenChatDetails, chosenGroupChatDetails]);

    useEffect(() => {
        if (isScrollToTop && !gotAllChats) {
            getChatHistory();
        }
        set_isScrollToTop(false);
    }, [isScrollToTop]);

    useEffect(() => {
        getChatHistory();
        set_isFirstLoad(true);
    }, [chosenChatDetails, chosenGroupChatDetails]);

    useEffect(() => {
        if (messages.length > prevMessagesLength.current) {
            if (!isFirstLoad && audioRef.current) {
                audioRef.current.volume = 0.005;
                audioRef.current.play().catch((err) => console.error("Audio play failed:", err));
            }
            scrollToBottom();
        }
        prevMessagesLength.current = messages.length;
    }, [messages]);

    return (
        <div className="w-full flex flex-col items-center h-full overflow-auto pb-[10px]" onScroll={handleScroll}>
            <audio ref={audioRef} preload="auto">
                <source src="https://www.soundjay.com/buttons/sounds/button-16a.mp3" type="audio/mp3" />
                Your browser does not support the audio element.
            </audio>

            <MessagesHeader
                events={events}
                scrollPosition={scrollPosition}
                openCalendarModal={() => set_eventsModalShow(true)}
                openSeminarModal={() => set_seminarDetailsModalShow(true)}
                openEditSeminarModal={() => set_editSeminarModalShow(true)}
            />

            {gotAllChats && (
                <div className="mt-[15px] text-[13px] text-grey text-center px-6">
                    {chat.chosenChatDetails?.userId
                        ? `This is the beginning of your conversation with ${chat.chosenChatDetails?.username}`
                        : "This is the beginning of the conversation with your friends!"}
                </div>
            )}

            {messages.map((message: any, index) => {
                const thisMessageDate = new Date(message.createdAt).toDateString();
                const prevMessageDate = index > 0 && new Date(messages[index - 1]?.createdAt).toDateString();
                const isSameDay = index > 0 ? thisMessageDate === prevMessageDate : true;
                const thisMessageTime = formatDateHH_MM_AMPM(new Date(message.createdAt));
                const prevMessageTime = index > 0 && formatDateHH_MM_AMPM(new Date(messages[index - 1]?.createdAt));
                const isSameTime = index > 0 ? thisMessageTime === prevMessageTime : false;

                const incomingMessage = message.author._id !== userDetails._id;
                const participantImage = message.author.profileImageUrl;
                const isFriend = friends.find((x: any) => x._id === message.author._id);
                const disableBookButton = message.author?.role === 'admin' || userDetails?.role === 'admin' || userDetails?.status === 'review' || message.author?.status === 'review';

                return (
                    <div key={message._id + index} style={{ width: "97%" }}>
                        {(!isSameDay || index === 0) && <DateSeparator date={message.createdAt} />}

                        <Message
                            content={message.content}
                            userId={message.author._id}
                            username={message.author.username}
                            image={participantImage}
                            role={message.author.role}
                            status={message.author.status}
                            sameAuthor={sameAuthor(message, index)}
                            date={message.createdAt}
                            incomingMessage={incomingMessage}
                            isFriend={isFriend}
                            disableBookButton={disableBookButton}
                            myRole={userDetails?.role}
                            hideDate={isSameDay && isSameTime}
                        />
                    </div>
                );
            })}

            <div ref={messagesEndRef} />

            {eventsModalShow && (
                <div className="absolute top-0 left-0 w-full h-full bg-white bg-opacity-10 backdrop-blur-sm z-[1000] p-4 sm:p-8">
                    <div className="w-full h-full bg-black relative text-white rounded-md p-6 flex flex-col">
                        <div className="text-center text-white text-2xl mb-6">Events with "{chosenChatDetails?.username}"</div>
                        <button className="absolute right-2 top-2 rounded-md hover:bg-grey" onClick={() => set_eventsModalShow(false)}>
                            <CloseIcon />
                        </button>
                        <MessageCalendar events={events} />
                    </div>
                </div>
            )}

            {seminarDetailsModalShow && (
                <div className="absolute top-0 left-0 w-full h-full bg-white bg-opacity-10 backdrop-blur-sm z-[1000] p-4 sm:p-8 flex items-center justify-center">
                    <div className="absolute top-0 left-0 w-full h-full cursor-pointer" onClick={() => set_seminarDetailsModalShow(false)} />
                    <div className="w-max max-w-[460px] bg-black rounded-lg text-white p-6 relative">
                        <div className="text-center text-white text-2xl mb-6">Seminar Details</div>
                        <button className="absolute right-2 top-2 rounded-md hover:bg-grey" onClick={() => set_seminarDetailsModalShow(false)}>
                            <CloseIcon />
                        </button>
                        <SeminarDetails
                            title={chosenGroupChatDetails?.groupName}
                            description={chosenGroupChatDetails?.description}
                            start={chosenGroupChatDetails?.start}
                            duration={chosenGroupChatDetails?.duration}
                            price={chosenGroupChatDetails?.price}
                            admin={chosenGroupChatDetails?.admin}
                            participants={chosenGroupChatDetails?.participants}
                            keywords={chosenGroupChatDetails?.keywords}
                            services={chosenGroupChatDetails?.services}
                        />
                    </div>
                </div>
            )}

            {editSeminarModalShow && (
                <div className="absolute top-0 left-0 w-full h-full bg-white bg-opacity-10 backdrop-blur-sm z-[1000] p-4 sm:p-8">
                    <div className="w-full h-full bg-black relative text-white rounded-md p-6 flex flex-col">
                        <div className="text-center text-white text-2xl mb-6">Edit Seminar Details</div>
                        <button className="absolute right-2 top-2 rounded-md hover:bg-grey" onClick={() => set_editSeminarModalShow(false)}>
                            <CloseIcon />
                        </button>
                        <div className="w-full h-[calc(100%-60px)]">
                            <ExpertSeminar selectedSeminar={chosenGroupChatDetails} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Messages;
