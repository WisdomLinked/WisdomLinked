import React, { useEffect, useState } from "react";
import { Calendar } from "react-big-calendar";
import { useAppSelector } from "../../../store";
import { useDispatch } from "react-redux";
import { formatDateYYYY_MM_DD, makeAnOffsetToAvailableTimeSlots } from "../../../actions/common";
import { doUpdateDailyTimeSlots, doUpdateProfile, doUpdateTimeSlots, getDailyTimeSlots } from "../../../api/api";
import ShowFieldError from "../../../components/ShowFieldError";
import { SetLoadingStatus } from "../../../actions/appActions";
import CloseIcon from '@mui/icons-material/Close';
import { localizer } from "../../../actions/common";
const timezoneOffset = - new Date().getTimezoneOffset() / 30

const Availability = () => {
    const { auth: { userDetails } } = useAppSelector((state) => state)
    const dispatch = useDispatch()
    const [events, set_events] = useState<Array<any>>([])
    const [slots, set_slots] = useState<Array<any>>(userDetails?.timeSlots || [])
    const [selectedStartTime, set_selectedStartTime] = useState(0)
    const [dailyEvents, set_dailyEvents] = useState<Array<any>>([])
    const [dailySlots, set_dailySlots] = useState<Array<any>>([])
    const [price, set_price] = useState(userDetails.price || 5)
    const [showError, set_showError] = useState(false)
    const [tab, set_tab] = useState('common')
    const [modalShow, set_modalShow] = useState(false)

    // DAILY BASIS TIME SLOT UPDATING ---------
    const dayStyleGetter = (date: any) => {
        const today = new Date().setHours(0, 0, 0, 0)
        const _date = new Date(date).getTime()
        const style =
            date < today ?
                {
                    backgroundColor: '#141414',
                    cursor: 'not-allowed'
                } :
                {
                    cursor: 'pointer'
                };
        return {
            style: style,
        };
    };

    const handleSelectDate = async ({ start }: any) => {
        const startTime = new Date(start).getTime()
        const endTime = new Date(start).setHours(23, 59, 59, 999)
        set_selectedStartTime(startTime)
        SetLoadingStatus(true)
        const response: any = await getDailyTimeSlots(startTime, endTime, userDetails.userId)
        if (response) {
            if (response.dailyTimeSlots?.length) {
                let temp = response.dailyTimeSlots.map((time: number) => {
                    return (time - startTime) / (30 * 60 * 1000)
                })
                set_dailySlots(temp)
            } else {
                set_dailySlots(slots)
            }
            set_modalShow(true)
        }
        SetLoadingStatus(false)
    }

    const updateDailyTimeSlots = async ({ start, end }: any) => {
        let temp = [...dailySlots]
        const startSlot = new Date(start).getHours() * 2 + (new Date(start).getMinutes() ? 1 : 0)
        const endSlot = new Date(end).getHours() === 23 && new Date(end).getMinutes() === 59 ? 48 : new Date(end).getHours() * 2 + (new Date(end).getMinutes() ? 1 : 0)
        for (let i = startSlot; i < endSlot; i++) {
            if (temp.indexOf(i) === -1)
                temp.push(i)
            else
                temp.splice(temp.indexOf(i), 1)
        }
        temp.sort((a, b) => a - b)
        set_dailySlots([...temp])
    }

    const closeDailyTimeSlotsModal = () => {
        set_modalShow(false)
        set_dailySlots([])
    }

    const saveDailyTimeSLots = async () => {
        const selectedEndTime = new Date(selectedStartTime).setHours(23, 59, 59, 999)
        const newDailySlots = dailySlots.map((x: any) => selectedStartTime + x * 30 * 60 * 1000)
        SetLoadingStatus(true)
        await doUpdateDailyTimeSlots(newDailySlots, selectedStartTime, selectedEndTime)
        SetLoadingStatus(false)
        set_modalShow(false)
        set_dailySlots([])
    }

    useEffect(() => {
        let temp = []
        const today = new Date()
        for (let i = 0; i < dailySlots.length; i++) {
            temp.push({
                id: i,
                title: '',
                start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), Math.floor(dailySlots[i] / 2), 30 * (dailySlots[i] % 2), 0),
                end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), Math.floor((dailySlots[i] + 1) / 2), dailySlots[i] === 46 ? 59 : 30 * ((dailySlots[i] + 1) % 2), dailySlots[i] === 46 ? 59 : 0)
            })
        }
        set_dailyEvents([...temp])
    }, [dailySlots])

    // TIME SLOTS UPDATING -----------
    const updateSlots = async ({ start, end }: any) => {
        let temp = [...slots]
        const startSlot = new Date(start).getHours() * 2 + (new Date(start).getMinutes() ? 1 : 0)
        const endSlot = new Date(end).getHours() === 23 && new Date(end).getMinutes() === 59 ? 48 : new Date(end).getHours() * 2 + (new Date(end).getMinutes() ? 1 : 0)
        for (let i = startSlot; i < endSlot; i++) {
            if (temp.indexOf(i) === -1)
                temp.push(i)
            else
                temp.splice(temp.indexOf(i), 1)
        }
        temp.sort((a, b) => a - b)
        temp = makeAnOffsetToAvailableTimeSlots(temp, -timezoneOffset)
        SetLoadingStatus(true)
        const response: any = await doUpdateTimeSlots(temp)
        if (response) {
            dispatch({
                type: 'updateUserDetails',
                payload: {
                    timeSlots: response.newUser.timeSlots
                }
            })
        }
        SetLoadingStatus(false)
    }

    useEffect(() => {
        let temp = []
        const today = new Date()
        for (let i = 0; i < slots.length; i++) {
            temp.push({
                id: i,
                title: '',
                start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), Math.floor(slots[i] / 2), 30 * (slots[i] % 2), 0),
                end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), Math.floor((slots[i] + 1) / 2), slots[i] === 46 ? 59 : 30 * ((slots[i] + 1) % 2), slots[i] === 46 ? 59 : 0)
            })
        }
        set_events([...temp])
    }, [slots])

    useEffect(() => {
        let currentTimeZoneSlots = makeAnOffsetToAvailableTimeSlots(userDetails?.timeSlots, timezoneOffset)
        set_slots([...currentTimeZoneSlots])
    }, [userDetails.timeSlots])

    // PRICE SETTING -------------
    const updateProfile = async () => {
        SetLoadingStatus(true)
        const response: any = await doUpdateProfile({
            price: price
        })
        if (response) {
            dispatch({
                type: 'updateUserDetails',
                payload: response.newUser
            })
        }
        SetLoadingStatus(false)
    }

    useEffect(() => {
        if (price >= 5 && price <= 100 && price !== userDetails.price) {
            set_showError(false)
            let timer = setTimeout(() => {
                updateProfile()
            }, 500)
            return (() => clearTimeout(timer))
        } else {
            set_showError(true)
        }
    }, [price])

    return (
        <div className="w-full h-full relative">
            <div className="w-full h-full max-w-[500px] mx-auto p-6 text-white overflow-y-auto">
                <div className="text-center text-white text-3xl">Your availability</div>
                <div className="mt-10 text-grey text-[12px] leading-[19px]">Hourly rate (usd/hour)</div>
                <input
                    className="w-full bg-transparent rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] px-[24px] border-lightgrey"
                    placeholder="usd/hour"
                    value={price}
                    type='number'
                    min={5}
                    max={100}
                    onChange={(e) => set_price(parseInt(e.target.value))}
                />
                <ShowFieldError
                    show={!(price >= 5 && price <= 100) && showError}
                    label="Hourly rate should be in $5 ~ $100"
                />
                <div className="mt-6 flex justify-between items-center">
                    <div className="w-fit text-grey text-[12px] leading-[19px]">Time availability</div>
                    <div className="flex gap-3">
                        <button
                            className={`px-3 py-1 rounded-md border text-lightgrey ${tab === 'common' ? 'bg-green border-green' : 'border-lightgrey hover:bg-green hover:border-green'}`}
                            onClick={() => set_tab('common')}
                        >
                            Common
                        </button>
                        <button
                            className={`px-3 py-1 rounded-md border text-lightgrey ${tab === 'daily' ? 'bg-green border-green' : 'border-lightgrey hover:bg-green hover:border-green'}`}
                            onClick={() => set_tab('daily')}
                        >
                            Daily basis
                        </button>
                    </div>
                </div>
                <div className="w-full mt-1 h-[calc(100%-213px)]">
                    <div className={`w-full h-full ${tab === 'common' ? '' : 'hidden'}`}>
                        <Calendar
                            className={`expertTimeSlot h-full min-h-[400px] pt-1 pb-6 text-white `}
                            views={["day"]}
                            selectable
                            localizer={localizer}
                            defaultDate={new Date()}
                            defaultView="day"
                            events={events || []}
                            onSelectSlot={updateSlots}
                            onSelectEvent={updateSlots}
                        />
                    </div>
                    <div className={`w-full h-full ${tab === 'common' ? 'hidden' : ''}`}>
                        <Calendar
                            className={`customerSelectDateTimeCalendar !h-full min-h-[400px] pt-1 pb-6 text-white`}
                            views={["month"]}
                            selectable
                            localizer={localizer}
                            defaultDate={new Date()}
                            defaultView="month"
                            dayPropGetter={dayStyleGetter}
                            onSelectSlot={handleSelectDate}
                        />
                    </div>
                </div>
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
                                <div className="text-center text-2xl">Select Slots ({formatDateYYYY_MM_DD(new Date(selectedStartTime))})</div>
                                <div className="w-full h-[60vh] min-h-[400px] mt-4">
                                    <Calendar
                                        className={`expertTimeSlot h-full pt-1 pb-6 text-white `}
                                        views={["day"]}
                                        selectable
                                        localizer={localizer}
                                        defaultDate={new Date()}
                                        defaultView="day"
                                        events={dailyEvents || []}
                                        onSelectSlot={updateDailyTimeSlots}
                                        onSelectEvent={updateDailyTimeSlots}
                                    />
                                </div>
                                <div className="w-full h-10 flex justify-between">
                                    <button
                                        className="w-[calc(50%-8px)] rounded-lg border border-lightgrey flex items-center justify-center"
                                        onClick={closeDailyTimeSlotsModal}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="w-[calc(50%-8px)] bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                        disabled={false}
                                        onClick={saveDailyTimeSLots}
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        </div> :
                        null
                }
            </div>
        </div>
    );
};

export default Availability;
