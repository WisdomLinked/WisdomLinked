import CloseIcon from '@mui/icons-material/Close';

import { showAlert } from "../actions/alertActions";
import { SetLoadingStatus } from "../actions/appActions";
import { updateMe } from "../actions/authActions";
import { setChosenChatDetails, setChosenGroupChatDetails } from "../actions/chatActions";
import { formatDateYYYY_MM_DD_h_m } from "../actions/common";
import { doCancelPendingSeminar, doCancelEvent, doUpdateEvent, doAcceptEvent, addMemberToGroup, doCancelInvitation, profileImageFetch } from "../api/api";
import SelectDateTime from "../pages/Dashboard/selectDateTime";
import Chatbot from "./chatbot";
import CollapsibleSection from "./collapsibleSection";
import SessionCardComponent from "./sessionCardComponent";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Session } from "../api/types";
import Avatar from "./Avatar";
import { event } from 'jquery';
import { Persona } from '../utils/constants';


interface DashboardProps {
    // Define the props for the Dashboard component here
    userId: string;
    userStatus: string;
    userRole: Persona;


    pendingGroupChats: any[];
    groupChats: any[];
    events: any[];
    groupChatList: any[];
}

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
    const newImageMap = new Map();

    images.forEach((image) => {
        if (image) newImageMap.set(image.id, image.base64 as string);
    });

    return newImageMap
};



