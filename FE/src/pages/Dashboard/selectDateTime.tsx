import React, { useState, useEffect, useCallback } from "react";
import { Calendar } from "react-big-calendar";
import CloseIcon from '@mui/icons-material/Close';
import "react-big-calendar/lib/css/react-big-calendar.css";
import { isSlotUnavailable, slotToTime } from "../../actions/common";
import { localizer } from "../../actions/common"
import { useAppSelector } from "../../store";
import LegendCalendar from "../../components/LegendCalendar"
import BookingTimeZoneControl from "../../components/scheduling/BookingTimeZoneControl";
import {
    detectUserTimeZone,
    formatSlotLabel,
    getViewerDayStartMs,
    getViewerSlotsForDay,
    getViewerYmdFromCalendarDate,
    resolveViewerTimeZone,
    toYMDInTimeZone,
    viewerSlotToInstant,
} from "../../utils/schedulingTimezone";
import type { BookingDisplayTimeZoneMode } from "../../types/scheduling";
import { filterSlotsForDuration } from "../../utils/schedulingSlots";

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
    const [rawExpertSlots, set_rawExpertSlots] = useState<number[]>([])

    const [modalShow, set_modalShow] = useState(false)
    const [tzMode, setTzMode] = useState<BookingDisplayTimeZoneMode>('mine');
    const [customTz, setCustomTz] = useState(detectUserTimeZone());

    const expertTz = (selectedUser as any)?.timeZone || 'UTC';
    const viewerTz = resolveViewerTimeZone(
        tzMode,
        userDetails?.timeZone || detectUserTimeZone(),
        expertTz,
        customTz,
    );

    const [selectedDate, set_selectedDate] = useState<any>(null)
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

    const eventStyleGetter = (event: any, _start: any, end: any) => {
        const now = new Date()
        const isLegacy = event.type === 'event';
        const style = end < now ? {
            backgroundColor: isLegacy ? '#000000' : '#6C7278',
            borderRadius: '0px',
            opacity: 0.7,
            color: isLegacy ? (event.status === 'accepted' ? '#31B099' : event.status === 'pending' ? '#a87723' : 'red') : 'black',
        } : {
            backgroundColor: isLegacy ? (event.status === 'accepted' ? '#31B099' : event.status === 'pending' ? '#a87723' : 'red') : 'white',
            borderRadius: '0px',
            opacity: 1,
            color: isLegacy ? 'white' : 'black',
            border: '0px',
        };
        return { style };
    };

    const getAvailableTimeSlots = useCallback((selectedDate: any, duration: number) => {
        const viewerYmd = getViewerYmdFromCalendarDate(selectedDate);
        const viewerTodayYmd = toYMDInTimeZone(new Date(), viewerTz);
        if (viewerYmd < viewerTodayYmd) return [];

        const dayStartTime = getViewerDayStartMs(selectedDate, viewerTz);
        const dayEndTime = dayStartTime + (24 * 60 * 60 * 1000) - 1;

        let _availableSlots: Array<any> = getViewerSlotsForDay(
            selectedDate,
            viewerTz,
            rawExpertSlots,
            expertTz,
        );

        if (duration > 30) {
            _availableSlots = filterSlotsForDuration(_availableSlots, duration);
        }

        const blocked = (selectedUser as any)?.blockedBookingDates;
        if (Array.isArray(blocked)) {
            _availableSlots = _availableSlots.filter((slotIdx: number) => {
                const instant = viewerSlotToInstant(selectedDate, slotIdx, viewerTz);
                return !blocked.includes(toYMDInTimeZone(instant, expertTz));
            });
        }

        if (viewerYmd === viewerTodayYmd) {
            const now = Date.now();
            _availableSlots = _availableSlots.filter(
                (slotIdx: number) =>
                    viewerSlotToInstant(selectedDate, slotIdx, viewerTz).getTime() >= now,
            );
        }

        let updatedAvailableSlots = [..._availableSlots];

        for (let i = 0; i < _availableSlots.length; i++) {
            const slotStartMs = viewerSlotToInstant(selectedDate, _availableSlots[i], viewerTz).getTime();
            for (let j = 0; j < events.length; j++) {
                if (events[j].status !== 'declined') {
                    if (isSlotUnavailable(slotStartMs, duration * 60 * 1000, new Date(events[j].start).getTime(), new Date(events[j].end).getTime())) {
                        updatedAvailableSlots.splice(updatedAvailableSlots.indexOf(_availableSlots[i]), 1)
                        break;
                    }
                }
            }
        }

        const noticeRaw = Number((selectedUser as any)?.bookingNoticeHours);
        const noticeH = [24, 48, 72].includes(noticeRaw) ? noticeRaw : 24;
        const earliestMs = Date.now() + noticeH * 60 * 60 * 1000;
        updatedAvailableSlots = updatedAvailableSlots.filter((slotIdx: number) => {
            return viewerSlotToInstant(selectedDate, slotIdx, viewerTz).getTime() >= earliestMs;
        });

        return updatedAvailableSlots;
    }, [events, rawExpertSlots, selectedUser, expertTz, viewerTz]);

    const isDateAvailable = (date: number) => {
        const dayDate = new Date(date);
        const viewerTodayYmd = toYMDInTimeZone(new Date(), viewerTz);
        const viewerDayYmd = getViewerYmdFromCalendarDate(dayDate);
        if (viewerDayYmd < viewerTodayYmd) {
            return false;
        }

        const availableTimeSlots = getAvailableTimeSlots(dayDate, duration);
        if (availableTimeSlots.length === 0) {
            return false;
        }

        if (selectedIndex >= 0) {
            return availableTimeSlots.includes(selectedIndex);
        }

        return true;
    };

    const dayStyleGetter = useCallback(
        (date: Date) => {
            const viewerTodayYmd = toYMDInTimeZone(new Date(), viewerTz);
            const viewerDayYmd = getViewerYmdFromCalendarDate(date);

            if (viewerDayYmd < viewerTodayYmd) {
                return {
                    style: {
                        backgroundColor: '#141414',
                        cursor: 'not-allowed',
                    },
                };
            }

            const dayStartTime = getViewerDayStartMs(date, viewerTz);
            const dayEndTime = dayStartTime + 24 * 60 * 60 * 1000 - 1;
            const hasEvent = events.some(
                (event) =>
                    new Date(event.end).getTime() >= dayStartTime &&
                    new Date(event.start).getTime() <= dayEndTime
            );

            let availableTimeSlots = getAvailableTimeSlots(date, duration)
            let backgroundColor
            let cursorStyle = 'pointer'
            if (selectedIndex === -1) {
                if (!availableTimeSlots.length) {
                    backgroundColor = '#f94144'
                    cursorStyle = 'not-allowed';
                }
                else if (hasEvent) {
                    backgroundColor = '#f9a826'
                } else {
                    backgroundColor = '#30B199'
                }
            }
            else {
                if (availableTimeSlots.includes(selectedIndex)) {
                    backgroundColor = '#30B199'
                }
                else {
                    backgroundColor = '#f94144'
                    cursorStyle = 'not-allowed';
                }
            }

            return {
                style: {
                    backgroundColor,
                    cursorStyle
                },
            };
        },
        [events, selectedIndex, duration, getAvailableTimeSlots, viewerTz]
    );

    const saveAndNext = (slotOverride?: number) => {
        const slot = slotOverride !== undefined ? slotOverride : selectedTimeSlot;
        if (!selectedDate || slot === undefined || slot === null) {
            console.error("Invalid date or time slot");
            return;
        }
        const start = viewerSlotToInstant(selectedDate, slot, viewerTz);
        const end = new Date(start.getTime() + duration * 60 * 1000);
        setStartEndTime(start, end, duration)
    }

    const handleSelectDate = ({ start, end }: any) => {
        const dayStartTime = new Date(start).getTime();
        const dayEndTime = new Date(end).getTime();

        if ((dayEndTime - dayStartTime) === 3600 * 24 * 1000 && dayEndTime >= new Date().getTime()) {
            if (!isDateAvailable(start)) {
                return;
            }

            set_selectedDate(start);
            if (selectedIndex >= 0) {
                set_selectedTimeSlot(selectedIndex);
                saveAndNext(selectedIndex);
            } else {
                set_modalShow(true);
            }
        }
    };

    const updateTimeSlots = async () => {
        const _availableSlots = getAvailableTimeSlots(selectedDate, duration)
        set_timeSlots([..._availableSlots])
    }

    useEffect(() => {
        if (selectedDate && modalShow) {
            updateTimeSlots()
        }
    }, [duration, selectedDate, modalShow, selectedUser, rawExpertSlots, events, getAvailableTimeSlots])

    useEffect(() => {
        if (userDetails.role === 'customer') {
            set_rawExpertSlots(selectedUser?.timeSlots || [])
        } else {
            set_rawExpertSlots(userDetails?.timeSlots || [])
        }

        const temp: any[] = []
        selectedUser?.events?.forEach((event: any) => {
            temp.push({
                ...event,
                id: event._id,
                start: new Date(event.start),
                end: new Date(event.end),
                title: `(Legacy) ${event.title || 'Session'}`,
                type: 'event'
            })
        })
        selectedUser?.groupChats?.forEach((gc: any) => {
            const prefix =
                gc.type === 'individual'
                    ? '(1:1)'
                    : gc.type === 'seminar'
                        ? '(S)'
                        : '(G)';
            temp.push({
                ...gc,
                id: gc._id,
                start: new Date(gc.start),
                end: new Date(gc.end),
                title: `${prefix} ${gc.name}`,
                type: gc.type === 'individual' ? 'individual' : 'seminar',
            })
        })
        selectedUser?.pendingGroupChats?.forEach((item: any) => {
            temp.push({
                ...item.groupChatId,
                id: item.groupChatId?._id,
                start: new Date(item.groupChatId?.start),
                end: new Date(item.groupChatId?.end),
                title: '(PS) ' + item.groupChatId?.name,
                type: 'pending seminar'
            })
        })
        myEvents?.forEach((event: any) => {
            temp.push(event)
        })
        set_events(temp)
    }, [selectedUser, myEvents, userDetails.role, userDetails?.timeSlots])

    const generateTimeSlotIndices = () => {
        const slots = [];
        let currentTime = new Date("2025-04-06T00:00:00");
        const endTime = new Date("2025-04-06T23:30:00");
        let index = 0;

        while (currentTime <= endTime) {
            slots.push({ index, time: currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) });
            currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
            index++;
        }

        return slots;
    };

    const timeSlotIndices = generateTimeSlotIndices();

    return (
        <>
            <BookingTimeZoneControl
                mode={tzMode}
                customTimeZone={customTz}
                expertTimeZone={expertTz}
                studentTimeZone={userDetails?.timeZone}
                onModeChange={setTzMode}
                onCustomTimeZoneChange={setCustomTz}
            />
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
                            <p className="mt-2 text-center text-xs text-lightgrey">Times shown in {viewerTz}</p>
                            <div className="mt-8 text-lightgrey text-[12px] leading-[19px]">Duration (price)</div>
                            <select
                                className="w-full bg-black rounded-[15px] h-[62px] mt-0.5 border text-white text-[14px] leading-[21px] px-[24px] disabled:cursor-not-allowed"
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
                                                {selectedDate ? formatSlotLabel(slot, selectedDate, viewerTz) : slotToTime(slot)}
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
                                    disabled={selectedTimeSlot === undefined || selectedTimeSlot === null}
                                    onClick={() => saveAndNext()}
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
