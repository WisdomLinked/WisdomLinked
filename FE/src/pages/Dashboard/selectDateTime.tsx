import React, { useState, useEffect, useCallback } from "react";
import { Calendar } from "react-big-calendar";
import CloseIcon from '@mui/icons-material/Close';
import "react-big-calendar/lib/css/react-big-calendar.css";
import { isSlotUnavailable, makeAnOffsetToAvailableTimeSlots, slotToTime } from "../../actions/common";
// https://codesandbox.io/s/blazing-pond-47crhl?file=/src/ReactBigCalendar.js
import { localizer } from "../../actions/common"
import { SetLoadingStatus } from "../../actions/appActions";
import { getDailyTimeSlots } from "../../api/api";
import { useAppSelector } from "../../store";
import LegendCalendar from "../../components/LegendCalendar"

const SelectDateTime = ({
    setStartEndTime,
    selectedUser,
    myEvents,
    hideEvents,
    disableDurationSelection,
    hidePriceInDurationSelection
}: any) => {

    const { auth: { userDetails } } = useAppSelector((state) => state);

    const [events, set_events] = useState<Array<any>>([])
    const [availableSlots, set_availableSlots] = useState([])

    const [modalShow, set_modalShow] = useState(false)

    // Date Selection -------
    const [selectedDate, set_selectedDate] = useState<any>(null)
    // Time Selection -------
    const durations = [30, 60, 90]
    const [duration, set_duration] = useState(30)
    const [timeSlots, set_timeSlots] = useState<Array<any>>([])
    const [selectedTimeSlot, set_selectedTimeSlot] = useState<any>()
    const [selectedIndex, set_selectedIndex] = useState(-1);

    const eventStyleGetter = (event: any, start: any, end: any) => {
        const now = new Date()
        const style = end < now ? {
            backgroundColor: event.type === 'event' ? '#000000' : '#6C7278',
            borderRadius: '0px',
            opacity: 0.7,
            color: event.type === 'event' ? (event.status === 'accepted' ? '#31B099' : event.status === 'pending' ? '#a87723' : 'red') : 'black',
            // display: 'block',
            // 'pointer-events': 'none'
        } : {
            backgroundColor: event.type === 'event' ? (event.status === 'accepted' ? '#31B099' : event.status === 'pending' ? '#a87723' : 'red') : 'white',
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

    const dayStyleGetter = useCallback(
        (date) => {
            const today = new Date().setHours(0, 0, 0, 0); // Normalize today's date to midnight
    
            // Style for past dates
            if (date < today) {
                return {
                    style: {
                        backgroundColor: '#141414',
                        cursor: 'not-allowed',
                    },
                };
            }
    
            // Check if the date has an event
            const hasEvent = events.some(
                (event) =>
                    date >= new Date(event.start).setHours(0, 0, 0, 0) &&
                    date <= new Date(event.end).setHours(23, 59, 59, 999)
            );
            
            let availableTimeSlots = getAvailableTimeSlots(date, duration)
            let backgroundColor
            if(selectedIndex === -1)
            {
                if(!availableTimeSlots.length){
                    backgroundColor = '#f94144'
                }
                else if(hasEvent){
                    backgroundColor = '#f9a826'
                } else {
                    backgroundColor = '#30B199'
                }
            }
            else{
                if(availableTimeSlots.includes(selectedIndex)){
                    backgroundColor = '#30B199'
                }
                else{
                    backgroundColor = '#f94144'
                }
            }
    
            // Style for future dates based on event presence
            return {
                style: {
                    backgroundColor, // Red for busy days, green for available days
                    cursor: 'pointer',
                },
            };
        },
        [events, selectedIndex, duration] 
    );
    

    // const dayStyleGetter = (date: any) => {
    //     const today = new Date().setHours(0, 0, 0, 0)
    //     const style =
    //         date < today ?
    //             {
    //                 backgroundColor: '#141414',
    //                 cursor: 'not-allowed'
    //             } : {
    //                 cursor: 'pointer'
    //             };
    //     return {
    //         style: style,
    //     };
    // };

    const isToday = (selectedDate: any) => {
        const today = new Date();
        return selectedDate.getDate() === today.getDate() &&
            selectedDate.getMonth() === today.getMonth() &&
            selectedDate.getFullYear() === today.getFullYear();
    }

    const getAvailableTimeSlots = (selectedDate: any, duration: number) => {
        const dayStartTime = new Date(selectedDate).getTime()
        const dayEndTime = dayStartTime + (24 * 60 * 60 * 1000) - 1
        const start = new Date(dayStartTime)
        const end = new Date(dayEndTime)
        // events of the selected date 
        const selectedEvents = events?.filter((item: any) =>
            item.start >= start && item.end <= end
        );

        let _availableSlots: Array<any> = []
        // setting available time slot -----
        // SetLoadingStatus(true)
        // const response: any = await getDailyTimeSlots(dayStartTime, dayEndTime, userDetails.role === 'customer' ? selectedUser._id : null)
        // if (response) {
        //     if (response.dailyTimeSlots?.length) {
        //         _availableSlots = response.dailyTimeSlots.map((time: number) => {
        //             return (time - dayStartTime) / (30 * 60 * 1000)
        //         })
        //     } else {
        //         const timezoneOffset = - new Date().getTimezoneOffset() / 30
        //         _availableSlots = makeAnOffsetToAvailableTimeSlots(availableSlots || [], timezoneOffset)
        //     }
        //     set_modalShow(true)
        // }
        // SetLoadingStatus(false)
        const timezoneOffset = - new Date().getTimezoneOffset() / 30
        _availableSlots = makeAnOffsetToAvailableTimeSlots(availableSlots || [], timezoneOffset)
        // set_modalShow(true)

        _availableSlots.splice(_availableSlots.length - (duration / 30 - 1), duration / 30 - 1)

        if (isToday(selectedDate)) {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0); // Set the time to 00:00:00.000
            const now = new Date();
            const timeDiffInMs = now.getTime() - startOfToday.getTime();
            const nextSlot = Math.floor(timeDiffInMs / (1000 * 60 * 30))
            for (let i = 0; i < nextSlot; i++) {
                let index = _availableSlots.indexOf(i)
                if (index > -1) {
                    _availableSlots.splice(index, 1)
                }
            }
        }

        let updatedAvailableSlots = [..._availableSlots]

        for (let i = 0; i < _availableSlots.length; i++) {
            for (let j = 0; j < selectedEvents.length; j++) {
                if (selectedEvents[j].status !== 'declined') {
                    if (isSlotUnavailable(dayStartTime + _availableSlots[i] * 1800000, duration * 60 * 1000, new Date(selectedEvents[j].start).getTime(), new Date(selectedEvents[j].end).getTime())) {
                        updatedAvailableSlots.splice(updatedAvailableSlots.indexOf(_availableSlots[i]), 1)
                        break;
                    }
                }
            }
        }


        return updatedAvailableSlots;
    }

    const handleSelectDate = ({ start, end }: any) => {
        set_duration(30)
        const dayStartTime = new Date(start).getTime()
        const dayEndTime = new Date(end).getTime()
        if ((dayEndTime - dayStartTime) === 3600 * 24 * 1000 && dayEndTime >= new Date().getTime()) {
            set_selectedDate(start)
            set_modalShow(true)
        }
    };

    const updateTimeSlots = async () => {
        const _availableSlots = await getAvailableTimeSlots(selectedDate, duration)
        set_timeSlots([..._availableSlots])
    }

    useEffect(() => {
        if (selectedDate && modalShow) {
            updateTimeSlots()
        }
    }, [duration, selectedDate, modalShow])

    const saveAndNext = () => {
        const dayStartTime = new Date(selectedDate).getTime()
        const eventStartTime = dayStartTime + selectedTimeSlot * 1800 * 1000
        const eventEndTime = eventStartTime + duration * 60 * 1000
        setStartEndTime(new Date(eventStartTime), new Date(eventEndTime), duration)
    }

    useEffect(() => {
        if (userDetails.role === 'customer') {
            set_availableSlots(selectedUser?.timeSlots || [])
        } else {
            set_availableSlots(userDetails?.timeSlots || [])
        }
        let temp = selectedUser?.events.map((event: any) => {
            return {
                ...event,
                id: event._id,
                start: new Date(event.start),
                end: new Date(event.end),
                type: 'event'
            }
        })
        selectedUser?.groupChats.map((seminar: any) => {
            temp.push({
                ...seminar,
                id: seminar._id,
                start: new Date(seminar.start),
                end: new Date(seminar.end),
                title: '(S)' + seminar.name,
                type: 'seminar'
            })
        })
        selectedUser?.pendingGroupChats.map((item: any) => {
            temp.push({
                ...item.groupChatId,
                id: item.groupChatId?._id,
                start: new Date(item.groupChatId?.start),
                end: new Date(item.groupChatId?.end),
                title: '(PS)' + item.groupChatId?.name,
                type: 'pending seminar'
            })
        })
        myEvents?.map((event: any) => {
            temp.push(event)
        })
        set_events([...temp])
    }, [selectedUser, myEvents])

    
    const generateTimeSlotIndices = () => {
        const slots = [];
        let currentTime = new Date("2025-04-06T00:00:00"); // Start at 12:00 AM
        const endTime = new Date("2025-04-06T23:30:00"); // End at 11:30 PM
        let index = 0;
      
        while (currentTime <= endTime) {
          slots.push({ index, time: currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) });
          currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000); // Increment by 30 minutes
          index++;
        }
      
        return slots;
      };
      
      const timeSlotIndices = generateTimeSlotIndices();
      

    return (
        <>
            <LegendCalendar />
            <div style={{ display: "flex", gap: "10px" }}>
                {/* Time Slot Dropdown */}
                <select
                    className="bg-black text-white rounded-md px-4 py-2"
                    value={selectedIndex || ""}
                    onChange={(e) => set_selectedIndex(parseInt(e.target.value))}
                >
                    <option value="" disabled>
                    Select Time Slot
                    </option>
                    {timeSlotIndices.map((slot) => (
                    <option key={slot.index} value={slot.index}>
                        {slot.time}
                    </option>
                    ))}
                </select>

                {/* Duration Dropdown */}
                <select
                    className="bg-black text-white rounded-md px-4 py-2"
                    value={duration}
                    onChange={(e) => set_duration(parseInt(e.target.value))}
                >
                    {durations.map((val) => (
                    <option key={val} value={val}>
                        {val} min{" "}
                        {hidePriceInDurationSelection ? "" : `( $${(val * selectedUser?.price) / 60} )`}
                    </option>
                    ))}
                </select>

                {/* Clear Button */}
                <button
                    className="bg-black text-white px-4 py-2 rounded-md"
                    onClick={() => set_selectedIndex(-1)}
                >
                    Clear
                </button>
            </div>
            <Calendar
                className="customerSelectDateTimeCalendar !h min-h-[400px] pt-1 pb-6 text-white"
                views={["month"]}
                selectable
                localizer={localizer}
                defaultDate={new Date()}
                defaultView="month"
                events={hideEvents ? [] : events}
                eventPropGetter={eventStyleGetter}
                dayPropGetter={dayStyleGetter}
                onSelectSlot={handleSelectDate}
            />
            {
                modalShow ?
                    <div className={`absolute top-0 left-0 w-full h-full bg-white bg-opacity-10 backdrop-blur-sm z-10 flex items-center justify-center p-8`}>
                        <div className="absolute top-0 left-0 w-full h-full cursor-pointer" onClick={() => set_modalShow(false)} />
                        <div className="w-full max-w-[400px] bg-black rounded-lg text-white p-6 relative">
                            <button
                                className="absolute right-4 top-4 rounded-md hover:bg-grey"
                                onClick={() => set_modalShow(false)}
                            >
                                <CloseIcon />
                            </button>
                            <div className="text-center text-2xl">Select time</div>
                            <div className="mt-8 text-lightgrey text-[12px] leading-[19px]">Duration (price)</div>
                            <select
                                className="w-full bg-black rounded-[15px] h-[62px] mt-0.5 border text-white text-[14px] leading-[21px] px-[24px] disabled:cursor-not-allowed"
                                placeholder="Input your Company Website"
                                value={duration}
                                disabled={disableDurationSelection}
                                onChange={(e) => set_duration(parseInt(e.target.value))}
                            >
                                {
                                    durations.map(val => <option key={val} value={val}> {val} min  {hidePriceInDurationSelection ? '' : `( $${val * selectedUser?.price / 60} )`}</option>)
                                }

                            </select>
                            <div className="w-full max-h-[calc(80vh-312px)] my-10 overflow-y-auto px-4">
                                {
                                    timeSlots?.length ?
                                        timeSlots.map((slot, index) => (
                                            <button
                                                key={`slot_${index}`}
                                                className={`w-full h-14 flex justify-center items-center border border-green rounded-lg text-xl text-green mb-[10px] ${selectedTimeSlot === slot ? 'bg-green text-white' : 'hover:bg-green hover:text-white'}`}
                                                onClick={() => set_selectedTimeSlot(selectedTimeSlot === slot ? null : slot)}
                                            >
                                                {slotToTime(slot)}
                                            </button>
                                        )) :
                                        <div className="text-center text-grey text-xl">No available times</div>
                                }
                            </div>
                            <div className="w-full h-10 flex justify-between">
                                <button
                                    className="w-[calc(50%-8px)] rounded-lg border border-lightgrey flex items-center justify-center"
                                    onClick={() => set_modalShow(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="w-[calc(50%-8px)] bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                    disabled={!selectedTimeSlot}
                                    onClick={saveAndNext}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div> :
                    null
            }
        </>
    );
};

export default SelectDateTime;