const Dashboard = ({ userId, userStatus, userRole, pendingGroupChats, groupChats, events, groupChatList }: DashboardProps) => {


    const dispatch = useDispatch()
    const navigate = useNavigate()

    const [editModalShow, set_editModalShow] = useState<boolean>(false)
    const [selectedEvent, set_selectedEvent] = useState<any>(null)
    const [base64Images, setBase64Images] = useState<Map<string, string>>(new Map());


    const now = new Date().getTime();

    // Remove sessions (events) in the past
    const upcomingSessions = events.filter((item: any) => new Date(item.end).getTime() >= now);

    // Remove group chats (seminars) that were pending but expired
    const upcomingPendingSeminars = pendingGroupChats.filter((item: any) => new Date(item.groupChatId.end).getTime() >= now);

    // Remove accepted group chats (seminars) in the past
    const upcomingSeminars = groupChats.filter((item: any) => new Date(item.end).getTime() >= now);

    const acceptedIndividualSessions = upcomingSessions.filter((item: any) => item.status === 'accepted');
    const pendingIndividualSessions = upcomingSessions.filter((item: any) => item.status === 'pending');
    
    useEffect(() => {
        fetchImages([...upcomingSessions, ...upcomingPendingSeminars, ...upcomingSeminars]).then((imageMap) => {
            setBase64Images(imageMap)
        });    
    }, [])


    // Only if user role is customer
    const cancelSeminarAppointment = async (data: any) => {
        if (userRole !== 'customer') {
            dispatch(showAlert('Only customer can cancel the seminar appointment'));
            return;
        }
        SetLoadingStatus(true)
        const response = await doCancelPendingSeminar(data._id)
        if (response) {
            dispatch(updateMe())
            dispatch(showAlert('Seminar Appointment Cancelled and your money refunded'))
        }
        SetLoadingStatus(false)
    }

    // If the user is a customer, it cancels the event created by the customer
    // If the user is an expert, it cancels the invitation sent by the expert
    const cancelEvent = async (event: any) => {
        if (userRole === 'customer') {
            cancelEventByCustomer(event)
        } else {
            cancelInvitation(event)
        }
    }

    const cancelEventByCustomer = async (event: any) => {
        SetLoadingStatus(true)
        const response = await doCancelEvent(event._id)
        console.log(response)
        if (response) {
            dispatch(updateMe())
            dispatch(showAlert('Event Appointment Cancelled and your money refunded'))
        }
        SetLoadingStatus(false)
    }

    const cancelInvitation = async (event: any) => {
        SetLoadingStatus(true)
        const response = await doCancelInvitation(event._id)
        if (response) {
            dispatch(updateMe())
        }
        SetLoadingStatus(false)
    }

    // Only if user role is customer
    const editEvent = async (event: any) => {
        if (userRole !== 'customer') {
            dispatch(showAlert('Only customer can edit the event'));
            return;
        }
        SetLoadingStatus(true)
        set_selectedEvent(event)
        set_editModalShow(true)
        SetLoadingStatus(false)
    }

    // Part of the edit modal
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
            // let temp: any[] = upcomingSessions
            // let index = upcomingSessions.findIndex((x: any) => x._id === selectedEvent._id)
            // if (index > -1) {
            //     temp[index].start = new Date(start)
            //     temp[index].end = new Date(end)
            //     temp[index].status = 'pending'
            //     set_sessions([...temp])
            // }
            set_editModalShow(false)
        }
    }

    // Accepts an event based on the user role
    // If the user is a customer, it accepts the invitation sent by the expert by navigating to search and payment page
    // If the user is an expert, it accepts the event (already paid) sent by the customer
    const acceptEvent = async (event: any) => {
        if (userRole === 'customer') {
            acceptInvitationbyCustomer(event)
        } else {
            acceptEventByExpert(event)
        }
    }

    // Accepts the invitation sent by the expert by navigating to search and payment page
    const acceptInvitationbyCustomer = async (event: any) => {
        navigate(`${process.env.REACT_APP_AUTH_URL}customerdashboard/search?_id=${event.expert._id}&_duration=${event.duration}&_start=${event.start ? new Date(event.start).getTime() : ''}&_end=${event.end ? new Date(event.end).getTime() : ''}&_eventId=${event._id}&_price=${event.price}`)
    }

    // Accepts the event (already paid) sent by the customer
    const acceptEventByExpert = async (event: any) => {
        SetLoadingStatus(true)
        const response = await doAcceptEvent(event._id)
        if (response) {
            dispatch(updateMe())
        }
        SetLoadingStatus(false)
    }

    const navigateEvent = (item: any) => {
        console.log("navigate events", item); // Use item here instead of event
        userRole === 'customer' ?
            navigate(`${process.env.REACT_APP_AUTH_URL}customerdashboard/chat`)
            : navigate(`${process.env.REACT_APP_AUTH_URL}expertdashboard/chat`)
        // Assuming item contains customer details, you can use item directly
        dispatch(setChosenChatDetails({ userId: item._id, username: item.username, image: item.image }));
    };

    const navigateSeminar = (item: any) => {
        const selectedGroupChat: any = groupChatList.find((x: any) => x.groupId === item._id)
        console.log("navigate events", item);
        userRole === 'customer' ?
            navigate(`${process.env.REACT_APP_AUTH_URL}customerdashboard/chat`)
            : navigate(`${process.env.REACT_APP_AUTH_URL}expertdashboard/chat`)
        dispatch(setChosenGroupChatDetails(selectedGroupChat));
    };

    const acceptSeminarAppointment = async (data: any) => {
        const response = await addMemberToGroup({
            _id: data._id,
            friendId: data.customerId._id,
            groupChatId: data.groupChatId._id
        })
        if (response) {
            dispatch(updateMe())
        }
        SetLoadingStatus(false)
    }

    const acceptedSeminarCards = upcomingSeminars.length ?
        <div className="flex flex-wrap justify-center gap-6">
            {
                upcomingSeminars.map((item: any, index: number) => (
                    <div key={index} className="w-fit p-4 bg-darkgrey rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-lg overflow-hidden">
                        <div className="flex space-x-3 items-center">
                            <Avatar
                                username={item.admin.username}
                                // image={item.customerId.image}
                                image={base64Images.get(item.admin._id)}
                            />
                            <div>
                                <div className="text-lg text-white">{item.admin.username}</div>
                                <div className="text-sm">{item.admin.email}</div>
                            </div>
                        </div>
                        <hr className="my-2" />
                        <div><span className="font-bold text-white">Title  : </span> <span className="text-white">{item.name}</span></div>
                        <div><span className="font-bold text-white">Description  : </span> <span className="text-white">{item.description}</span></div>
                        <div><span
                            className="font-bold text-white">Starts at : </span> <span className="text-white">{formatDateYYYY_MM_DD_h_m(item.start)}</span>
                        </div>
                        <div><span className="font-bold text-white">Duration  : </span> <span className="text-white">{item.duration} min</span>
                        </div>
                        <div><span className="font-bold text-white">Price  : </span> <span className="text-white">${item.price}</span></div>
                        <hr className="my-2" />
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
        <div className="text-center text-grey my-10">No booked seminar sessions</div>

    const pendingSeminarCards = upcomingPendingSeminars.length ?
        <div className="flex flex-wrap justify-center gap-6">
            {
                upcomingPendingSeminars.map((item: any, index: number) => (
                    // <div key={index} className="w-fit p-4 bg-darkgrey">
                    <div key={index} className="w-fit p-4 bg-darkgrey rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-lg overflow-hidden">
                        <div className="flex space-x-3 items-center">
                            <Avatar
                                username={item.groupChatId.admin.username}
                                //image={item.groupChatId.admin.image}
                                image={base64Images.get(item.groupChatId.admin._id)}
                            />
                            <div>
                                <div className="text-lg text-white">{item.groupChatId.admin.username}</div>
                                <div className="text-sm text-white">{item.groupChatId.admin.email}</div>
                            </div>
                        </div>
                        <hr className="my-2" />
                        <div><span className="font-bold text-white">Title  : </span> <span className="text-white">{item.groupChatId.name}</span></div>
                        <div><span
                            className="font-bold text-white">Description  : </span> <span className="text-white">{item.groupChatId.description}</span>
                        </div>
                        <div><span
                            className="font-bold text-white">Starts at : </span> <span className="text-white">{formatDateYYYY_MM_DD_h_m(item.groupChatId.start)}</span>
                        </div>
                        <div><span className="font-bold text-white">Duration  : </span> <span className="text-white">{item.groupChatId.duration} min</span>
                        </div>
                        <div><span className="font-bold text-white">Price  : </span> <span className="text-white">${item.groupChatId.price}</span></div>
                        <hr className="my-3" />
                        {userRole === 'customer' ?
                            <button
                                className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                onClick={() => cancelSeminarAppointment(item)}
                            >
                                Cancel
                            </button>
                            :
                            <button
                                className="py-1 w-full bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                disabled={userStatus === 'review'}
                                onClick={() => acceptSeminarAppointment(item)}
                            >
                                Accept
                            </button>
                        }
                    </div>
                ))
            }
        </div> :
        <div className="text-center text-grey my-10">No pending seminar sessions</div>

    const bookedIndividualCards = acceptedIndividualSessions.length ?
        <div className="flex flex-wrap justify-center gap-6">
            {
                acceptedIndividualSessions.map((item: any, index: number) => (
                    <SessionCardComponent
                        key={index}
                        session={item}
                        image={base64Images.get(item.expert._id)}
                        onCancel={cancelEvent}
                        onEdit={editEvent}
                        onAccept={acceptEvent}
                        onNavigate={navigateEvent}
                        userId={userId}
                        userStatus={userStatus}
                        userRole={userRole}
                    />
                ))
            }
        </div> :
        <div className="text-center text-grey my-10">No booked individual sessions</div>

    const pendingIndividualCards = pendingIndividualSessions.length ?
        <div className="flex flex-wrap justify-center gap-6">
            {
                pendingIndividualSessions.map((item: any, index: number) => (
                    <SessionCardComponent
                        key={index}
                        session={item}
                        image={base64Images.get(item.expert._id)}
                        onCancel={cancelEvent}
                        onEdit={editEvent}
                        onAccept={acceptEvent}
                        onNavigate={navigateEvent}
                        userId={userId}
                        userStatus={userStatus}
                        userRole={userRole}
                    />
                ))
            }
        </div> :
        <div className="text-center text-grey my-10">No pending individual session</div>

    return (
        <div className="w-1/2 h-full mx-auto p-6 text-white overflow-y-auto relative flex gap-6 flex-col">
            <CollapsibleSection defaultExpanded title={`Booked Seminar Sessions (${upcomingSeminars.length})`} content={acceptedSeminarCards}></CollapsibleSection>

            <CollapsibleSection title={`Pending Seminar Sessions (${upcomingPendingSeminars.length})`} content={pendingSeminarCards}
            ></CollapsibleSection>

            <CollapsibleSection title={`Booked Individual Sessions (${acceptedIndividualSessions.length})`} content={bookedIndividualCards}
            ></CollapsibleSection>

            <CollapsibleSection title={`Pending Individual Sessions (${pendingIndividualSessions.length})`} content={pendingIndividualCards}
            ></CollapsibleSection>
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
                <Chatbot />
            </div>
        </div>
    )
}

export default Dashboard