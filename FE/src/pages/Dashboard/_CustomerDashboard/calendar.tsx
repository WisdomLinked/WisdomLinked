import React, { useEffect, useState } from "react";
import { Calendar } from "react-big-calendar";
import CloseIcon from '@mui/icons-material/Close';
import EventDetail from "./eventDetail";
import SelectDateTime from "../selectDateTime";
import { doCancelEvent, doCancelPendingSeminar, doFilterExperts, doGetMyEvents, doUpdateEvent, doLeftSeminar } from "../../../api/api";
import { useDispatch } from "react-redux";
import SeminarDetails from "../seminarDetails";
import { SetLoadingStatus } from "../../../actions/appActions";
import { localizer } from "../../../actions/common";
import { useNavigate } from "react-router-dom";
import { updateMe } from "../../../actions/authActions";
import { showAlert } from "../../../actions/alertActions";
import { useAppSelector } from "../../../store";
import {setChosenChatDetails,setChosenGroupChatDetails} from "../../../actions/chatActions";


const CustomerCalendar = () => {

    const dispatch = useDispatch()
    const navigate = useNavigate()    
    const { auth: { userDetails },friends: { groupChatList } } = useAppSelector(state => state)

    const eventStyleGetter = (event: any, start: any, end: any) => {
        const now = new Date()
        const style = end < now ? {
            backgroundColor: event.type === 'event' ? '#000000' : '#DCE4E8',
            borderRadius: '0px',
            opacity: 0.7,
            color: event.type === 'event' ? (event.paidBy === 'none' ? '#03a9f4' : event.status === 'accepted' ? '#31B099' : event.status === 'pending' ? '#a87723' : 'red') : 'black',
            // display: 'block',
            // 'pointer-events': 'none'
        } : {
            backgroundColor: event.type === 'event' ? (event.paidBy === 'none' ? '#03a9f4' : event.status === 'accepted' ? '#31B099' : event.status === 'pending' ? '#a87723' : 'red') : 'white',
            borderRadius: '0px',
            opacity: event.type === 'pending seminar' ? 0.5 : 1,
            color: event.type === 'event' ? 'white' : 'black',
            border: '0px',
            // display: 'block',
        };
        return {
            style: style,
        };
    };
    const [events, set_events] = useState<Array<any>>([])
    const [selectedEvent, set_selectedEvent] = useState<any>(null)
    const [eventModalShow, set_eventModalShow] = useState<boolean>(false)
    const [editModalShow, set_editModalShow] = useState<boolean>(false)
    const [seminarModalShow, set_seminarModalShow] = useState<boolean>(false)
    const [selectedDay, set_selectedDay] = useState<Date | null>(null);
    const [selectedDayEvents, set_selectedDayEvents] = useState<Array<any>>([]);
    const [dayModalShow, set_dayModalShow] = useState<boolean>(false);

    const handleSelectEvent = async (event: any) => {
        console.log("Event Details",event);
        if (event.type === 'event') {
            SetLoadingStatus(true)
            const response = await doFilterExperts({ _id: event.expert._id });
            SetLoadingStatus(false)
            if (response) {
                set_selectedEvent({
                    ...event,
                    expert: response.result[0]
                })
                set_eventModalShow(true)
            }
        } else {
            set_selectedEvent(event)
            set_seminarModalShow(true)
        }
    }

    const updateEventStartEndTime = async (start: any, end: any, price: any) => {
        SetLoadingStatus(true)
        const response = await doUpdateEvent(selectedEvent.id, { start: start, end: end, status: 'pending' })
        SetLoadingStatus(false)
        if (response) {
            set_selectedEvent({
                ...selectedEvent,
                start: new Date(start),
                end: new Date(end)
            })
            let temp = events
            let index = events.findIndex(x => x.id === selectedEvent.id)
            if (index > -1) {
                temp[index].start = new Date(start)
                temp[index].end = new Date(end)
                temp[index].status = 'pending'
                set_events([...temp])
            }
            set_editModalShow(false)
            set_eventModalShow(true)
        }
    }

    // const acceptInvitation = async (event: any) => {
    //     navigate(`${import.meta.env.VITE_AUTH_URL}customerdashboard/search?_id=${selectedEvent.expert._id}&_duration=${selectedEvent.duration}&_start=${selectedEvent.start ? new Date(selectedEvent.start).getTime() : ''}&_end=${selectedEvent.end ? new Date(selectedEvent.end).getTime() : ''}`)
    // }

    const handleDayClick = (date: Date) => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        
        const filteredEvents = events.filter(
          (event) => event.start >= dayStart && event.start <= dayEnd
        );
        
        set_selectedDay(date);
        set_selectedDayEvents(filteredEvents);
        set_dayModalShow(true);
      };

    const acceptInvitation = async (event: any) => {
        navigate(`${import.meta.env.VITE_AUTH_URL}customerdashboard/search?_id=${selectedEvent.expert._id}&_duration=${selectedEvent.duration}&_start=${selectedEvent.start ? new Date(selectedEvent.start).getTime() : ''}&_end=${selectedEvent.end ? new Date(selectedEvent.end).getTime() : ''}&_price=${selectedEvent.price}`)
    }

    const getEvents = async () => {
        SetLoadingStatus(true)
        const response = await doGetMyEvents()
        SetLoadingStatus(false)
        if (response) {
            dispatch({
                type: 'updateUserDetails',
                payload: response.result
            })
            let temp = response.result.events.map((event: any) => {
                return {
                    ...event,
                    id: event._id,
                    start: new Date(event.start),
                    end: new Date(event.end),
                    type: 'event',
                }
            })
            response.result.groupChats.map((seminar: any) => {
                temp.push({
                    ...seminar,
                    id: seminar._id,
                    start: new Date(seminar.start),
                    end: new Date(seminar.end),
                    title: '(S)' + seminar.name,
                    type: 'seminar'
                })
            })
            response.result.pendingGroupChats.map((item: any) => {
                temp.push({
                    ...item.groupChatId,
                    id: item._id,
                    start: new Date(item.groupChatId.start),
                    end: new Date(item.groupChatId.end),
                    title: '(PS)' + item.groupChatId.name,
                    type: 'pending seminar'
                })
            })
            set_events([...temp])
        }
    }

    const cancelSeminarAppointment = async (data: any) => {
        SetLoadingStatus(true)
        const response = await doCancelPendingSeminar(data.id)
        if (response) {
            dispatch(updateMe())
            getEvents()
            dispatch(showAlert('Seminar Appointment Cancelled and your money refunded'))
        }
        set_seminarModalShow(false)
        set_selectedEvent(null)
        SetLoadingStatus(false)
    }

    const leaveSeminar = async (data: any) => {
        SetLoadingStatus(true)
        const response = await doLeftSeminar(data._id)
        if (response) {
            dispatch(updateMe())
            getEvents()
            dispatch(showAlert('You left a seminar and your money refunded'))
        }
        set_seminarModalShow(false)
        set_selectedEvent(null)
        SetLoadingStatus(false)
    }

    const navigateSeminar = (item: any) => {
            const selectedGroupChat:any = groupChatList.find((x: any) => x.groupId === item._id)
            console.log("navigate events", item);
            navigate(`${import.meta.env.VITE_AUTH_URL}customerdashboard/chat`);
            dispatch(setChosenGroupChatDetails( selectedGroupChat ));
    };

    const cancelEvent = async (event: any) => {
        SetLoadingStatus(true)
        const response = await doCancelEvent(event._id)
        console.log(response)
        if (response) {
            dispatch(updateMe())
            getEvents()
            dispatch(showAlert('Event Appointment Cancelled and your money refunded'))
        }
        set_eventModalShow(false)
        set_selectedEvent(null)
        SetLoadingStatus(false)
    }

    const setToChat = (item: any) => {
        console.log("navigate events", item); // Use item here instead of event
        navigate(`${import.meta.env.VITE_AUTH_URL}customerdashboard/chat`);
        // Assuming item contains customer details, you can use item directly
        dispatch(setChosenChatDetails({ userId: item._id, username: item.username, image: item.image }));
    };

    useEffect(() => {
        getEvents()
    }, [])

    return (
        <div className="w-full h-full p-6 relative">
            <Calendar
                className="customerCalendar !h-full min-h-[400px] pt-1 pb-6 text-white"
                views={["month", "week", "day", "agenda"]}
                selectable
                localizer={localizer}
                defaultDate={new Date()}
                defaultView="month"
                events={events || []}
                eventPropGetter={eventStyleGetter}
                onSelectEvent={handleSelectEvent}
                onSelectSlot={(slotInfo) => handleDayClick(slotInfo.start)}
            />
            {
                eventModalShow ?
                    <div className={`absolute top-0 left-0 w-full h-full bg-white bg-opacity-10 backdrop-blur-sm z-10 flex items-center justify-center p-8`}>
                        <div
                            className="absolute top-0 left-0 w-full h-full cursor-pointer"
                            onClick={() => {
                                set_selectedEvent(null)
                                set_eventModalShow(false)
                            }}
                        />
                        <div className="w-max bg-black rounded-lg text-white p-6 relative">
                            <div className="text-center text-white text-2xl mb-6">Event Details</div>
                            <button
                                className="absolute right-2 top-2 rounded-md hover:bg-grey"
                                onClick={() => {
                                    set_selectedEvent(null)
                                    set_eventModalShow(false)
                                }}
                            >
                                <CloseIcon />
                            </button>
                            {
                                selectedEvent?.paidBy === 'none' ?
                                    <div className="flex space-x-3 items-center text-blue text-xl mb-4">
                                        <div className="w-3 h-3 bg-blue block rounded-full"></div>
                                        <div>Invitation from expert</div>
                                    </div> :
                                    selectedEvent?.status === 'accepted' ?
                                        <div className="flex space-x-3 items-center text-green text-xl mb-4">
                                            <div className="w-3 h-3 bg-green block rounded-full"></div>
                                            <div>Accepted</div>
                                        </div> :
                                        selectedEvent?.status === 'pending' ?
                                            <div className="flex space-x-3 items-center text-brownyellow text-xl mb-4">
                                                <div className="w-3 h-3 bg-brownyellow block rounded-full"></div>
                                                <div>Pending</div>
                                            </div> :
                                            <div className="flex space-x-3 items-center text-[red] text-xl mb-4">
                                                <div className="w-3 h-3 bg-[red] block rounded-full"></div>
                                                <div>Declined</div>
                                            </div>
                            }
                            <EventDetail
                                image={selectedEvent?.expert?.image}
                                name={selectedEvent?.expert?.username}
                                title={selectedEvent?.title}
                                description={selectedEvent?.expert?.service}
                                start={selectedEvent?.start}
                                price={selectedEvent?.price}
                                duration={selectedEvent?.duration}
                                paidBy={selectedEvent?.paidBy}
                            />
                            <div className="w-full h-10 flex justify-center mt-6 space-x-4">
                                {
                                    selectedEvent.paidBy === 'none' ?
                                        <>
                                            <button
                                                className="w-[calc(50%-8px)] bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                                disabled={new Date(selectedEvent.end).getTime() <= new Date().getTime() || userDetails.status === 'review'}
                                                onClick={() => acceptInvitation(selectedEvent)}
                                            >
                                                Accept Invitation
                                            </button>
                                        </> :
                                        <>
                                            <button
                                                className="w-[calc(50%-8px)] rounded-lg border border-lightgrey flex items-center justify-center"
                                                onClick={() => {
                                                    cancelEvent(selectedEvent)
                                                }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                className="w-[calc(50%-8px)] rounded-lg border border-green bg-green flex items-center justify-center disabled:opacity-50"
                                                disabled={userDetails.status === 'review'}
                                                onClick={() => {
                                                    set_eventModalShow(false)
                                                    set_editModalShow(true)
                                                }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className="w-[calc(50%-8px)] rounded-lg border border-green bg-green flex items-center justify-center disabled:opacity-50"
                                                onClick={() => setToChat(selectedEvent.expert)}
                                            >
                                                Go To Chat
                                            </button>
                                        </>
                                }
                            </div>
                        </div>
                    </div> :
                    null
            }
            {
                editModalShow ?
                    <div
                        className={`absolute top-0 left-0 w-full h-full bg-white bg-opacity-10 backdrop-blur-sm z-10 p-8`}>
                        <div
                            className="absolute top-0 left-0 w-full h-full cursor-pointer"
                            onClick={() => {
                                set_editModalShow(false)
                                set_eventModalShow(true)
                            }}
                        />
                        <div className="relative w-full h-full max-w-[846px] mx-auto p-6 bg-black rounded-lg text-white">
                            <button
                                className="absolute right-2 top-2 rounded-md hover:bg-grey"
                                onClick={() => {
                                    set_editModalShow(false)
                                    set_eventModalShow(true)
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
            {
                seminarModalShow ?
                    <div className={`absolute top-0 left-0 w-full h-full bg-white bg-opacity-10 backdrop-blur-sm z-10 flex items-center justify-center p-8`}>
                        <div
                            className="absolute top-0 left-0 w-full h-full cursor-pointer"
                            onClick={() => {
                                set_selectedEvent(null)
                                set_seminarModalShow(false)
                            }}
                        />
                        <div className="w-max max-w-[460px] bg-black rounded-lg text-white p-6 relative">
                            <div className="text-center text-white text-2xl mb-2">Seminar Details</div>
                            <button
                                className="absolute right-2 top-2 rounded-md hover:bg-grey"
                                onClick={() => {
                                    set_selectedEvent(null)
                                    set_seminarModalShow(false)
                                }}
                            >
                                <CloseIcon />
                            </button>
                            <SeminarDetails
                                title={selectedEvent?.name}
                                description={selectedEvent?.description}
                                start={selectedEvent?.start}
                                duration={selectedEvent?.duration}
                                price={selectedEvent?.price}
                                admin={selectedEvent?.admin}
                                participants={selectedEvent?.participants}
                            />
                            <div className="w-full h-10 flex justify-center mt-6 space-x-4">
                                <button
                                    className="w-fit px-4 rounded-lg bg-green flex items-center justify-center"
                                    onClick={() => {
                                        if (selectedEvent?.type === 'pending seminar') {
                                            cancelSeminarAppointment(selectedEvent)
                                        } else {
                                            navigateSeminar(selectedEvent)
                                        }
                                    }}
                                >
                                    {
                                        selectedEvent?.type === 'pending seminar' ?
                                            'Cancel Request' :
                                            'Enter Seminar'
                                    }
                                </button>
                            </div>
                        </div>
                    </div> :
                    null
            }
            {
                dayModalShow && (
                    <div className="absolute top-0 left-0 w-full h-full bg-white bg-opacity-10 backdrop-blur-sm z-10 flex items-center justify-center p-8">
                        <div
                        className="absolute top-0 left-0 w-full h-full cursor-pointer"
                        onClick={() => set_dayModalShow(false)}
                        />
                        <div className="w-max max-w-[600px] bg-black rounded-lg text-white p-6 relative">
                        <div className="text-center text-white text-2xl mb-6">
                            Events on {selectedDay?.toLocaleDateString()}
                        </div>
                        <button
                            className="absolute right-2 top-2 rounded-md hover:bg-grey"
                            onClick={() => set_dayModalShow(false)}
                        >
                            <CloseIcon />
                        </button>
                        {selectedDayEvents.length === 0 ? (
                            <div className="text-center py-4">No events scheduled for this day</div>
                        ) : (
                            <div className="max-h-[60vh] overflow-y-auto">
                            {selectedDayEvents.map((event) => (
                                <div key={event.id} className="mb-4 pb-4 border-b border-gray-700">
                                <div className="font-bold mb-2">{event.title}</div>
                                <div className="text-sm">
                                    {new Date(event.start).toLocaleTimeString()} - 
                                    {new Date(event.end).toLocaleTimeString()}
                                </div>
                                {event.type === 'event' ? (
                                    <div className="mt-2 text-sm">
                                    Session with {event.customer?.username || 'Unknown'}
                                    </div>
                                ) : (
                                    <div className="mt-2 text-sm">Seminar</div>
                                )}
                                </div>
                            ))}
                            </div>
                        )}
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default CustomerCalendar;
