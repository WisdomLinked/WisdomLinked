import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import logo from '../assets/images/logo.png';
import { useDispatch } from "react-redux";
import { checkTitleNameInvalid, validateEmail } from "../actions/common";
import { useAppSelector } from "../store";
import { callApi, doGetKeywordsAndServices } from "../api/api";
import ShowFieldError from "../components/ShowFieldError";
import MultiSelectionWithInputTag from "../components/MultiSelectionWithInputTag";
import SelectionWithCheckBox from "../components/SelectionWithCheckBox";
import { SetLoadingStatus } from "../actions/appActions";
import CountrySelect from "../components/CountrySelection";
import PhoneInput from "react-phone-input-2";
import ConfirmEmail from "../components/ConfirmEmail";
import { showAlert } from "../actions/alertActions";

const CustomerRegister = () => {

    const navigate = useNavigate()
    const dispatch = useDispatch()
    const [keywords, set_keywords] = useState([])
    const [services, set_services] = useState([])
    const [name, set_name] = useState('')
    const [selectedKeywords, set_selectedKeywords] = useState<Array<any>>([])
    const [selectedServices, set_selectedServices] = useState<Array<any>>([])
    const [country, set_country] = useState<any>()
    const [state, set_state] = useState<any>()
    const [city, set_city] = useState<any>()
    const [stateAvailable, set_stateAvailable] = useState(false)
    const [cityAvailable, set_cityAvailable] = useState(false)
    const [phoneNumber, set_phoneNumber] = useState<any>('')
    const [email, set_email] = useState('')
    const [pwd, set_pwd] = useState('')
    const [confirmPwd, set_confirmPwd] = useState('')
    const isValidEmail = email ? (validateEmail(email) ? true : false) : false;
    const isValidConfirmPwd = pwd && confirmPwd ? pwd === confirmPwd : false;
    const [emailTouched, setEmailTouched] = useState(false)
    const [pwdTouched, setpwdTouched] = useState(false)
    const [confirmPwdTouched, setConfirmPwdTouched] = useState(false)
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
            const data = {
                role: 'customer',
                username: name,
                keywords: selectedKeywords,
                services: selectedServices.map((x: any) => x._id),
                state,
                country,
                city,
                phoneNumber,
                email,
                password: pwd
            }
            const response = await callApi('POST', 'auth/register', data);
            console.log(response)
            if (response.status === 'SUCCESS') {
                console.log(response.confirmCode, '////')
                set_confirmEmailSent(true)
            } else {
                dispatch(showAlert(response.error))
            }
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

    // Removed asynchronous email and password validation hooks as they caused the form to be permanently invalid on autofill.

    // useEffect(() => {
    //     if (userDetails?.email) {
    //         localStorage.setItem("isLoginRemembered", 'true')
    //         navigate(process.env.REACT_APP_AUTH_URL + "customerdashboard")
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
        const isNameValid = name.length >= 3 && !checkTitleNameInvalid('Username', name);
        const isCountryValid = !!country;
        const isStateValid = !!(!stateAvailable || (stateAvailable && state));
        const isCityValid = !!(!cityAvailable || (cityAvailable && city));
        const isPhoneValid = !(phoneNumber?.length < 8);
        const isEmailValid = isValidEmail;
        const isPwdValid = pwd?.length >= 6;
        const isConfirmPwdValid = isValidConfirmPwd;
        const isHaveReadValid = haveRead;

        const isValid = isNameValid && isCountryValid && isStateValid && isCityValid && isPhoneValid && isEmailValid && isPwdValid && isConfirmPwdValid && isHaveReadValid;

        if (isValid) {
            set_enableToRegister(true)
            set_showError(false)
        } else {
            set_enableToRegister(false)
        }
    }, [name, country, state, stateAvailable, city, cityAvailable, phoneNumber, isValidEmail, pwd, isValidConfirmPwd, haveRead])

    useEffect(() => {
        getKeywordsAndServices()
    }, [])

    return (
        confirmEmailSent ?
            <ConfirmEmail email={email} /> :
            <div className="w-full h-screen overflow-y-auto flex flex-col lg:flex-row">
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
                            className="w-6 h-6 text-darkgrey"
                            onClick={() => navigate(-1)}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9.57 5.92993L3.5 11.9999L9.57 18.0699" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M20.5 12H3.67004" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <div className="text-[24px] text-center leading-[36px] lg:text-[32px] lg:leading-[48px] font-bold text-typo-title mt-6">
                            Let's get registered as Customer
                        </div>

                        <div className="mt-8 text-grey text-[12px] leading-[19px]">Full name *</div>
                        <input
                            className="w-full rounded-[15px] h-[62px] mt-0.5 border text-darkgrey text-[14px] leading-[21px] px-[24px] border-lightgrey"
                            placeholder="Input your name"
                            value={name}
                            onChange={(e) => {
                                set_name(e.target.value)
                            }}
                        />
                        <ShowFieldError
                            show={!(name.length >= 3 && !checkTitleNameInvalid('Username', name)) && showError}
                            label={checkTitleNameInvalid('Username', name) ? checkTitleNameInvalid('Username', name) : "Name must be longer than 3 characters."}
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Majors</div>
                        <MultiSelectionWithInputTag
                            options={keywords}
                            selectedOptions={selectedKeywords}
                            set_selectedOptions={set_selectedKeywords}
                            placeholder="Input or select majors"
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Services</div>
                        <SelectionWithCheckBox
                            options={services}
                            set_selectedOptions={set_selectedServices}
                            placeholder="Select services"
                            isMulti={true}
                        />

                        <CountrySelect
                            selectedCountry={country}
                            set_selectedCountry={set_country}
                            selectedState={state}
                            set_selectedState={set_state}
                            selectedCity={city}
                            set_selectedCity={set_city}
                            showError={showError}
                            stateAvailable={stateAvailable}
                            set_stateAvailable={set_stateAvailable}
                            cityAvailable={cityAvailable}
                            set_cityAvailable={set_cityAvailable}
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

                        <div className="mt-8 text-grey text-[12px] leading-[19px]">Email *</div>
                        <input
                            className="w-full rounded-[15px] h-[62px] mt-0.5 border text-darkgrey text-[14px] leading-[21px] px-[24px] border-lightgrey"
                            placeholder="Input your email address"
                            type='email'
                            value={email}
                            onChange={(e) => set_email(e.target.value)}
                            onBlur={() => setEmailTouched(true)}
                        />
                        <ShowFieldError
                            show={(emailTouched || showError) && !isValidEmail}
                            label="Invalid email address."
                        />

                        <div className="mt-8 w-full relative">
                            <div className="text-grey text-[12px] leading-[19px]">Password *</div>
                            <input
                                className="w-full rounded-[15px] h-[62px] mt-0.5 border text-darkgrey text-[14px] leading-[21px] pl-[24px] pr-[58px] border-lightgrey"
                                placeholder="Input your password"
                                type={type}
                                value={pwd}
                                onChange={(e) => set_pwd(e.target.value)}
                                onBlur={() => setpwdTouched(true)}
                            />
                            <button className="absolute bottom-[19px] right-[24px] w-6 h-6 text-darkgrey" onMouseDown={() => set_type('')} onMouseUp={() => set_type('password')} onMouseLeave={() => set_type('password')}>
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
                            show={(pwdTouched || showError) && !(pwd.length >= 6)}
                            label="Password must be longer than 6 characters."
                        />

                        <div className="mt-8 w-full relative">
                            <div className="text-grey text-[12px] leading-[19px]">Repeat Password *</div>
                            <input
                                className="w-full rounded-[15px] h-[62px] mt-0.5 border text-darkgrey text-[14px] leading-[21px] pl-[24px] pr-[58px] border-lightgrey"
                                placeholder="Confirm your password"
                                type={type1}
                                value={confirmPwd}
                                onChange={(e) => set_confirmPwd(e.target.value)}
                                onBlur={() => setConfirmPwdTouched(true)}
                            />
                            <button className="absolute bottom-[19px] right-[24px] w-6 h-6 text-darkgrey" onMouseDown={() => set_type1('')} onMouseUp={() => set_type1('password')} onMouseLeave={() => set_type('password')}>
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
                            show={(confirmPwdTouched || showError) && !isValidConfirmPwd}
                            label="Passwords do not match."
                        />

                        <div className="flex items-center space-x-2 mt-6">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded text-green border-green focus:ring-green cursor-pointer"
                                checked={haveRead}
                                onChange={(e) => set_haveRead(e.target.checked)}
                            />
                            <div className="text-[14px] leading-[21px] lg:text-[16px] lg:leading-[24px] font-semibold">
                                I've agreed with the &nbsp;
                                <a href={`${process.env.REACT_APP_BASE_URL}rules`} className="text-green underline" target="_blank">
                                    Terms & Policy
                                </a>
                            </div>
                        </div>
                        <ShowFieldError
                            show={!haveRead && showError}
                            label="You have to read the rules."
                        />

                        <button
                            className="mt-8 w-full rounded-[14px] h-12 flex items-center justify-center bg-green text-white text-[16px] leading-[24px] hover:opacity-80 transition-opacity"
                            onClick={register}
                        >
                            Register
                        </button>
                        <div className="w-full mt-8 flex justify-center space-x-1 items-center">
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

export default CustomerRegister;