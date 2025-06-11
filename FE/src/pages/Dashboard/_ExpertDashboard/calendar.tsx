import React, { useState, useEffect, useCallback } from "react";
import { Calendar, SlotInfo } from "react-big-calendar";
import CloseIcon from '@mui/icons-material/Close';
import EventDetail from "./eventDetail";
import {
    doAcceptEvent,
    doCancelInvitation,
    doDeclineEvent,
    doGetMyEvents
} from "../../../api/api";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../../../store";
import SeminarDetails from "../seminarDetails";
import { SetLoadingStatus } from "../../../actions/appActions";
import { localizer } from "../../../actions/common"
import { updateMe } from "../../../actions/authActions";
import {setChosenChatDetails} from "../../../actions/chatActions";
import { useNavigate } from "react-router-dom";

const ExpertCalendar = () => {

    const { auth: { userDetails: { status } } } = useAppSelector(state => state)
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [events, set_events] = useState<Array<any>>([])
    const [selectedEvent, set_selectedEvent] = useState<any>(null)
    const [eventModalShow, set_eventModalShow] = useState<boolean>(false)
    const [seminarModalShow, set_seminarModalShow] = useState<boolean>(false)
    const [selectedDay, set_selectedDay] = useState<Date | null>(null);
    const [selectedDayEvents, set_selectedDayEvents] = useState<Array<any>>([]);
    const [dayModalShow, set_dayModalShow] = useState<boolean>(false);


    const eventStyleGetter = (event: any, start: any, end: any) => {
        const now = new Date()
        const style = end < now ? {
            backgroundColor: event.type === 'event' ? '#000000' : '#DCE4E8',
            borderRadius: '0px',
            opacity: 0.7,
            // color: event.type === 'event' ? (event.paidBy === 'none' ? '#03a9f4' : event.status === 'accepted' ? '#31B099' : event.status === 'pending' ? '#a87723' : 'red') : 'black',
            color: event.type === 'event' ? '#A0A4A6' : 'black',
            // display: 'block',
            // 'pointer-events': 'none'
        } : {
            backgroundColor: event.type === 'event' ? (event.paidBy === 'none' ? '#03a9f4' : event.status === 'accepted' ? '#31B099' : event.status === 'pending' ? '#a87723' : 'red') : 'white',
            borderRadius: '0px',
            opacity: 1,
            color: event.type === 'event' ? 'white' : 'black',
            border: '0px',
            // display: 'block',
        };
        return {
            style: style,
        };
    };

    const handleSelectEvent = (event: any) => {
        set_selectedEvent(event)
        if (event.type === 'event') {
            set_eventModalShow(true)
        } else {
            set_seminarModalShow(true)
        }
    }

    const declineEvent = async () => {
        SetLoadingStatus(true)
        const response = await doDeclineEvent(selectedEvent._id)
        SetLoadingStatus(false)
        if (response) {
            console.log(response)
            set_selectedEvent({
                ...selectedEvent,
                status: 'declined',
            })
            let temp = events
            let index = events.findIndex(x => x.id === selectedEvent.id)
            if (index > -1) {
                temp[index].status = 'declined'
                set_events([...temp])
            }
        }

    }

    const acceptEvent = async () => {
        SetLoadingStatus(true)
        const response = await doAcceptEvent(selectedEvent._id)
        SetLoadingStatus(false)
        if (response) {
            console.log(response)
            set_selectedEvent({
                ...selectedEvent,
                status: 'accepted',
            })
            let temp = events
            let index = events.findIndex(x => x.id === selectedEvent.id)
            if (index > -1) {
                temp[index].status = 'accepted'
                set_events([...temp])
            }
        }
    }

    const navigateCustomer = (item: any) => {
        console.log("navigate events", item); // Use item here instead of event
        navigate(`${process.env.REACT_APP_AUTH_URL}expertdashboard/chat`);
        // Assuming item contains customer details, you can use item directly
        dispatch(setChosenChatDetails({ userId: item._id, username: item.username, image: item.image }));
    };

    const getEvents = async () => {
        SetLoadingStatus(true)
        const response = await doGetMyEvents()
        SetLoadingStatus(false)
        if (response) {
            console.log(response)
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
            set_events([...temp])
        }
    }

    // const dayPropGetter = useCallback(
    //     (date) => {
    //         const today = new Date();
    //         today.setHours(0, 0, 0, 0); // Normalize today's date to midnight

    //         // Check if the date is in the future
    //         if (date < today) {
    //             return {}; // No styling for past dates
    //         }
    //         const hasEvent = events.some(
    //             (event) =>
    //                 date >= new Date(event.start).setHours(0, 0, 0, 0) &&
    //                 date <= new Date(event.end).setHours(23, 59, 59, 999)
    //         );
    //         return {
    //             style: {
    //                 backgroundColor: hasEvent ? "#f94144" : "#30B199", // Red for busy days, green for available days
    //             },
    //         };
    //     },
    //     [events]
    // );

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
    

    const cancelInvitation = async (id: any) => {
        SetLoadingStatus(true)
        const response = await doCancelInvitation(id)
        if (response) {
            set_eventModalShow(false)
            set_selectedEvent(null)
            dispatch(updateMe())
            let temp = events.filter(x => x.id !== id)
            set_events([...temp])
        }
        SetLoadingStatus(false)
    }

    useEffect(() => {
        getEvents()
    }, [])

    return (
        <div className="w-full h-full p-6 relative">
            <Calendar
                className="expertCalendar !h-full min-h-[400px] pt-1 pb-6 text-white"
                views={["month", "week", "day", "agenda"]}
                selectable
                localizer={localizer}
                defaultDate={new Date()}
                defaultView="month"
                events={events || []}
                eventPropGetter={eventStyleGetter}
                onSelectEvent={handleSelectEvent}
                onSelectSlot={(slotInfo) => handleDayClick(slotInfo.start)}
                // dayPropGetter={dayPropGetter}
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
                                        <div>Invitation sent</div>
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
                                image={selectedEvent?.customer?.image}
                                name={selectedEvent?.customer?.username}
                                title={selectedEvent?.title}
                                description={selectedEvent?.customer?.email}
                                start={selectedEvent?.start}
                                duration={selectedEvent?.duration}
                                price={selectedEvent?.price}
                                paidBy={selectedEvent?.paidBy}
                            />
                            {
                                selectedEvent?.end > new Date() ?
                                    selectedEvent?.paidBy === 'none' ?
                                        <div className="w-full h-10 flex justify-center mt-6">
                                            <button
                                                className="w-[calc(50%-8px)] rounded-lg border border-lightgrey flex items-center justify-center"
                                                onClick={() => cancelInvitation(selectedEvent._id)}
                                            >
                                                Cancel
                                            </button>
                                        </div> :
                                        selectedEvent?.status === 'pending' ?
                                            <div className="w-full h-10 flex justify-between mt-6">
                                                <button
                                                    className="w-[calc(50%-8px)] rounded-lg border border-lightgrey flex items-center justify-center"
                                                    onClick={declineEvent}
                                                >
                                                    Decline
                                                </button>
                                                <button
                                                    className="w-[calc(50%-8px)] bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                                    disabled={status === 'review'}
                                                    onClick={acceptEvent}
                                                >
                                                    Accept
                                                </button>

                                            </div> :
                                            selectedEvent?.status === 'accepted' ?
                                                <div className="w-full h-10 flex justify-center space-x-6 n mt-6">
                                                    <button
                                                        className="w-[calc(50%-8px)] rounded-lg border border-lightgrey flex items-center justify-center"
                                                        onClick={declineEvent}
                                                    >
                                                        Decline
                                                    </button>
                                                    <button
                                                        className="w-[calc(50%-8px)] bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                                        onClick={() => navigateCustomer(selectedEvent?.customer)}
                                                    >
                                                        Go To Chat
                                                    </button>
                                                </div> :
                                                null :
                                    <div className="w-full h-10 flex justify-center mt-6">
                                        <button
                                            className="w-[calc(50%-8px)] bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                            onClick={() => navigateCustomer(selectedEvent?.customer)}
                                        >
                                            Chat History
                                        </button>
                                    </div>
                            }
                        </div>
                    </div> :
                    null
            }
            {
                seminarModalShow ?
                    <div
                        className={`absolute top-0 left-0 w-full h-full bg-white bg-opacity-10 backdrop-blur-sm z-10 flex items-center justify-center p-8`}>
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
                                keywords={selectedEvent?.keywords}
                                services={selectedEvent?.services}
                            />
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

export default ExpertCalendar;
