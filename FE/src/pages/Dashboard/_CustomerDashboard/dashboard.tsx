import React, {useEffect, useRef, useState} from "react";
import { useAppSelector } from "../../../store";
import Avatar from "../../../components/Avatar";
import { formatDateYYYY_MM_DD_h_m } from "../../../actions/common";
import {doCancelEvent, doCancelPendingSeminar, doUpdateEvent, profileImageFetch} from "../../../api/api";
import { updateMe } from "../../../actions/authActions";
import { useDispatch } from "react-redux";
import { SetLoadingStatus } from "../../../actions/appActions";
import { useNavigate } from "react-router-dom";
import CloseIcon from '@mui/icons-material/Close';
import SelectDateTime from "../selectDateTime";
import { showAlert } from "../../../actions/alertActions";
import {setChosenChatDetails} from "../../../actions/chatActions";
import Chatbot from "../../../components/chatbot";

const Dashboard = () => {

    const { auth: { userDetails: { pendingGroupChats, events, status,_id:userId } } } = useAppSelector(state => state)
    const dispatch = useDispatch()
    const navigate = useNavigate()

    const [groupChats, set_groupChats] = useState<any>([])
    const [sessions, set_sessions] = useState<any>([])
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
        navigate(`${process.env.REACT_APP_AUTH_URL}customerdashboard/search?_id=${event.expert._id}&_duration=${event.duration}&_start=${event.start ? new Date(event.start).getTime() : ''}&_end=${event.end ? new Date(event.end).getTime() : ''}&_eventId=${event._id}`)
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

    // Batch state updates for sessions and groupChats
    useEffect(() => {
        const now = new Date().getTime();

        const updatedSessions = events.filter((item: any) => new Date(item.end).getTime() >= now);
        const updatedGroupChats = pendingGroupChats.filter((item: any) => new Date(item.groupChatId.end).getTime() >= now);

        set_sessions(updatedSessions);
        set_groupChats(updatedGroupChats);

        // Trigger image fetch only once
        if (!fetchImagesRef.current) {
            fetchImagesRef.current = true;
            fetchImages(updatedSessions);
        }
    }, [events, pendingGroupChats]);

    const fetchImages = async (sessionList: any[]) => {
        const uniqueExperts = new Map<string, string>();
        sessionList.forEach((item) => {
            if (item.expert && item.expert._id && item.expert.image) {
                uniqueExperts.set(item.expert._id, item.expert.image);
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
            if (image) newImageMap.set(image.id, image.base64);
        });

        setBase64Images(newImageMap);
    };

    // Dispatch `updateMe` only once when the component mounts
    useEffect(() => {
        dispatch(updateMe());
        }, [dispatch]);

    return (
        <div className="w-full h-full mx-auto p-6 text-white overflow-y-auto relative">
            <div className="text-center text-2xl mb-6">Seminar Appointments </div>
            {
                groupChats.length ?
                    <div className="flex flex-wrap justify-center gap-6">
                        {
                            groupChats.map((item: any, index: number) => (
                                <div key={index} className="w-fit p-4 bg-darkgrey">
                                    <div className="flex space-x-3 items-center">
                                        <Avatar
                                            username={item.groupChatId.admin.username}
                                            image={item.groupChatId.admin.image}
                                        />
                                        <div>
                                            <div className="text-lg">{item.groupChatId.admin.username}</div>
                                            <div className="text-sm">{item.groupChatId.admin.email}</div>
                                        </div>
                                    </div>
                                    <hr className="my-2" />
                                    <div><span className="font-bold">Title  : </span> {item.groupChatId.name}</div>
                                    <div><span className="font-bold">Starts at : </span> {formatDateYYYY_MM_DD_h_m(item.groupChatId.start)}</div>
                                    <div><span className="font-bold">Duration  : </span> {item.groupChatId.duration} min</div>
                                    <div><span className="font-bold">Price  : </span> ${item.groupChatId.price}</div>
                                    <hr className="my-3" />
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
                    <div className="text-center text-lightgrey my-10">No appointments found</div>
            }


            <div className="text-center text-2xl mb-6">Pending Seminar Appointments </div>
            {
                groupChats.length ?
                    <div className="flex flex-wrap justify-center gap-6">
                        {
                            groupChats.map((item: any, index: number) => (
                                <div key={index} className="w-fit p-4 bg-darkgrey">
                                    <div className="flex space-x-3 items-center">
                                        <Avatar
                                            username={item.groupChatId.admin.username}
                                            image={item.groupChatId.admin.image}
                                        />
                                        <div>
                                            <div className="text-lg">{item.groupChatId.admin.username}</div>
                                            <div className="text-sm">{item.groupChatId.admin.email}</div>
                                        </div>
                                    </div>
                                    <hr className="my-2" />
                                    <div><span className="font-bold">Title  : </span> {item.groupChatId.name}</div>
                                    <div><span className="font-bold">Starts at : </span> {formatDateYYYY_MM_DD_h_m(item.groupChatId.start)}</div>
                                    <div><span className="font-bold">Duration  : </span> {item.groupChatId.duration} min</div>
                                    <div><span className="font-bold">Price  : </span> ${item.groupChatId.price}</div>
                                    <hr className="my-3" />
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
                    <div className="text-center text-lightgrey my-10">No appointments found</div>
            }
            <div className="text-center text-2xl my-6">Session Appointments </div>
            {
                sessions.length ?
                    <div className="flex flex-wrap justify-center gap-6">
                        {
                            sessions.map((item: any, index: number) => (
                                item.status === 'accepted' ?
                                    <div key={index} className="w-fit p-4 bg-darkgrey">
                                        <div className="flex space-x-3 items-center">
                                            <Avatar
                                                username={item.expert.username}
                                                image={base64Images.get(item.expert._id)}
                                            />
                                            <div>
                                                <div className="text-lg">{item.expert.username}</div>
                                                <div className="text-sm">{item.expert.email}</div>
                                            </div>
                                        </div>
                                        <hr className="my-2" />
                                        <div><span className="font-bold">Title  : </span> {item.title}</div>
                                        <div><span className="font-bold">Starts at : </span> {formatDateYYYY_MM_DD_h_m(item.start)}</div>
                                        <div><span className="font-bold">Duration  : </span> {item.duration} min</div>
                                        <div><span className="font-bold">Price  : </span> ${item.price}</div>
                                        <hr className="my-3" />
                                        <div className="w-full flex justify-center space-x-4">
                                            <button
                                                className="py-1 w-full border border-lightgrey rounded-lg flex items-center justify-center disabled:opacity-50"
                                                onClick={() => cancelEvent(item)}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                                disabled={status === 'review'}
                                                onClick={() => editEvent(item)}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                                onClick={() => navigateExpert(item.expert)}
                                            >
                                                Chat
                                            </button>
                                        </div>
                                    </div> :
                                    null
                            ))
                        }
                    </div> :
                    <div className="text-center text-lightgrey my-10">No appointments found</div>
            }
            <div className="text-center text-2xl my-6">Pending Invitations</div>
            {
                sessions.length ?
                    <div className="flex flex-wrap justify-center gap-6">
                        {
                            sessions.map((item: any, index: number) => (
                                item.status === 'pending' ? <div key={index} className="w-fit p-4 bg-darkgrey">
                                        <div className="flex space-x-3 items-center">
                                            <Avatar
                                                username={item.expert.username}
                                                image={base64Images.get(item.expert._id)}
                                            />
                                            <div>
                                                <div className="text-lg">{item.expert.username}</div>
                                                <div className="text-sm">{item.expert.email}</div>
                                            </div>
                                        </div>
                                        <hr className="my-2"/>
                                        <div><span className="font-bold">Title  : </span> {item.title}</div>
                                        <div><span
                                            className="font-bold">Starts at : </span> {item.start ? formatDateYYYY_MM_DD_h_m(item.start) : 'undefined'}
                                        </div>
                                        <div><span
                                            className="font-bold">Duration  : </span> {item.start ? `${item.duration} min` : 'undefined'}
                                        </div>
                                        <div><span className="font-bold">Price  : </span> ${item.price}</div>
                                        <hr className="my-3"/>
                                        {item.createdBy === userId ?
                                        <button
                                                className="py-1 w-full border border-lightgrey rounded-lg flex items-center justify-center disabled:opacity-50"
                                                onClick={() => cancelEvent(item)}
                                            >
                                                Cancel
                                            </button>:
                                            <button
                                            className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                            onClick={() => acceptInvitation(item)}
                                        >
                                            Accept
                                        </button>}
                                    </div> :
                                   null
                            ))
                        }
                    </div> :
                    <div className="text-center text-lightgrey my-10">No appointments found</div>
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