import React, { useState, useEffect, useRef } from "react";
import MessagesHeader from "./Header";
import Message from "./Message";
import { useAppSelector } from "../../../../store";
import { Message as MessageType } from "../../../../actions/types";
import DateSeparator from "./DateSeparator";
import {doGetEventsBetweenCustomerAndExpert, profileImageFetch} from "../../../../api/api";
import { useDispatch } from "react-redux";
import { formatDateHH_MM_AMPM, isTheEventGoingOn } from "../../../../actions/common";
import MessageCalendar from "./calendar";
import CloseIcon from '@mui/icons-material/Close';
import SeminarDetails from "../../seminarDetails";
import { deleteGroupAction } from "../../../../actions/groupChatActions";
import ExpertSeminar from "../../_ExpertDashboard/seminar";

const Messages = ({ theme = "dark" }: any) => {
    const dispatch = useDispatch()
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const prevMessagesLength = useRef(0);
    const { chat, auth: { userDetails },  friends: { friends } } = useAppSelector((state) => state);
    const { chosenChatDetails, messages, chosenGroupChatDetails, currentPage, gotAllChats, isNewMessage } = chat;

    const [scrollPosition, setScrollPosition] = useState(0);
    const [isScrollToTop, set_isScrollToTop] = useState(false)
    const [isFirstLoad, set_isFirstLoad] = useState(true)

    const [events, set_events] = useState<Array<any>>([])
    const [eventsModalShow, set_eventsModalShow] = useState(false)
    const [seminarDetailsModalShow, set_seminarDetailsModalShow] = useState(false)
    const [editSeminarModalShow, set_editSeminarModalShow] = useState(false)
    const [profiles, setProfiles] = useState(new Map<string, any>()); // Map to store unique user profiles
    const [profileImages, setProfileImages] = useState(new Map<string, string>()); // Map to store profile images in Base64

    const handleDeleteCommunityChat = () => {
        if (!chosenGroupChatDetails?.groupId) return;
        if (!window.confirm("Are you sure you want to delete this community chat?")) return;
        dispatch(deleteGroupAction({
            groupChatId: chosenGroupChatDetails.groupId,
            groupChatName: chosenGroupChatDetails.groupName
        }));
        set_seminarDetailsModalShow(false);
    };

    useEffect(() => {
        const processMessages = async () => {
            const tempProfiles = new Map<string, any>();
            const tempImages = new Map<string, string>();
            console.log("inside processMessages");

            for (const message of messages) {
                const { author, author:{_id} } = message;

                // Check if userId is already processed
                if (!tempProfiles.has(_id)) {
                    tempProfiles.set(_id, author); // Save the profile in the map

                    // Fetch the image if it exists
                    if (author.image) {
                        try {
                            const base64Image = await profileImageFetch(author.image, 'small');
                            tempImages.set(_id, base64Image as string); // Save the Base64 image
                        } catch (error) {
                            console.error(`Error fetching Base64 image for userId ${_id}:`, error);
                        }
                    }
                }
            }

            // Update states with the unique profiles and images
            setProfiles(tempProfiles);
            setProfileImages(tempImages);
        };

        processMessages();
    }, []);

    useEffect(() => {
        const processMessages = async () => {
            const tempImages = new Map<string, string>();

            for (const message of messages) {
                const userId = message.author._id;
                // If not fetched yet, fetch it
                if (message.author.image && !tempImages.has(userId)) {
                    try {
                        const base64Image = await profileImageFetch(message.author.image, 'small');
                        tempImages.set(userId, base64Image as string);
                    } catch (error) {
                        console.error(`Error fetching Base64 image for userId ${userId}:`, error);
                    }
                }
            }

            setProfileImages(tempImages);
        };

        processMessages();
    }, [messages]);

    const sameAuthor = (message: MessageType, index: number) => {
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

    const handleScroll = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
        setScrollPosition(e.currentTarget.scrollTop);
        if (e.currentTarget.scrollTop === 0 && e.currentTarget.scrollHeight !== e.currentTarget.clientHeight)
            set_isScrollToTop(true)
    };

    const getChatHistory = () => {
        console.log(chosenChatDetails)
        if (chosenChatDetails) {
            fetchDirectChatHistory({
                receiverUserId: chosenChatDetails.userId,
                currentPage: currentPage
            });
        }

        if (chosenGroupChatDetails) {
            fetchGroupChatHistory({
                groupChatId: chosenGroupChatDetails.groupId,
                currentPage: currentPage
            })
        }
    }

    const setEvents = async () => {
        const expertId = userDetails?.role === 'expert' ? userDetails?._id : chosenChatDetails?.userId
        const customerId = userDetails?.role !== 'expert' ? userDetails?._id : chosenChatDetails?.userId
        if (chosenChatDetails) {
            let temp = userDetails.events.filter((x: any) => {
                if (userDetails?.role === 'expert') {
                    return x.customer._id === customerId || x.customer === customerId
                } else {
                    return x.expert._id === expertId || x.expert === expertId
                }
            })
            set_events([...temp])
        } else if (chosenGroupChatDetails) {
            let temp = userDetails.groupChats.filter((x: any) => x._id === chosenGroupChatDetails.groupId)
            set_events([...temp])
        }
    }

    useEffect(() => {
        setEvents()
        set_eventsModalShow(false)
        set_seminarDetailsModalShow(false)
        set_editSeminarModalShow(false)
    }, [chosenChatDetails, chosenGroupChatDetails])

    useEffect(() => {
        if (isScrollToTop && !gotAllChats) {
            console.log('SCROLL GETS TO TOP ------------------')
            getChatHistory()
        }
        set_isScrollToTop(false)
    }, [isScrollToTop])

    useEffect(() => {
        getChatHistory()
        set_isFirstLoad(true)
    }, [chosenChatDetails, chosenGroupChatDetails]);

    useEffect(() => {
        if (messages.length > prevMessagesLength.current) {
            console.log("New message detected. Playing audio...");

            if (!isFirstLoad && audioRef.current) {
                audioRef.current.volume = 0.005;
                audioRef.current
                    .play()
                    .then(() => console.log("Audio played successfully"))
                    .catch((err) => console.error("Error playing audio:", err));
            }
            scrollToBottom();
        }
        prevMessagesLength.current = messages.length; // Update the previous messages length
    }, [messages]);

    return (
        <div
            className={`w-full flex flex-col items-center h-full overflow-auto pb-[10px] ${theme === "light" ? "bg-white" : ""}`}
            onScroll={handleScroll}
        >
            <audio ref={audioRef} preload="auto">
                <source
                    src="https://www.soundjay.com/buttons/sounds/button-16a.mp3"
                    type="audio/mp3"
                />
                Your browser does not support the audio element.
            </audio>
            <MessagesHeader
                events={events}
                scrollPosition={scrollPosition}
                openCalendarModal={() => set_eventsModalShow(true)}
                openSeminarModal={() => set_seminarDetailsModalShow(true)}
                openEditSeminarModal={() => set_editSeminarModalShow(true)}
                theme={theme}
            />
            {
                gotAllChats ?
                    <div className={`mt-[15px] text-[13px] text-center px-6 ${theme === "light" ? "text-slate-500" : "text-grey"}`}>
                        {chat.chosenChatDetails?.userId
                            ? `This is the beginning of your conversation with ${chat.chosenChatDetails?.username}`
                            : "This is the beginning of the conversation with your friends!"}
                    </div>
                    : null
            }
            {messages.map((message: any, index) => {
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

                // Handle direct chat and group chat scenarios
                let participantImage = null;

                if (chosenChatDetails) {
                    // Direct chat
                    participantImage = chosenChatDetails.image;
                } else if (chosenGroupChatDetails) {
                    // Group chat: Find the participant in the group
                    const participant = chosenGroupChatDetails?.participants?.find(
                        (participant: any) => participant._id === message.author._id
                    );
                    participantImage = participant?.image;
                }

                const isFriend = friends.find((x: any) => (x._id === message.author._id))
                const disableBookButton = message.author?.role === 'admin' || userDetails?.role === 'admin' || userDetails?.status === 'review' || message.author?.status === 'review'
                return (
                    <div key={message._id + index} style={{ width: "97%" }}>
                        {(!isSameDay || index === 0) && (
                            <DateSeparator date={message.createdAt} theme={theme} />
                        )}

                        <Message
                            content={message.content}
                            userId={message.author._id}
                            username={message.author.username}
                            // image={chosenChatDetails.image}
                            // image={participantImage} // Dynamically use image
                            image={profileImages.get(message.author._id)}
                            role={message.author.role}
                            status={message.author.status}
                            sameAuthor={sameAuthor(message, index)}
                            date={message.createdAt}
                            incomingMessage={incomingMessage}
                            isFriend={isFriend}
                            disableBookButton={disableBookButton}
                            myRole={userDetails?.role}
                            hideDate={isSameDay && isSameTime}
                            theme={theme}
                        />
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
            {
                eventsModalShow ?
                    <div className={`absolute top-0 left-0 w-full h-full z-[1000] p-4 sm:p-8 ${theme === "light" ? "bg-black/30 backdrop-blur-sm" : "bg-white bg-opacity-10 backdrop-blur-sm"}`}>
                        <div className={`w-full h-full relative rounded-md p-6 flex flex-col ${theme === "light" ? "bg-white text-slate-900 shadow-xl" : "bg-black text-white"}`}>
                            <div className={`text-center text-2xl mb-6 font-semibold ${theme === "light" ? "text-slate-900" : "text-white"}`}>Events with "{chosenChatDetails?.username}"</div>
                            <button
                                className={theme === "light" ? "absolute right-2 top-2 rounded-md hover:bg-slate-100 p-1" : "absolute right-2 top-2 rounded-md hover:bg-grey"}
                                onClick={() => set_eventsModalShow(false)}
                            >
                                <CloseIcon />
                            </button>
                            <MessageCalendar events={events} />
                        </div>
                    </div> :
                    null
            }
            {
                seminarDetailsModalShow ?
                    <div className={`absolute top-0 left-0 w-full h-full z-[1000] p-4 sm:p-8 flex items-center justify-center ${theme === "light" ? "bg-black/30 backdrop-blur-sm" : "bg-white bg-opacity-10 backdrop-blur-sm"}`}>
                        <div
                            className="absolute top-0 left-0 w-full h-full cursor-pointer"
                            onClick={() => set_seminarDetailsModalShow(false)}
                        />
                        <div className={`w-full max-w-[560px] rounded-2xl p-6 relative shadow-xl ${theme === "light" ? "bg-white text-slate-900" : "bg-black text-white"}`}>
                            <div className={`text-center text-2xl mb-6 font-semibold ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                                {chosenGroupChatDetails?.type === "community" ? "Chat Details" : "Seminar Details"}
                            </div>
                            <button
                                className={theme === "light" ? "absolute right-2 top-2 rounded-md hover:bg-slate-100 p-1" : "absolute right-2 top-2 rounded-md hover:bg-grey"}
                                onClick={() => set_seminarDetailsModalShow(false)}
                            >
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
                                type={chosenGroupChatDetails?.type}
                                createdAt={chosenGroupChatDetails?.createdAt}
                                canDeleteCommunityChat={
                                    (() => {
                                        if (chosenGroupChatDetails?.type !== "community") return false;
                                        // Handle both populated and unpopulated admin field
                                        const adminId = typeof chosenGroupChatDetails?.admin === 'string' 
                                            ? chosenGroupChatDetails?.admin 
                                            : chosenGroupChatDetails?.admin?._id || chosenGroupChatDetails?.admin?.id;
                                        return adminId && adminId.toString() === userDetails?._id?.toString();
                                    })()
                                }
                                onDeleteCommunityChat={handleDeleteCommunityChat}
                            />
                        </div>
                    </div> :
                    null
            }
            {
                editSeminarModalShow ?
                    <div className={`absolute top-0 left-0 w-full h-full z-[1000] p-4 sm:p-8 ${theme === "light" ? "bg-black/30 backdrop-blur-sm" : "bg-white bg-opacity-10 backdrop-blur-sm"}`}>
                        <div className={`w-full h-full relative rounded-md p-6 flex flex-col ${theme === "light" ? "bg-white text-slate-900 shadow-xl" : "bg-black text-white"}`}>
                            <div className={`text-center text-2xl mb-6 font-semibold ${theme === "light" ? "text-slate-900" : "text-white"}`}>Edit Seminar Details</div>
                            <button
                                className={theme === "light" ? "absolute right-2 top-2 rounded-md hover:bg-slate-100 p-1" : "absolute right-2 top-2 rounded-md hover:bg-grey"}
                                onClick={() => set_editSeminarModalShow(false)}
                            >
                                <CloseIcon />
                            </button>
                            <div className="w-full h-[calc(100%-60px)]">
                                <ExpertSeminar
                                    selectedSeminar={chosenGroupChatDetails}
                                />
                            </div>
                        </div>
                    </div> :
                    null
            }
        </div>
    );
};

export default Messages;
