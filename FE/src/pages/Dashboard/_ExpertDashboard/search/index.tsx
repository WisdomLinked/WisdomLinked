import React, { useState, useRef, useEffect } from "react";
import queryString from "query-string";
import SelectDateTime from "../../selectDateTime";
import { checkTitleNameInvalid, formatDateYYYY_MM_DD_h_m } from "../../../../actions/common";
import { Link, useLocation, useNavigate } from "react-router-dom";
import EventDetail from "../eventDetail";
import { useAppSelector } from "../../../../store";
import { getAvatarTitle } from "../../../../actions/common";
import { createEvent } from "../../../../api/api";
import { useDispatch } from "react-redux";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Navigation } from "swiper";
import { SetLoadingStatus } from "../../../../actions/appActions";
import Customers from "./customers";
import ShowFieldError from "../../../../components/ShowFieldError";
import { showAlert } from "../../../../actions/alertActions";
import {isEmptyObject} from "jquery";

const Search = () => {
    const { auth: { userDetails } } = useAppSelector((state) => state);
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const swiperRef: any = useRef(null);
    let location = useLocation();

    const steps = [
        {
            label: 'Select an customer',
            optional: false
        },
        {
            label: 'Date and time',
            optional: false
        },
        {
            label: 'Set Price & Title',
            optional: false
        }
    ]

    const [step, set_step] = useState(0)
    const [eventTitle, set_eventTitle] = useState('')
    const [selectedCustomer, set_selectedCustomer] = useState<any>()
    const [startTime, set_startTime] = useState(null)
    const [endTime, set_endTime] = useState(null)
    const [duration, set_duration] = useState(0)
    const [price, set_price] = useState(0)
    const [myEvents, set_myEvents] = useState<Array<any>>([])
    const [qCustomerId, set_qCustomerId] = useState<any>('')

    const goToStep = (index: number) => {
        set_step(index)
        if (swiperRef.current && swiperRef.current.swiper) {
            swiperRef.current.swiper.slideTo(index);
        }
    }

    const selectCustomer = (customer: any) => {
        if (customer) {
            set_eventTitle(`${userDetails?.username}, ${customer.username}`)
            set_selectedCustomer(customer)
            set_startTime(null)
            set_endTime(null)
            set_duration(0)
            goToStep(1)
        } else {
            dispatch(showAlert("Customer isn't available"))
            navigate(-1)
        }
    }

    const setStartEndTime = (start: any, end: any, duration: any) => {
        set_startTime(start)
        set_endTime(end)
        set_duration(duration)
        goToStep(2)
    }

    const submit = async () => {
        SetLoadingStatus(true)
        const response = await createEvent({
            title: eventTitle,
            start: startTime,
            end: endTime,
            duration: duration,
            price: price,
            customer: selectedCustomer.email,
            expert: userDetails.email
        })
        if (response) {
            dispatch({
                type: 'updateUserDetails',
                payload: response.userDetails
            })
            set_step(3)
        }
        SetLoadingStatus(false)
    }

    useEffect(() => {
        if (userDetails.status === 'review') {
            dispatch(showAlert("This feature isn't available under review"))
            navigate(-1)
        }
        let temp = userDetails.events.map((event: any) => {
            return {
                ...event,
                id: event._id,
                start: new Date(event.start),
                end: new Date(event.end),
                type: 'event'
            }
        })
        userDetails.groupChats.map((seminar: any) => {
            temp.push({
                ...seminar,
                id: seminar._id,
                start: new Date(seminar.start),
                end: new Date(seminar.end),
                title: '(S)' + seminar.name,
                type: 'seminar'
            })
        })
        userDetails.pendingGroupChats.map((item: any) => {
            temp.push({
                ...item.groupChatId,
                id: item.groupChatId?._id,
                start: new Date(item.groupChatId?.start),
                end: new Date(item.groupChatId?.end),
                title: '(PS)' + item.groupChatId?.name,
                type: 'pending seminar'
            })
        })
        set_myEvents([...temp])
    }, [userDetails])

    useEffect(() => {
        let { _id } = queryString.parse(location.search);
        if (_id) {
            set_qCustomerId(_id)
        } else {
            set_qCustomerId('')
        }
    }, [location])

    return (
        <>
            {
                step === 3 ?
                    <div className="w-full h-full max-w-[400px] sm:max-w-[846px] mx-auto flex flex-col items-center justify-center space-y-8 text-lightgrey px-6">
                        <div className="text-2xl text-white text-center">Successfully booked with an customer.</div>
                        <EventDetail
                            title={eventTitle}
                            image={selectedCustomer?.image}
                            name={selectedCustomer?.username}
                            description={selectedCustomer?.service}
                            duration={duration}
                            start={startTime}
                            price={price}
                            paidBy={'Pending payment'}
                        />
                        <Link
                            to={`${process.env.REACT_APP_AUTH_URL}expertdashboard/calendar`}
                            className="w-[200px] h-10 bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                        >
                            Go to calendar
                        </Link>
                    </div> :
                    <div className="w-full h-full flex flex-col relative">
                        <div className="w-full py-4">
                            <Swiper
                                ref={swiperRef}
                                slidesPerView={"auto"}
                                navigation={true}
                                pagination={{
                                    clickable: true,
                                }}
                                modules={[Pagination, Navigation]}
                                className="max-w-fit mx-auto"
                            >
                                {
                                    steps.map((item, index) => (
                                        <SwiperSlide
                                            key={`step_${index}`}
                                            className="!w-fit px-3 sm:px-6"
                                        >
                                            <div
                                                className={`w-[210px] h-[85px] py-2 px-3 rounded-xl flex flex-col justify-center space-y-1 border 
                                            ${((index === 1 && !selectedCustomer)) ? 'pointer-events-none' : 'cursor-pointer hover:border-green'}
                                            ${((index === 0 && index <= step && selectedCustomer) || (index === 1 && index <= step) || (index === 2 && index <= step)) ? 'bg-green' : 'bg-darkgrey'}
                                            ${step >= index ? 'border-green' : 'border-darkgrey'}`}
                                                onClick={() => goToStep(index)}
                                            >
                                                <div
                                                    className={`w-fit flex space-x-2 justify-center items-center cursor-pointer`}
                                                >
                                                    <div className={`w-6 h-6 rounded-full text-sm font-bold flex justify-center items-center ${step >= index ? 'bg-white text-green' : 'bg-grey text-white'}`}>
                                                        {index + 1}
                                                    </div>
                                                    <div className={`text-center text-base font-bold ${step >= index ? 'text-white' : 'text-grey'}`}>
                                                        {item.label}
                                                    </div>
                                                </div>
                                                {
                                                    index === 0 && selectedCustomer ?
                                                        <div className="flex space-x-2 items-center pl-8">
                                                            <div className="w-10 h-10 rounded-full overflow-clip">
                                                                {
                                                                    selectedCustomer.image ?
                                                                        <img src={`${process.env.REACT_APP_SERVER_URL}/${selectedCustomer.image}`} className="w-full h-full object-cover object-center" /> :
                                                                        <div className="w-full h-full rounded-full border-2 border-lightgrey text-xl text-white font-bold !flex items-center justify-center">
                                                                            {getAvatarTitle(selectedCustomer.username)}
                                                                        </div>
                                                                }
                                                            </div>
                                                            <div className="max-w-[150px]">
                                                                <div className="text-base text-white font-bold truncate">{selectedCustomer?.username}</div>
                                                                <div className="text-base text-white truncate">{selectedCustomer?.service}</div>
                                                            </div>
                                                        </div> :
                                                        index === 1 ? (startTime && endTime ?
                                                            <div className="text-base text-white pl-8">
                                                                <span className="font-bold">{formatDateYYYY_MM_DD_h_m(startTime)}</span>
                                                                <br />
                                                                ( {duration} min )
                                                            </div> : <div className={`text-base pl-8 ${step >= index ? 'text-white' : 'text-grey'}`}>(Optional)</div>) :
                                                            index === 2 && step === 2 ?
                                                                <div className="text-base text-white pl-8">
                                                                    <s className="">${duration * userDetails.price / 60}</s>
                                                                    <br />
                                                                    <span className="font-bold">${price}</span>
                                                                </div> :
                                                                null
                                                }
                                            </div>
                                        </SwiperSlide>
                                    ))
                                }
                            </Swiper>
                        </div>
                        <div className="w-full h-full overflow-y-auto">
                            <div className="w-full h-full max-w-[846px] mx-auto px-6">
                                {
                                    step === 0 ?
                                        <Customers
                                            qCustomerId={qCustomerId}
                                            selectedCustomer={selectedCustomer}
                                            selectCustomer={selectCustomer}
                                        /> :
                                        step === 1 ?
                                            <SelectDateTime
                                                setStartEndTime={setStartEndTime}
                                                selectedUser={selectedCustomer}
                                                myEvents={myEvents}
                                                hideEvents={true}
                                            /> :
                                            <div className="max-w-[400px] mx-auto text-white">
                                                <div className="mt-10 text-white text-2xl text-center">Please update the title & price</div>
                                                <div className="mt-10 text-grey text-[12px] leading-[19px]">Title</div>
                                                <input
                                                    className="w-full rounded-[15px] h-[62px] bg-transparent border border-grey text-white text-[14px] leading-[21px] px-[24px]"
                                                    placeholder="Filter experts by text"
                                                    value={eventTitle}
                                                    onChange={(e) => set_eventTitle(e.target.value)}
                                                />
                                                <ShowFieldError
                                                    show={!eventTitle || checkTitleNameInvalid('Event title', eventTitle)}
                                                    label={checkTitleNameInvalid('Event title', eventTitle) ? checkTitleNameInvalid('Event title', eventTitle) : "Title is required"}
                                                />
                                                <div className="mt-10 text-grey text-[12px] leading-[19px]">Price (usd)</div>
                                                <input
                                                    className="w-full bg-transparent rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] px-[24px] border-lightgrey"
                                                    placeholder="usd/hour"
                                                    value={price}
                                                    type='number'
                                                    min={0}
                                                    onChange={(e) => set_price(parseInt(e.target.value))}
                                                />
                                                <ShowFieldError
                                                    show={isNaN(price)}
                                                    label="Price is required"
                                                />
                                                <button
                                                    className="mt-6 mx-auto w-fit py-2 px-6 bg-green rounded-lg flex items-center justify-center  disabled:opacity-50"
                                                    disabled={isNaN(price) || !eventTitle || !!checkTitleNameInvalid('Event title', eventTitle)}
                                                    onClick={submit}
                                                >
                                                    Submit
                                                </button>
                                            </div>
                                }
                            </div>
                        </div>
                    </div>
            }
        </>
    );
};

export default Search;
