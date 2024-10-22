import React, { useState, useRef, useEffect } from "react";
import queryString from "query-string";
import { useLocation, useNavigate } from "react-router-dom";
import FilterSeminars from "./filterSeminars";
import Payment from "../payment";
import { Link } from "react-router-dom";
import { useAppSelector } from "../../../../store";
import { addMemberToPendingGroup } from "../../../../api/api";
import { useDispatch } from "react-redux";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Navigation } from "swiper";
import { SetLoadingStatus } from "../../../../actions/appActions";
import { showAlert } from "../../../../actions/alertActions";

const Seminars = () => {
    const { auth: { userDetails } } = useAppSelector((state) => state);
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const swiperRef: any = useRef(null);
    let location = useLocation();

    const steps = [
        {
            label: 'Select a seminar',
            optional: false
        },
        {
            label: 'Pay for the time',
            optional: false
        }
    ]

    const [step, set_step] = useState(0)
    const [selectedSeminar, set_selectedSeminar] = useState<any>(null)
    const [paidBy, set_paidBy] = useState('')
    const [myEvents, set_myEvents] = useState<Array<any>>([])
    const [paymentFailed, set_paymentFailed] = useState(false)

    const goToStep = (index: number) => {
        set_step(index)
        if (swiperRef.current && swiperRef.current.swiper) {
            swiperRef.current.swiper.slideTo(index);
        }
    }

    const selectSeminar = (seminar: any) => {
        set_selectedSeminar(seminar)
        goToStep(1)
    }

    const submit = async (details: any) => {
        set_paidBy('stripe')
        SetLoadingStatus(true)
        const response = await addMemberToPendingGroup(details);
        console.log(response.pendingGroupChats, '//////')
        if (response) {
            dispatch({
                type: 'updateUserDetails',
                payload: {
                    pendingGroupChats: response.pendingGroupChats
                }
            })
            set_step(2)
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
        let { redirect_status, payment_intent, price } = queryString.parse(location.search);
        if (redirect_status === 'succeeded') {
            const pendingDetails = window.localStorage.getItem('pendingDetails')
            if (pendingDetails) {
                SetLoadingStatus(true)
                const details = JSON.parse(pendingDetails)
                window.localStorage.removeItem('pendingDetails')
                submit({ ...details, payment_intent, price })
            }
        } else {
            window.localStorage.removeItem('pendingDetails')
            if (redirect_status) {
                set_paymentFailed(true)
            }
        }
    }, [])

    return (
        !paymentFailed ?
            <>
                {
                    step === 2 ?
                        <div className="w-full h-full max-w-[400px] sm:max-w-[846px] mx-auto flex flex-col items-center justify-center space-y-8 text-lightgrey px-6">
                            <div className="text-2xl text-white text-center">Successfully joined to the seminar.</div>
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
                                                <div
                                                    className={`w-[210px] h-[85px] py-2 px-3 rounded-xl flex flex-col justify-center space-y-1 border cursor-pointer hover:border-green
                                        ${(index === 1 && !selectedSeminar) ? 'pointer-events-none' : 'cursor-pointer hover:border-green'}
                                        ${(index === 0 && index <= step && selectedSeminar) ? 'bg-green' : 'bg-darkgrey'}
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
                                                        index === 0 && selectedSeminar ?
                                                            <div className="pl-8">
                                                                <div className="text-base text-white font-bold truncate">{selectedSeminar?.name}</div>
                                                                <div className="text-base text-white truncate">{selectedSeminar?.description}</div>
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
                                            <FilterSeminars
                                                selectedExpert={selectedSeminar}
                                                selectSeminar={selectSeminar}
                                                myEvents={myEvents}
                                            /> :
                                            step === 1 ?
                                                <Payment
                                                    type="Seminar"
                                                    price={selectedSeminar?.price}
                                                    pendingDetails={{
                                                        friendIds: [userDetails._id],
                                                        groupChatId: selectedSeminar?._id as string,
                                                        price: selectedSeminar?.price
                                                    }}
                                                /> :
                                                null
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

export default Seminars;
