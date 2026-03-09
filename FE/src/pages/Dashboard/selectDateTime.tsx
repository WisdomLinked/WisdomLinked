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
    const [showTimeSlotSelector, set_showTimeSlotSelector] = useState(false);


    const toggleTimeSlotSelector = () => {
        set_showTimeSlotSelector(!showTimeSlotSelector);
    };

    const handleSetSelectedIndex = (index: number) => {
        set_selectedIndex(index);
    };

    const handleSetDuration = (value: number) => {
        set_duration(value);
    };

    const eventStyleGetter = (event: any, start: any, end: any) => {
        const now = new Date()
        const style = end < now ? {
            backgroundColor: event.type === 'event' ? '#000000' : '#6C7278',
            borderRadius: '0px',
            opacity: 0.7,
            color: event.type === 'event' ? (event.status === 'accepted' ? '#31B099' : event.status === 'pending' ? '#a87723' : 'red') : 'black',
        } : {
            backgroundColor: event.type === 'event' ? (event.status === 'accepted' ? '#31B099' : event.status === 'pending' ? '#a87723' : 'red') : 'white',
            borderRadius: '0px',
            opacity: 1,
            color: event.type === 'event' ? 'white' : 'black',
            border: '0px',
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
            let backgroundColor;
            let cursor = 'pointer';
            if (selectedIndex === -1) {
                if (!availableTimeSlots.length) {
                    backgroundColor = '#f94144';
                    cursor = 'not-allowed';
                }
                else if (hasEvent) {
                    backgroundColor = '#f9a826';
                } else {
                    backgroundColor = '#30B199';
                }
            }
            else {
                if (availableTimeSlots.includes(selectedIndex)) {
                    backgroundColor = '#30B199';
                }
                else {
                    backgroundColor = '#f94144';
                    cursor = 'not-allowed';
                }
            }

            return {
                style: {
                    backgroundColor,
                    cursor
                },
            };
        },
        [events, selectedIndex, duration]
    );

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
        const timezoneOffset = - new Date().getTimezoneOffset() / 30
        _availableSlots = makeAnOffsetToAvailableTimeSlots(availableSlots || [], timezoneOffset)

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

    const isDateAvailable = (date: number) => {
        const today = new Date().setHours(0, 0, 0, 0);

        // If date is in the past, it's not available
        if (date < today) {
            return false;
        }

        // Check if the date has available time slots
        const availableTimeSlots = getAvailableTimeSlots(date, duration);
        if (availableTimeSlots.length === 0) {
            return false;
        }

        // If we have a selected index, check if that time slot is available on this date
        if (selectedIndex >= 0) {
            return availableTimeSlots.includes(selectedIndex);
        }

        return true;
    };

    // Modify the handleSelectDate function to check availability
    const handleSelectDate = ({ start, end }: any) => {
        const dayStartTime = new Date(start).getTime();
        const dayEndTime = new Date(end).getTime();

        // Check if it's a full day selection and the date is not in the past
        if ((dayEndTime - dayStartTime) === 3600 * 24 * 1000 && dayEndTime >= new Date().getTime()) {
            // Check if the date is available
            if (!isDateAvailable(start)) {
                // Date is unavailable (red), so we don't proceed
                return;
            }

            // Date is available, proceed as normal
            set_selectedDate(start);
            if (selectedIndex >= 0) {
                set_selectedTimeSlot(selectedIndex);
                saveAndNext();
            } else {
                set_modalShow(true);
            }
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
        if (!selectedDate || selectedTimeSlot === undefined) {
            console.error("Invalid date or time slot");
            return;
        }
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
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "20px",
                marginBottom: "10px"
            }}>

                <div style={{ flex: "0 0 auto" }}>
                    <LegendCalendar
                        showTimeSlotSelector={showTimeSlotSelector}
                        toggleTimeSlotSelector={toggleTimeSlotSelector}
                        selectedIndex={selectedIndex}
                        setSelectedIndex={handleSetSelectedIndex}
                        duration={duration}
                        setDuration={handleSetDuration}
                        timeSlotIndices={timeSlotIndices}
                        durations={durations}
                        selectedUser={selectedUser}
                        hidePriceInDurationSelection={hidePriceInDurationSelection}
                    />
                </div>
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
