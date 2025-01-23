import React, { useState, useRef, useEffect } from "react";
import queryString from "query-string";
import Experts from "./experts";
import SelectDateTime from "../../selectDateTime";
import Payment from "../payment";
import { checkTitleNameInvalid, formatDateYYYY_MM_DD_h_m } from "../../../../actions/common";
import { Link, useLocation, useNavigate } from "react-router-dom";
import EventDetail from "../eventDetail";
import { useAppSelector } from "../../../../store";
import { getAvatarTitle } from "../../../../actions/common";
import {doAppendEvent, doUpdateEvent, getCustomerById, getExpertById, profileImageFetch} from "../../../../api/api";
import { useDispatch } from "react-redux";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Navigation } from "swiper";
import { SetLoadingStatus } from "../../../../actions/appActions";
import ShowFieldError from "../../../../components/ShowFieldError";
import { showAlert } from "../../../../actions/alertActions";

const Search = () => {
    const { auth: { userDetails } } = useAppSelector((state) => state);
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const swiperRef: any = useRef(null);
    const location = useLocation();

    const steps = [
        {
            label: 'Select an expert',
            optional: false
        },
        {
            label: 'Date and time',
            optional: false
        },
        {
            label: 'Pay for the event',
            optional: false
        }
    ]

    const [step, set_step] = useState(0)
    const [eventTitle, set_eventTitle] = useState('')
    const [selectedExpert, set_selectedExpert] = useState<any>()
    const [startTime, set_startTime] = useState(null)
    const [endTime, set_endTime] = useState(null)
    const [duration, set_duration] = useState(0)
    const [price, set_price] = useState(0)
    const [paidBy, set_paidBy] = useState('')
    const [newEvent, set_newEvent] = useState<any>()
    const [myEvents, set_myEvents] = useState<Array<any>>([])
    const [paymentFailed, set_paymentFailed] = useState(false)

    // Query params variables -----
    const [qExpertId, set_qExpertId] = useState<any>('')
    const [qDuration, set_qDuration] = useState<any>('')
    const [qStart, set_qStart] = useState<any>('')
    const [qEnd, set_qEnd] = useState<any>('')
    const [qEventId, set_qEventId] = useState<any>('')
    const [expertImage, set_expert_image] = useState<any>(null)

    const goToStep = (index: number) => {
        console.log(`Navigating to step: ${index}`);
        set_step(index)
        if (swiperRef.current && swiperRef.current.swiper) {
            console.log(`Calling Swiper.slideTo for step: ${index}`);
            swiperRef.current.swiper.slideTo(index);
        }
    }

    const fetchExpertProfile = async (expertId: string) => {
        console.log('Fetching profile for expertId:', expertId);
        try {
            const res = await profileImageFetch(expertId, "small")
            return res
        } catch (err) {
            console.log("error while fetching expert image", err)
            return null
        }
    }

    const selectExpert = (expert: any) => {
        console.log('Selected expert:', expert);
        if (expert) {
            set_eventTitle(`${userDetails?.username}, ${expert.username}`);
            set_startTime(null);
            set_endTime(null);
            set_duration(0);
            set_price(0);
            set_selectedExpert(expert);

            // Handle fetchExpertProfile asynchronously with .then()
            fetchExpertProfile(expert.image)
                .then((image) => {
                    set_expert_image(image);
                    console.log('Expert image fetched:', image);
                })
                .catch((error) => {
                    console.error('Error fetching expert image:', error);
                });

            goToStep(1);
        } else {
            dispatch(showAlert("Expert isn't available"));
            navigate(-1);
        }
    };


    const setStartEndTime = (start: any, end: any, duration: any) => {
        console.log('Setting start and end time:', { start, end, duration });
        set_startTime(start)
        set_endTime(end)
        set_duration(duration)
        set_price(duration * selectedExpert?.price / 60)
        goToStep(2)
    }

    const submit = async (details: any) => {
        console.log('Submitting event details:', details);
        set_paidBy('stripe')
        SetLoadingStatus(true)

        const response = await doAppendEvent(details)

        if (response) {
            console.log('Event successfully appended:', response);

            dispatch({
                type: 'updateUserDetails',
                payload: response.userDetails
            })

            console.log("response new event",response , response.newEventId)
            set_newEvent(response.newEventId)

            if (details.eventId) {
                goToStep(4)
            } else {
                goToStep(3)
            }
        }
        SetLoadingStatus(false)
    }

    const updateEventTitle = async () => {
        console.log('Updating event title:', eventTitle);
        SetLoadingStatus(true)
        console.log("new eventt data", newEvent)
        const response = await doUpdateEvent(newEvent, { title: eventTitle })
        SetLoadingStatus(false)
        if (response) {
            console.log('Event title updated successfully:', response);
            dispatch({
                type: 'updateUserDetails',
                payload: response.userDetails
            })
            goToStep(4)
        }
    }

    function checkStorageUsage() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += (localStorage[key].length + key.length) * 2; // Estimate size in bytes
            }
        }
        console.log('Approximate localStorage usage: ${total} bytes');
        return total;
    }


    useEffect(() => {
        console.log('Query params updated:', { qExpertId, qDuration, qStart, qEnd });
        console.log(selectedExpert, qDuration, qStart, qEnd, '=====')
        if (selectedExpert && qDuration && qStart && qEnd) {
            setStartEndTime(qStart, qEnd, qDuration)
        }
        console.log('User details:', userDetails);
    }, [selectedExpert, qDuration, qStart, qEnd])

    useEffect(() => {
        console.log('Effect triggered for userDetails:', userDetails);
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
            console.log('Mapped events:', temp);
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

    // useEffect(() => {
    //     console.log('Location search updated:', location.search);
    //     let { redirect_status, payment_intent, _id, _duration, _start, _end, _eventId } = queryString.parse(location.search);
    //     if (_id) {
    //         console.log('Query parameter _id detected:', _id);set_qExpertId(_id)
    //         set_qEventId(_eventId)
    //         if (_duration && _start && _end) {
    //             console.log('Setting query parameters for duration, start, end:', { _duration, _start, _end });
    //             set_qDuration(Number(_duration))
    //             set_qStart(new Date(Number(_start)))
    //             set_qEnd(new Date(Number(_end)))
    //         }
    //     } else {
    //         set_qExpertId('')
    //         if (redirect_status === 'succeeded') {
    //             const pendingDetails = window.localStorage.getItem('pendingDetails')
    //
    //             if (pendingDetails) {
    //                 checkStorageUsage();
    //                 console.log("pendingDetails: ", pendingDetails);
    //                 const details = JSON.parse(pendingDetails)
    //                 const {result} = await getExpertById(details.expert)
    //                 window.localStorage.removeItem('pendingDetails')
    //                 set_eventTitle(details.title)
    //                 set_selectedExpert(result)
    //                 set_startTime(details.start)
    //                 set_endTime(details.end)
    //                 set_duration(details.duration)
    //                 set_price(details.price)
    //                 set_qEventId(details.eventId)
    //                 submit({
    //                     title: details.title,
    //                     start: details.start,
    //                     end: details.end,
    //                     duration: details.duration,
    //                     price: details.price,
    //                     expert: result.email,
    //                     customer: details.customer.email,
    //                     payment_intent: payment_intent,
    //                     eventId: details.eventId,
    //                     createdBy:userDetails._id
    //                 })
    //             }
    //         } else {
    //             window.localStorage.removeItem('pendingDetails')
    //             if (redirect_status) {
    //                 set_paymentFailed(true)
    //             }
    //         }
    //     }
    // }, [location])
    useEffect(() => {
        const processQueryParameters = async () => {
            console.log('Location search updated:', location.search);
            const {
                redirect_status,
                payment_intent,
                _id,
                _duration,
                _start,
                _end,
                _eventId
            } = queryString.parse(location.search);

            if (_id) {
                console.log('Query parameter _id detected:', _id);
                set_qExpertId(_id);
                set_qEventId(_eventId);

                if (_duration && _start && _end) {
                    console.log('Setting query parameters for duration, start, end:', {
                        _duration,
                        _start,
                        _end
                    });
                    set_qDuration(Number(_duration));
                    set_qStart(new Date(Number(_start)));
                    set_qEnd(new Date(Number(_end)));
                }
            } else {
                set_qExpertId('');
                if (redirect_status === 'succeeded') {
                    const pendingDetails = window.localStorage.getItem('pendingDetails');
                    if (pendingDetails) {
                        try {
                            checkStorageUsage();
                            console.log("pendingDetails: ", pendingDetails);
                            const details = JSON.parse(pendingDetails);
                            const { result } = await getExpertById(details.expert);

                            window.localStorage.removeItem('pendingDetails');

                            set_eventTitle(details.title);
                            set_selectedExpert(result);
                            set_startTime(details.start);
                            set_endTime(details.end);
                            set_duration(details.duration);
                            set_price(details.price);
                            set_qEventId(details.eventId);

                            submit({
                                title: details.title,
                                start: details.start,
                                end: details.end,
                                duration: details.duration,
                                price: details.price,
                                expert: result.email,
                                customer: details.customer,
                                payment_intent: payment_intent,
                                eventId: details.eventId,
                                createdBy: userDetails._id
                            });
                        } catch (error) {
                            console.error("Error processing pending details:", error);
                        }
                    }
                } else {
                    window.localStorage.removeItem('pendingDetails');
                    if (redirect_status) {
                        set_paymentFailed(true);
                    }
                }
            }
        };

        processQueryParameters();
    }, [location]);

    return (
        !paymentFailed ?
            <>
                {
                    step === 3 ?
                        <div className="w-full h-full max-w-[400px] mx-auto flex flex-col justify-center items-center">
                            <div className="text-white text-2xl text-center">Please update the event title</div>
                            <input
                                className="mt-6 w-full rounded-[15px] h-[62px] bg-transparent border border-grey text-white text-[14px] leading-[21px] px-[24px]"
                                placeholder="Filter experts by text"
                                value={eventTitle}
                                onChange={(e) => set_eventTitle(e.target.value)}
                            />
                            <ShowFieldError
                                show={!eventTitle || checkTitleNameInvalid('Event title', eventTitle)}
                                label={checkTitleNameInvalid('Event title', eventTitle) ? checkTitleNameInvalid('Event title', eventTitle) : "Title is required"}
                            />
                            <div className="flex justify-center space-x-6">
                                <button
                                    className="mt-6 w-[200px] h-10 text-white border border-lightgrey rounded-lg flex items-center justify-center disabled:opacity-50"
                                    onClick={() => set_step(4)}
                                >
                                    Skip
                                </button>
                                <button
                                    className="mt-6 w-[200px] h-10 text-white bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
                                    disabled={!eventTitle || !!checkTitleNameInvalid('Event title', eventTitle)}
                                    onClick={updateEventTitle}
                                >
                                    Save
                                </button>
                            </div>
                        </div> :
                        paidBy ?
                            <div className="w-full h-full max-w-[400px] sm:max-w-[846px] mx-auto flex flex-col items-center justify-center space-y-8 text-lightgrey px-6">
                                <div className="text-2xl text-white text-center">Successfully booked with an expert.</div>
                                <EventDetail
                                    title={newEvent?.title}
                                    image={selectedExpert?.image}
                                    name={selectedExpert?.username}
                                    description={selectedExpert?.service}
                                    duration={duration}
                                    start={startTime}
                                    price={price}
                                    paidBy={paidBy}
                                    //expert={selectedExpert}
                                />
                                <Link
                                    to={`${process.env.REACT_APP_AUTH_URL}customerdashboard/calendar`}
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
                                                    <button
                                                        className={`w-[210px] h-[85px] py-2 px-3 rounded-xl flex flex-col justify-center space-y-1 border
                                            ${((index === 1 && !selectedExpert) || (index === 2 && !price)) ? 'pointer-events-none' : 'cursor-pointer hover:border-green'}
                                            ${((index === 0 && index <= step && selectedExpert) || (index === 1 && index <= step && price) || (index === 2 && index <= step && paidBy)) ? 'bg-green' : 'bg-darkgrey'}
                                            ${step >= index ? 'border-green' : 'border-darkgrey'} disabled:cursor-default disabled:opacity-50`}
                                                        disabled={(index === 0 && qExpertId) || (index === 1 && qStart && qEnd && qDuration)}
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
                                                            index === 0 && selectedExpert ?
                                                                <div className="flex space-x-2 items-center pl-8">
                                                                    <div className="w-10 h-10 rounded-full overflow-clip">
                                                                        {
                                                                            selectedExpert.image ?
                                                                                <img src={expertImage} className="w-full h-full object-cover object-center" /> :
                                                                                <div className="w-full h-full rounded-full border-2 border-lightgrey text-xl text-white font-bold !flex items-center justify-center">
                                                                                    {getAvatarTitle(selectedExpert.username)}
                                                                                </div>
                                                                        }
                                                                    </div>
                                                                    <div className="max-w-[150px]">
                                                                        <div className="text-base text-white font-bold truncate">{selectedExpert?.username}</div>
                                                                        <div className="text-base text-white truncate">{selectedExpert?.service}</div>
                                                                    </div>
                                                                </div> :
                                                                index === 1 && startTime && endTime ?
                                                                    <div className="text-base text-white pl-8">
                                                                        <span className="font-bold">{formatDateYYYY_MM_DD_h_m(startTime)}</span>
                                                                        <br />
                                                                        ( {duration} min )
                                                                    </div> :
                                                                    index === 2 && price ?
                                                                        <div className="text-base text-white pl-8">
                                                                            <span className="font-bold">${price}</span>
                                                                            <br />
                                                                            {paidBy ? `paid by ${paidBy}` : ''}
                                                                        </div> :
                                                                        null
                                                        }
                                                    </button>
                                                </SwiperSlide>
                                            ))
                                        }
                                    </Swiper>
                                </div>
                                <div className="w-full h-full overflow-y-auto">
                                    <div className="w-full h-full max-w-[846px] mx-auto px-6">
                                        {
                                            step === 0 ?
                                                <Experts
                                                    qExpertId={qExpertId}
                                                    selectedExpert={selectedExpert}
                                                    selectExpert={selectExpert}
                                                /> :
                                                step === 1 ?
                                                    <SelectDateTime
                                                        setStartEndTime={setStartEndTime}
                                                        selectedUser={selectedExpert}
                                                        myEvents={myEvents}
                                                        hideEvents={true}
                                                        //expert={selectedExpert}
                                                    /> :
                                                    <Payment
                                                        type="Session"
                                                        price={price}
                                                        pendingDetails={{
                                                            title: eventTitle,
                                                            start: startTime,
                                                            end: endTime,
                                                            duration: duration,
                                                            price: price,
                                                            expert: selectedExpert._id,
                                                            customer: userDetails.email,
                                                            eventId: qEventId
                                                        }}
                                                        //expert={selectedExpert}
                                                    />
                                        }
                                    </div>
                                </div>
                            </div>
                }
            </> :
            <div className="w-full h-full flex flex-col items-center justify-center">
                <div className="text-white text-2xl text-center"> Opps, something went wrong with the payment </div>
                <a href={window.location.href} className="text-lg mt-6 text-green">Refresh page</a>
            </div>
    );
};

export default Search;

