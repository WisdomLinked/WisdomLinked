import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import logo from '../assets/images/logo.png';
import { useDispatch } from "react-redux";
import { validateEmail } from "../actions/common";
import { useAppSelector } from "../store";
import { makeAnOffsetToAvailableTimeSlots, checkTitleNameInvalid } from "../actions/common";
import MultiSelectionWithInputTag from "../components/MultiSelectionWithInputTag";
import SelectionWithCheckBox from "../components/SelectionWithCheckBox";
import ShowFieldError from "../components/ShowFieldError";
import { callApi, doGetKeywordsAndServices } from "../api/api";
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import { SetLoadingStatus } from "../actions/appActions";
import CountrySelect from "../components/CountrySelection";
import FileBrowser from "../components/fileBrowser";
import ConfirmEmail from "../components/ConfirmEmail";
import { showAlert } from "../actions/alertActions";

const ExpertRegister = () => {

    const navigate = useNavigate()
    const dispatch = useDispatch()
    const [keywords, set_keywords] = useState([])
    const [services, set_services] = useState([])
    const [name, set_name] = useState('')
    const [title, set_title] = useState('')
    const [description, set_description] = useState('')
    const [selectedKeywords, set_selectedKeywords] = useState<Array<any>>([])
    const [selectedServices, set_selectedServices] = useState<Array<any>>([])
    const [country, set_country] = useState<any>()
    const [state, set_state] = useState<any>()
    const [city, set_city] = useState<any>()
    const [stateAvailable, set_stateAvailable] = useState(false)
    const [cityAvailable, set_cityAvailable] = useState(false)
    const [phoneNumber, set_phoneNumber] = useState<any>('')
    const [email, set_email] = useState('')
    const [isValidEmail, set_isValidEmail] = useState(false)
    const [file, set_file] = useState('')
    const [fileError, set_fileError] = useState('')
    const [pwd, set_pwd] = useState('')
    const [confirmPwd, set_confirmPwd] = useState('')
    const [isValidConfirmPwd, set_isValidConfirmPwd] = useState(false)
    const [type, set_type] = useState('password')
    const [type1, set_type1] = useState('password')
    const [haveRead, set_haveRead] = useState(false)
    const [showError, set_showError] = useState(false)
    const [enableToRegister, set_enableToRegister] = useState(false)
    const [confirmEmailSent, set_confirmEmailSent] = useState(false)

    const { userDetails } = useAppSelector(state => state.auth)

    const register = async () => {
        if (!enableToRegister) {
            set_showError(true)
        } else {
            SetLoadingStatus(true)
            let slots = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35]
            const timezoneOffset = - new Date().getTimezoneOffset() / 30
            slots = makeAnOffsetToAvailableTimeSlots(slots, -timezoneOffset)
            const data = {
                role: 'expert',
                username: name,
                title,
                description: description,
                keywords: selectedKeywords,
                services: selectedServices.map((x: any) => x._id),
                state,
                country,
                city,
                phoneNumber,
                email,
                password: pwd,
                timeSlots: slots
            }
            console.log(data)
            const response = await callApi('POST', 'auth/register', data, file);
            console.log(response)
            if (response.status === 'SUCCESS') {
                console.log(response.confirmCode, '////')
                set_confirmEmailSent(true)
            } else {
                dispatch(showAlert(response.error))
            }
            SetLoadingStatus(false)
            SetLoadingStatus(false)
        }
    }

    const getKeywordsAndServices = async () => {
        const response: any = await doGetKeywordsAndServices();
        if (response) {
            set_keywords(response.keywords || [])
            set_services(response.services || [])
        }
    }

    useEffect(() => {
        if (
            name.length >= 3 && !checkTitleNameInvalid('Username', name) &&
            title.length &&
            description.length > 20 && description.length <= 100 &&
            selectedKeywords.length >= 3 &&
            selectedServices.length &&
            country &&
            (!stateAvailable || (stateAvailable && state)) &&
            (!cityAvailable || (cityAvailable && city)) &&
            !(phoneNumber.length < 8) &&
            isValidEmail &&
            pwd.length >= 6 &&
            isValidConfirmPwd &&
            haveRead &&
            (!fileError && file)
        ) {
            set_enableToRegister(true)
            set_showError(false)
        } else {
            set_enableToRegister(false)
        }
    }, [name, title, description, selectedKeywords, selectedServices, country, state, stateAvailable, city, cityAvailable, phoneNumber, isValidEmail, pwd, isValidConfirmPwd, file, fileError, haveRead])

    useEffect(() => {
        set_isValidEmail(!email ? true : validateEmail(email) ? true : false)
    }, [email])

    useEffect(() => {
        set_isValidConfirmPwd(!pwd && !confirmPwd ? true : pwd === confirmPwd ? true : false)
    }, [pwd, confirmPwd])

    // useEffect(() => {
    //     if (userDetails?.email) {
    //         localStorage.setItem("isLoginRemembered", 'true')
    //         navigate(import.meta.env.VITE_AUTH_URL + "expertdashboard")
    //         SetLoadingStatus(false)
    //     }
    // }, [userDetails, navigate])

    useEffect(() => {
        if (country) {
            set_phoneNumber(country.phonecode)
        } else {
            set_phoneNumber('')
        }
    }, [country])

    useEffect(() => {
        getKeywordsAndServices()
    }, [])

    return (
        confirmEmailSent ?
            <ConfirmEmail email={email} /> :
            <div className="w-full h-screen overflow-y-auto flex flex-col lg:flex-row text-darkgrey">
                <div className="flex flex-col w-full pt-12 px-8 pb-[118px] lg:w-[50%] lg:h-full lg:px-[60px] lg:py-0 lg:justify-center bg-black ">
                    <Link to='/' className={`w-fit flex items-center space-x-[2px] text-white font-black text-4xl`}>
                        <img src={logo} className="w-10 h-10" />
                        <span>OE</span>
                    </Link>
                    <div className="mt-10 text-[32px] leading-[150%] lg:text-[56px] lg:leading-[84px] font-bold gradient_text">Talk with experts</div>
                    <div className="text-white text-[32px] leading-[150%] lg:text-[56px] lg:leading-[84px] font-bold">about study, research and jobs overseas</div>
                    <div className="text-lightgrey mt-6 text-[14px] leading-[21px]">Top notch professors, scientists, senior engineers, and managers from all over the world are at finer tips for advice</div>
                </div>
                <div className="w-full bg-white lg:w-[50%] lg:max-h-full lg:overflow-y-auto pt-[64px] px-[56px] pb-[52px] lg:py-10 relative flex">
                    <div className="w-full h-fit max-w-[416px] m-auto flex flex-col">
                        <button
                            className="w-6 h-6"
                            onClick={() => navigate(-1)}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9.57 5.92993L3.5 11.9999L9.57 18.0699" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M20.5 12H3.67004" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <div className="text-[24px] text-center leading-[36px] lg:text-[32px] lg:leading-[48px] font-bold text-typo-title mt-6">
                            Let's get registered as <br />Expert Consultant
                        </div>

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Full name *</div>
                        <input
                            className="w-full rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] px-[24px] border-lightgrey"
                            placeholder="Input your name"
                            value={name}
                            onChange={(e) => set_name(e.target.value)}
                        />
                        <ShowFieldError
                            show={!(name.length >= 3 && !checkTitleNameInvalid('Username', name)) && showError}
                            label={checkTitleNameInvalid('Username', name) ? checkTitleNameInvalid('Username', name) : "Name must be longer than 3 characters."}
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Title *</div>
                        <input
                            className="w-full rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] px-[24px] border-lightgrey"
                            placeholder="Input your name"
                            value={title}
                            onChange={(e) => set_title(e.target.value)}
                        />
                        <ShowFieldError
                            show={!title.length && showError}
                            label="Title is required."
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Short bio *</div>
                        <textarea
                            className="w-full rounded-[15px] h-[100px] mt-0.5 border text-[14px] leading-[21px] px-[24px] py-4 border-lightgrey"
                            placeholder="Describe yourself with few words"
                            value={description}
                            onChange={(e) => set_description(e.target.value)}
                        />
                        <ShowFieldError
                            show={!(description.length > 20 && description.length <= 100) && showError}
                            label="Bio should include 20 ~ 100 characters."
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Majors *</div>
                        <MultiSelectionWithInputTag
                            options={keywords}
                            selectedOptions={selectedKeywords}
                            set_selectedOptions={set_selectedKeywords}
                            placeholder="Input or select majors"
                        />
                        <ShowFieldError
                            show={!(selectedKeywords.length >= 3) && showError}
                            label="You have to add at least 3 keywords"
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Services *</div>
                        <SelectionWithCheckBox
                            options={services}
                            set_selectedOptions={set_selectedServices}
                            placeholder="Select services"
                            isMulti={true}
                        />
                        <ShowFieldError
                            show={!selectedServices.length && showError}
                            label="You have to select at least one service"
                        />

                        <CountrySelect
                            selectedCountry={country}
                            set_selectedCountry={set_country}
                            selectedState={state}
                            set_selectedState={set_state}
                            selectedCity={city}
                            set_selectedCity={set_city}
                            stateAvailable={stateAvailable}
                            set_stateAvailable={set_stateAvailable}
                            cityAvailable={cityAvailable}
                            set_cityAvailable={set_cityAvailable}
                            showError={showError}
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Phone number *</div>
                        <PhoneInput
                            placeholder="Enter phone number"
                            value={phoneNumber}
                            onChange={(data) => set_phoneNumber(data)}
                        />
                        <ShowFieldError
                            show={phoneNumber.length < 8 && showError}
                            label="You have to provide your phone number"
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Email *</div>
                        <input
                            className="w-full rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] px-[24px] border-lightgrey"
                            placeholder="Input your email address"
                            type='email'
                            value={email}
                            onChange={(e) => set_email(e.target.value)}
                        />
                        <ShowFieldError
                            show={!isValidEmail}
                            label="Invalid email address."
                        />

                        <div className="mt-6 w-full relative">
                            <div className="text-grey text-[12px] leading-[19px]">Password *</div>
                            <input
                                className="w-full rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] pl-[24px] pr-[58px] border-lightgrey"
                                placeholder="Input your password"
                                type={type}
                                value={pwd}
                                onChange={(e) => set_pwd(e.target.value)}
                            />
                            <button className="absolute bottom-[13px] right-[24px] w-6 h-6" onMouseDown={() => set_type('')} onMouseUp={() => set_type('password')} onMouseLeave={() => set_type('password')}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M14.5299 9.46992L9.46992 14.5299C8.81992 13.8799 8.41992 12.9899 8.41992 11.9999C8.41992 10.0199 10.0199 8.41992 11.9999 8.41992C12.9899 8.41992 13.8799 8.81992 14.5299 9.46992Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M17.8198 5.76998C16.0698 4.44998 14.0698 3.72998 11.9998 3.72998C8.46984 3.72998 5.17984 5.80998 2.88984 9.40998C1.98984 10.82 1.98984 13.19 2.88984 14.6C3.67984 15.84 4.59984 16.91 5.59984 17.77" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M8.41992 19.5299C9.55992 20.0099 10.7699 20.2699 11.9999 20.2699C15.5299 20.2699 18.8199 18.1899 21.1099 14.5899C22.0099 13.1799 22.0099 10.8099 21.1099 9.39993C20.7799 8.87993 20.4199 8.38993 20.0499 7.92993" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M15.5095 12.7C15.2495 14.11 14.0995 15.26 12.6895 15.52" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M9.47 14.53L2 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M21.9993 2L14.5293 9.47" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>
                        <ShowFieldError
                            show={!(pwd.length >= 6 || !pwd)}
                            label="Password must be longer than 6 characters."
                        />

                        <div className="mt-6 w-full relative">
                            <div className="text-grey text-[12px] leading-[19px]">Repeat Password *</div>
                            <input
                                className="w-full rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] pl-[24px] pr-[58px] border-lightgrey"
                                placeholder="Confirm your password"
                                type={type1}
                                value={confirmPwd}
                                onChange={(e) => set_confirmPwd(e.target.value)}
                            />
                            <button className="absolute bottom-[13px] right-[24px] w-6 h-6" onMouseDown={() => set_type1('')} onMouseUp={() => set_type1('password')} onMouseLeave={() => set_type('password')}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M14.5299 9.46992L9.46992 14.5299C8.81992 13.8799 8.41992 12.9899 8.41992 11.9999C8.41992 10.0199 10.0199 8.41992 11.9999 8.41992C12.9899 8.41992 13.8799 8.81992 14.5299 9.46992Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M17.8198 5.76998C16.0698 4.44998 14.0698 3.72998 11.9998 3.72998C8.46984 3.72998 5.17984 5.80998 2.88984 9.40998C1.98984 10.82 1.98984 13.19 2.88984 14.6C3.67984 15.84 4.59984 16.91 5.59984 17.77" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M8.41992 19.5299C9.55992 20.0099 10.7699 20.2699 11.9999 20.2699C15.5299 20.2699 18.8199 18.1899 21.1099 14.5899C22.0099 13.1799 22.0099 10.8099 21.1099 9.39993C20.7799 8.87993 20.4199 8.38993 20.0499 7.92993" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M15.5095 12.7C15.2495 14.11 14.0995 15.26 12.6895 15.52" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M9.47 14.53L2 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M21.9993 2L14.5293 9.47" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>
                        <ShowFieldError
                            show={!isValidConfirmPwd}
                            label="Invalid confirm password."
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Upload resume *</div>
                        <FileBrowser
                            file={file}
                            set_file={set_file}
                            set_fileError={set_fileError}
                        />
                        <ShowFieldError show={fileError || (!file && showError)} label={file ? fileError : 'Resume is required.'} />

                        <div className="flex items-center space-x-2 mt-6">
                            <button
                                className={`w-3 h-3 lg:w-4 lg:h-4 rounded-[4px] ${haveRead ? 'text-green' : 'border border-green'}`}
                                onClick={() => set_haveRead(!haveRead)}
                            >
                                <svg className="w-[14px] h-[14px] lg:w-[18px] lg:h-[18px] -mt-[1px] -ml-[1px]" style={{ display: haveRead ? 'block' : 'none' }} viewBox="0 0 12 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8.44352 0.666748H3.55518C1.43185 0.666748 0.166016 1.93258 0.166016 4.05591V8.93841C0.166016 11.0676 1.43185 12.3334 3.55518 12.3334H8.43768C10.561 12.3334 11.8268 11.0676 11.8268 8.94425V4.05591C11.8327 1.93258 10.5668 0.666748 8.44352 0.666748ZM8.78768 5.15841L5.48018 8.46591C5.39852 8.54758 5.28768 8.59425 5.17102 8.59425C5.05435 8.59425 4.94352 8.54758 4.86185 8.46591L3.21102 6.81508C3.04185 6.64591 3.04185 6.36591 3.21102 6.19675C3.38018 6.02758 3.66018 6.02758 3.82935 6.19675L5.17102 7.53841L8.16935 4.54008C8.33852 4.37091 8.61852 4.37091 8.78768 4.54008C8.95685 4.70925 8.95685 4.98341 8.78768 5.15841Z" fill="currentColor" />
                                </svg>
                            </button>
                            <div className="text-[14px] leading-[21px] lg:text-[16px] lg:leading-[24px] font-semibold">
                                I've agreed with the &nbsp;
                                <a href={`${import.meta.env.VITE_BASE_URL}rules`} className="text-green underline" target="_blank">
                                    Terms & Policy
                                </a>
                            </div>
                        </div>
                        <ShowFieldError
                            show={!haveRead && showError}
                            label="You have to read the rules."
                        />

                        <button
                            className="mt-6 w-full rounded-[14px] h-12 flex items-center justify-center bg-green text-white text-[16px] leading-[24px] disabled:opacity-50"
                            disabled={showError}
                            onClick={register}
                        >
                            Register
                        </button>

                        <div className="w-full mt-6 flex justify-center space-x-1 items-center">
                            <div className="text-grey text-[14px] leading-[21px] lg:text-[16px] lg:leading-[24px] font-semibold">Already have an account? </div>
                            <Link to='/login' className="text-green text-[14px] leading-[21px] lg:text-[16px] lg:leading-[24px] font-semibold">Login Here</Link>
                        </div>

                        {/* <div className="w-full mt-20 flex flex-col space-y-3 items-center text-[12px] leading-[16px] lg:text-[14px] lg:leading-[21px] lg:absolute lg:bottom-[53px] lg:left-0 lg:flex-row lg:justify-center lg:space-x-3 lg:space-y-0">
                        <div className="text-center text-grey">©2023 TOE LTD. All rights reserved</div>
                        <div className=" w-fit flex justify-center items-center space-x-3">
                            <Link to='/term' className="text-green">Term & Condition</Link>
                            <div className="w-[1px] h-3 bg-midgrey" />
                            <Link to='/privacy' className="text-green">Privacy & Policy</Link>
                        </div>
                    </div> */}
                    </div>
                </div>
            </div>
    )
}

export default ExpertRegister;