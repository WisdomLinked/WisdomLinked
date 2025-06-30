import React, {useEffect, useRef, useState} from "react";
import { useAppSelector } from "../../../store";
import Avatar from "../../../components/Avatar";
import { formatDateYYYY_MM_DD_h_m } from "../../../actions/common";
import {doCancelEvent,cancelIndividualAppointment, doCancelPendingSeminar, doUpdateEvent, profileImageFetch} from "../../../api/api";
import { updateMe } from "../../../actions/authActions";
import { useDispatch } from "react-redux";
import { SetLoadingStatus } from "../../../actions/appActions";
import { useNavigate } from "react-router-dom";
import CloseIcon from '@mui/icons-material/Close';
import SelectDateTime from "../selectDateTime";
import { showAlert } from "../../../actions/alertActions";
import {setChosenChatDetails, setChosenGroupChatDetails} from "../../../actions/chatActions";
import Chatbot from "../../../components/chatbot";

const Dashboard = () => {

    const { auth: { userDetails: { pendingGroupChats, events, groupChats:groupChat, status,_id:userId } }, friends: { groupChatList }} = useAppSelector(state => state)
    const dispatch = useDispatch()
    const navigate = useNavigate()

    const [groupChats, set_groupChats] = useState<any>([])
    const [sessions, set_sessions] = useState<any>([])
    const [pendingSessions, set_pendingSessions] = useState<any>([])
    const [acceptedSeminars, set_acceptedSeminars] = useState<any>([])
    const [editModalShow, set_editModalShow] = useState<boolean>(false)
    const [selectedEvent, set_selectedEvent] = useState<any>(null)
    const [base64Images, setBase64Images] = useState<Map<string, string>>(new Map());
    const fetchImagesRef = useRef(false); // Ref to track image fetch calls

    const cancelSeminarAppointment = async (data: any) => {
        SetLoadingStatus(true)
        const response = await doCancelPendingSeminar(data._id)
        if (response) {
            dispatch(updateMe())
            dispatch(showAlert('Seminar Appointment Cancelled and your money refunded'))
        }
        SetLoadingStatus(false)
    }

    const cancelAppointment = async (groupChatId: any) => {
        SetLoadingStatus(true)
        console.log("Canceling appointment for ID:", groupChatId);
        const response = await cancelIndividualAppointment(groupChatId)
        if (response) {
            dispatch(updateMe())
            dispatch(showAlert('Appointment Cancelled and your money refunded'))
        }
        SetLoadingStatus(false)
    }

    const cancelEvent = async (event: any) => {
        SetLoadingStatus(true)
        const response = await doCancelEvent(event._id)
        console.log(response)
        if (response) {
            dispatch(updateMe())
            dispatch(showAlert('Event Appointment Cancelled and your money refunded'))
        }
        SetLoadingStatus(false)
    }

    const editEvent = async (event: any) => {
        SetLoadingStatus(true)
        set_selectedEvent(event)
        set_editModalShow(true)
        SetLoadingStatus(false)
    }

    const acceptInvitation = async (event: any) => {
        navigate(`${process.env.REACT_APP_AUTH_URL}customerdashboard/search?_id=${event.expert._id}&_duration=${event.duration}&_start=${event.start ? new Date(event.start).getTime() : ''}&_end=${event.end ? new Date(event.end).getTime() : ''}&_eventId=${event._id}&_price=${event.price}`)
    }

    const updateEventStartEndTime = async (start: any, end: any, price: any) => {
        SetLoadingStatus(true)
        const response = await doUpdateEvent(selectedEvent._id, { start: start, end: end, status: 'pending' })
        SetLoadingStatus(false)
        if (response) {
            set_selectedEvent({
                ...selectedEvent,
                start: new Date(start),
                end: new Date(end)
            })
            let temp = sessions
            let index = sessions.findIndex((x: any) => x._id === selectedEvent._id)
            if (index > -1) {
                temp[index].start = new Date(start)
                temp[index].end = new Date(end)
                temp[index].status = 'pending'
                set_sessions([...temp])
            }
            set_editModalShow(false)
        }
    }

    const navigateExpert = (item: any) => {
        console.log("navigate events", item); // Use item here instead of event
        navigate(`${process.env.REACT_APP_AUTH_URL}customerdashboard/chat`);
        // Assuming item contains customer details, you can use item directly
        dispatch(setChosenChatDetails({ userId: item._id, username: item.username, image: item.image }));
    };

    const navigateSeminar = (item: any) => {
        const selectedGroupChat:any = groupChatList.find((x: any) => x.groupId === item._id)
        console.log("navigate events", item);
        navigate(`${process.env.REACT_APP_AUTH_URL}customerdashboard/chat`);
        dispatch(setChosenGroupChatDetails( selectedGroupChat ));
    };

    // Batch state updates for sessions and groupChats
    useEffect(() => {
        const now = new Date().getTime();
        console.log("Pending Group Chats:", pendingGroupChats);

        const updatedSessions = groupChat.filter((item: any) => new Date(item.end).getTime() >= now && item.type === 'individual' && item.status === 'active');
        // const pendingSessions = pendingGroupChats.filter((item: any) => new Date(item.groupChatId.end).getTime() >= now && item.groupChatId.type === 'individual');
        const pendingSessions = groupChat.filter((item: any) => new Date(item.end).getTime() >= now && item.type === 'individual' && item.status === 'pending');
        // pendingSessions.push(...otherpendingSessions);
        const updatedGroupChats = pendingGroupChats.filter((item: any) => new Date(item.groupChatId.end).getTime() >= now && item.groupChatId.type === 'seminar');
        const updatedSeminars = groupChat.filter((item: any) => new Date(item.end).getTime() >= now && item.type === 'seminar');
    
        set_sessions(updatedSessions);
        set_groupChats(updatedGroupChats);
        set_acceptedSeminars(updatedSeminars);
        set_pendingSessions(pendingSessions);

        // Trigger image fetch only once
        if (!fetchImagesRef.current) {
            fetchImagesRef.current = true;
            const allExperts = [...updatedSessions, ...groupChats, ...updatedSeminars];
            fetchImages(allExperts);
        }
    }, [events, pendingGroupChats, groupChat]);

    const fetchImages = async (sessionList: any[]) => {
        const uniqueExperts = new Map<string, string>();
        sessionList.forEach((item) => {
            if (item.expert && item.expert._id && item.expert.image) {
                uniqueExperts.set(item.expert._id, item.expert.image);
            }
            else if (item.customerId && item.customerId._id && item.customerId.image) {
                uniqueExperts.set(item.customerId._id, item.customerId.image);
            }

            else if (item.admin && item.admin._id && item.admin.image) {
                uniqueExperts.set(item.admin._id, item.admin.image);
            }
        });

        const imagePromises = Array.from(uniqueExperts.entries()).map(
            async ([expertId, imageUrl]) => {
                try {
                    const base64 = await profileImageFetch(imageUrl, "small");
                    return { id: expertId, base64 };
                } catch (error) {
                    console.error(`Error fetching image for expert ${expertId}:`, error);
                    return null;
                }
            }
        );

        const images = await Promise.all(imagePromises);
        const newImageMap = new Map(base64Images);

        images.forEach((image) => {
            if (image) newImageMap.set(image.id, image.base64 as string);
        });

        setBase64Images(newImageMap);
    };

    // Dispatch `updateMe` only once when the component mounts
    useEffect(() => {
        dispatch(updateMe());
        }, [dispatch]);

    return (
        <div className="w-full h-full mx-auto p-6 text-white overflow-y-auto relative">
            <div className="text-center text-2xl mb-6">Booked Seminar Sessions</div>
            {
                acceptedSeminars.length ?
                    <div className="flex flex-wrap justify-center gap-6">
                        {
                            acceptedSeminars.map((item: any, index: number) => (
                                // <div key={index} className="w-fit p-4 bg-darkgrey">
                                    <div key={index} className="w-fit p-4 bg-darkgrey rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-lg overflow-hidden">
                                    <div className="flex space-x-3 items-center">
                                        <Avatar
                                            username={item.admin.username}
                                            // image={item.customerId.image}
                                            image={base64Images.get(item.admin._id)}
                                        />
                                        <div>
                                            <div className="text-lg">{item.admin.username}</div>
                                            <div className="text-sm">{item.admin.email}</div>
                                        </div>
                                    </div>
                                    <hr className="my-2"/>
                                    <div><span className="font-bold">Title  : </span> {item.name}</div>
                                    <div><span className="font-bold">Description  : </span> {item.description}</div>
                                    <div><span
                                        className="font-bold">Starts at : </span> {formatDateYYYY_MM_DD_h_m(item.start)}
                                    </div>
                                    <div><span className="font-bold">Duration  : </span> {item.duration} min
                                    </div>
                                    <div><span className="font-bold">Price  : </span> ${item.price}</div>
                                    <hr className="my-2"/>
                                    <button
                                        className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                        onClick={() => navigateSeminar(item)}
                                    >
                                        Go To Seminar
                                    </button>
                                </div>
                            ))
                        }
                    </div> :
                    <div className="text-center text-lightgrey my-10">No Booked Seminar sessions</div>
            }


            <div className="text-center text-2xl my-6">Pending Seminar Sessions</div>
            {
                groupChats.length ?
                    <div className="flex flex-wrap justify-center gap-6">
                        {
                            groupChats.map((item: any, index: number) => (
                                // <div key={index} className="w-fit p-4 bg-darkgrey">
                                <div key={index} className="w-fit p-4 bg-darkgrey rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-lg overflow-hidden">
                                    <div className="flex space-x-3 items-center">
                                        <Avatar
                                            username={item.groupChatId.admin.username}
                                            //image={item.groupChatId.admin.image}
                                            image={base64Images.get(item.groupChatId.admin._id)}
                                        />
                                        <div>
                                            <div className="text-lg">{item.groupChatId.admin.username}</div>
                                            <div className="text-sm">{item.groupChatId.admin.email}</div>
                                        </div>
                                    </div>
                                    <hr className="my-2"/>
                                    <div><span className="font-bold">Title  : </span> {item.groupChatId.name}</div>
                                    <div><span
                                        className="font-bold">Description  : </span> {item.groupChatId.description}
                                    </div>
                                    <div><span
                                        className="font-bold">Starts at : </span> {formatDateYYYY_MM_DD_h_m(item.groupChatId.start)}
                                    </div>
                                    <div><span className="font-bold">Duration  : </span> {item.groupChatId.duration} min
                                    </div>
                                    <div><span className="font-bold">Price  : </span> ${item.groupChatId.price}</div>
                                    <hr className="my-3"/>
                                    <button
                                        className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                        onClick={() => cancelSeminarAppointment(item)}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ))
                        }
                    </div> :
                    <div className="text-center text-lightgrey my-10">No pending seminar sessions</div>
            }
            <div className="text-center text-2xl mb-6">Booked Individual Sessions</div>
            {
                sessions.length ?
                    <div className="flex flex-wrap justify-center gap-6">
                        {
                            sessions.map((item: any, index: number) => (
                                // <div key={index} className="w-fit p-4 bg-darkgrey">
                                    <div key={index} className="w-fit p-4 bg-darkgrey rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-lg overflow-hidden">
                                    <div className="flex space-x-3 items-center">
                                        <Avatar
                                            username={item.admin.username}
                                            // image={item.customerId.image}
                                            image={base64Images.get(item.admin._id)}
                                        />
                                        <div>
                                            <div className="text-lg">{item.name}</div>
                                        </div>
                                    </div>
                                    <hr className="my-2"/>
                                    {/* <div><span className="font-bold">Title  : </span> {item.name}</div> */}
                                    {/* <div><span className="font-bold">Description  : </span> {item.description}</div> */}
                                    <div><span
                                        className="font-bold">Starts at : </span> {formatDateYYYY_MM_DD_h_m(item.start)}
                                    </div>
                                    <div><span className="font-bold">Duration  : </span> {item.duration} min
                                    </div>
                                    <div><span className="font-bold">Price  : </span> ${item.price}</div>
                                    <hr className="my-2"/>
                                    <button
                                        className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                        onClick={() => navigateSeminar(item)}
                                    >
                                        Go To Session
                                    </button>
                                </div>
                            ))
                        }
                    </div> :
                    <div className="text-center text-lightgrey my-10">No Booked Individual sessions</div>
            }


            <div className="text-center text-2xl my-6">Pending Individual Sessions</div>
            {
                pendingSessions.length ?
                    <div className="flex flex-wrap justify-center gap-6">
                        {
                            pendingSessions.map((item: any, index: number) => (
                                // <div key={index} className="w-fit p-4 bg-darkgrey">
                                <div key={index} className="w-fit p-4 bg-darkgrey rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-lg overflow-hidden">
                                    <div className="flex space-x-3 items-center">
                                        <Avatar
                                            username={item.admin.username}
                                            //image={item.groupChatId.admin.image}
                                            image={base64Images.get(item.admin._id)}
                                        />
                                        <div>
                                            <div className="text-lg">{item.admin.username}</div>
                                            <div className="text-sm">{item.admin.email}</div>
                                        </div>
                                    </div>
                                    <hr className="my-2"/>
                                    <div><span className="font-bold">Title  : </span> {item.name}</div>
                                    <div><span
                                        className="font-bold">Description  : </span> {item.description}
                                    </div>
                                    <div><span
                                        className="font-bold">Starts at : </span> {formatDateYYYY_MM_DD_h_m(item.start)}
                                    </div>
                                    <div><span className="font-bold">Duration  : </span> {item.duration} min
                                    </div>
                                    <div><span className="font-bold">Price  : </span> ${item.price}</div>
                                    <hr className="my-3"/>
                                    <button
                                        className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                        onClick={() => cancelAppointment(item._id)}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ))
                        }
                    </div> :
                    <div className="text-center text-lightgrey my-10">No pending Individual sessions</div>
            }
            {
                editModalShow ?
                    <div className={`absolute top-0 left-0 w-full h-full bg-white bg-opacity-10 backdrop-blur-sm z-10 p-8`}>
                        <div
                            className="absolute top-0 left-0 w-full h-full cursor-pointer"
                            onClick={() => {
                                set_editModalShow(false)
                            }}
                        />
                        <div className="relative w-full h-full max-w-[846px] mx-auto p-6 bg-black rounded-lg text-white">
                            <button
                                className="absolute right-2 top-2 rounded-md hover:bg-grey"
                                onClick={() => {
                                    set_editModalShow(false)
                                }}
                            >
                                <CloseIcon />
                            </button>
                            <div className="text-center text-white text-2xl mb-6">Update Event Time</div>
                            <div className="w-full h-[calc(100%-40px)]">
                                <SelectDateTime
                                    hideEvents={true}
                                    disableDurationSelection={true}
                                    setStartEndTime={updateEventStartEndTime}
                                    selectedUser={selectedEvent?.expert}
                                />
                            </div>
                        </div>
                    </div> :
                    null
            }
            <div
                style={{
                    position: "fixed",
                    bottom: "20px",
                    right: "20px",
                    zIndex: 1000,
                }}
            >
                <Chatbot/>
            </div>
        </div>
    );
};

export default Dashboard;