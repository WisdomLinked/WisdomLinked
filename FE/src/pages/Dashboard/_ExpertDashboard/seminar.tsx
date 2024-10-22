import React, { useState, useRef, useEffect } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Navigation } from "swiper";
import { arraysEqual, checkTitleNameInvalid, formatDateYYYY_MM_DD_h_m } from "../../../actions/common";
import SelectDateTime from "../selectDateTime";
import { useAppSelector } from "../../../store";
import ShowFieldError from "../../../components/ShowFieldError";
import SelectionWithCheckBox from "../../../components/SelectionWithCheckBox";
import { Link, useNavigate } from "react-router-dom";
import { createGroupChat, updateGroupChat } from "../../../api/api";
import { useDispatch } from "react-redux";
import { SetLoadingStatus } from "../../../actions/appActions";
import { showAlert } from "../../../actions/alertActions";

const ExpertSeminar = ({
    selectedSeminar
}: any) => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { auth: { userDetails } } = useAppSelector((state) => state)
    const swiperRef: any = useRef(null);
    const steps = [
        {
            label: 'Add details',
            optional: false
        },
        {
            label: 'Date and time',
            optional: false
        },
        {
            label: 'Set price',
            optional: false
        }
    ]
    const [step, set_step] = useState(0)
    const [title, set_title] = useState("")
    const [description, set_description] = useState("")
    const [keywords, set_keywords] = useState([])
    const [services, set_services] = useState([])
    const [selectedKeywords, set_selectedKeywords] = useState<Array<any>>([])
    const [selectedServices, set_selectedServices] = useState<Array<any>>([])
    const [startTime, set_startTime] = useState(null)
    const [endTime, set_endTime] = useState(null)
    const [duration, set_duration] = useState(0)
    const [price, set_price] = useState(0)
    const [showError, set_showError] = useState(false)
    const [enableToGoNext, set_enableToGoNext] = useState(false)

    const setStartEndTime = (start: any, end: any, duration: any) => {
        set_startTime(start)
        set_endTime(end)
        set_duration(duration)
        goToStep(2)
    }

    const goToStep = (index: number) => {
        if (index === 1 && !enableToGoNext) {
            set_showError(true)
        } else {
            set_step(index)
            if (swiperRef.current && swiperRef.current.swiper) {
                swiperRef.current.swiper.slideTo(index);
            }
        }
    }

    const clear = () => {
        set_title("")
        set_description("")
        set_selectedKeywords([])
        set_selectedServices([])
    }

    const submit = async () => {
        SetLoadingStatus(true)
        if (selectedSeminar) {
            const response = await updateGroupChat({
                groupId: selectedSeminar.groupId,
                name: title,
                description,
                services: selectedServices,
                keywords: selectedKeywords,
                start: startTime,
                end: endTime,
                duration: duration,
                price: price,
            })
            if (response) {
                dispatch({
                    type: 'updateUserDetails',
                    payload: {
                        groupChats: response.result.groupChats
                    }
                })
            }
        } else {
            const response = await createGroupChat({
                name: title,
                description,
                services: selectedServices,
                keywords: selectedKeywords,
                start: startTime,
                end: endTime,
                duration: duration,
                price: price,
            })
            if (response) {
                set_step(3)
            }
        }
        SetLoadingStatus(false)
    }

    useEffect(() => {
        if (
            title.length &&
            description.length &&
            selectedKeywords.length &&
            selectedServices.length &&
            (
                title !== userDetails.title ||
                description !== userDetails.description ||
                !arraysEqual(selectedKeywords, userDetails.keywords || []) ||
                !arraysEqual(selectedServices, userDetails.services || [])
            )
        ) {
            set_enableToGoNext(true)
            set_showError(false)
        } else {
            set_enableToGoNext(false)
        }
    }, [title, description, selectedKeywords, selectedServices])

    useEffect(() => {
        if (userDetails.status === 'review') {
            dispatch(showAlert("This feature isn't available under review"))
            navigate(-1)
        }
        if (userDetails?.email) {
            set_keywords(userDetails.keywords)
            set_services(userDetails.services)
        }
    }, [userDetails])

    useEffect(() => {
        if (selectedSeminar) {
            console.log(selectedSeminar, '////////')
            set_title(selectedSeminar.groupName)
            set_description(selectedSeminar.description)
            set_selectedKeywords(selectedSeminar.keywords)
            set_selectedServices(selectedSeminar.services)
            set_startTime(selectedSeminar.start)
            set_endTime(selectedSeminar.end)
            set_duration(selectedSeminar.duration)
            set_price(selectedSeminar.price)
        }
    }, [selectedSeminar])

    return (
        step === 3 ?
            <div className="w-full h-full flex flex-col justify-center items-center">
                <div className="text-center text-white text-2xl">Successfully created a new seminar</div>
                <Link
                    to={`${process.env.REACT_APP_AUTH_URL}expertdashboard/calendar`}
                    className="w-[200px] mt-6 h-10 bg-green text-white rounded-lg flex items-center justify-center"
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
                                    ${(index === 1 && !enableToGoNext) ?
                                                'pointer-events-none' :
                                                (index === 2 && (!startTime || !endTime || !duration || !enableToGoNext)) ?
                                                    'pointer-events-none' :
                                                    'cursor-pointer'
                                            }
                                    ${step > index ? 'bg-green' : 'bg-darkgrey'}
                                    ${step === index ? 'border-green' : 'border-darkgrey'}`}
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
                                            index === 0 && enableToGoNext ?
                                                <div className="flex space-x-2 items-center pl-8">
                                                    <div className="max-w-[150px]">
                                                        <div className="text-base text-white font-bold truncate">{title}</div>
                                                        <div className="text-base text-white truncate">{description}</div>
                                                    </div>
                                                </div> :
                                                index === 1 && startTime && endTime && duration ?
                                                    <div className="text-base text-white pl-8">
                                                        <span className="font-bold">{formatDateYYYY_MM_DD_h_m(startTime)}</span>
                                                        <br />
                                                        ( {duration} min )
                                                    </div> :
                                                    index === 2 && step == 2 ?
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
                    <div className="w-full h-full px-6">
                        {
                            step === 0 ?
                                <div className="w-full max-w-[400px] mx-auto text-white">
                                    <div className="mt-6 text-grey text-[12px] leading-[19px]">Title *</div>
                                    <input
                                        className="w-full bg-transparent rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] px-[24px] border-lightgrey"
                                        placeholder="Input a name for your event"
                                        value={title}
                                        onChange={(e) => set_title(e.target.value)}
                                    />
                                    <ShowFieldError
                                        show={(!title.length || checkTitleNameInvalid('Event title', title)) && showError}
                                        label={checkTitleNameInvalid('Event title', title) ? checkTitleNameInvalid('Event title', title) : "Title is required"}
                                    />

                                    <div className="mt-6 text-grey text-[12px] leading-[19px]">Short description</div>
                                    <textarea
                                        className="w-full bg-transparent rounded-[15px] h-[100px] mt-0.5 border text-[14px] leading-[21px] px-[24px] py-4 border-lightgrey"
                                        placeholder="Describe about your event."
                                        value={description}
                                        onChange={(e) => set_description(e.target.value)}
                                    />
                                    <ShowFieldError
                                        show={!description.length && showError}
                                        label="Description is required."
                                    />

                                    <div className="mt-6 text-grey text-[12px] leading-[19px]">Majors *</div>
                                    <SelectionWithCheckBox
                                        options={keywords}
                                        selectedOptions={selectedKeywords}
                                        set_selectedOptions={set_selectedKeywords}
                                        isMulti={true}
                                        placeholder="Select majors"
                                    />
                                    <ShowFieldError
                                        show={!selectedKeywords.length && showError}
                                        label="Major is required"
                                    />

                                    <div className="mt-6 text-grey text-[12px] leading-[19px]">Services *</div>
                                    <SelectionWithCheckBox
                                        options={services}
                                        selectedOptions={selectedServices}
                                        set_selectedOptions={set_selectedServices}
                                        placeholder="Select services"
                                        isMulti={true}
                                    />
                                    <ShowFieldError
                                        show={!selectedServices.length && showError}
                                        label="Service is required"
                                    />
                                    <div className="w-full h-10 flex justify-between mt-14 text-lightgrey">
                                        <button
                                            className="w-[calc(50%-8px)] rounded-lg border border-lightgrey flex items-center justify-center"
                                            onClick={clear}
                                        >
                                            Clear
                                        </button>
                                        <button
                                            className="w-[calc(50%-8px)] bg-green rounded-lg flex items-center justify-center  disabled:opacity-50"
                                            disabled={showError}
                                            onClick={() => goToStep(1)}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div> :
                                step === 1 ?
                                    <SelectDateTime
                                        hideEvents={true}
                                        setStartEndTime={setStartEndTime}
                                        selectedUser={userDetails}
                                        hidePriceInDurationSelection={true}
                                    /> :
                                    <div className="max-w-[400px] mx-auto text-white">
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
                                            show={!price}
                                            label="Price is required"
                                        />
                                        <button
                                            className="mt-6 mx-auto w-fit py-2 px-6 bg-green rounded-lg flex items-center justify-center  disabled:opacity-50"
                                            disabled={!price}
                                            onClick={submit}
                                        >
                                            {selectedSeminar ? 'Submit' : 'Save'}
                                        </button>
                                    </div>
                        }
                    </div>
                </div>
                {
                    selectedSeminar && step < 2 ?
                        <div className="flex justify-center mt-2">
                            <button
                                className="mx-auto w-fit py-2 px-6 bg-green rounded-lg flex items-center justify-center  disabled:opacity-50"
                                disabled={!price || !enableToGoNext}
                                onClick={submit}
                            >
                                Save
                            </button>
                        </div> :
                        null
                }
            </div>
    );
};

export default ExpertSeminar;
