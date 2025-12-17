import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from '../assets/images/logo.png'
import { useDispatch } from "react-redux";
import { useAppSelector } from "../store";
import ShowFieldError from "../components/ShowFieldError";
import { SetLoadingStatus } from "../actions/appActions";
import { validateEmail } from "../actions/common";
import { login } from "../api/api";
import { showAlert } from "../actions/alertActions";
import ConfirmCode from "../components/ConfirmCode";

const LogIn = () => {

    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [email, set_email] = useState('')
    const [pwd, set_pwd] = useState('')
    const [isValidEmail, set_isValidEmail] = useState(false)
    const [type, set_type] = useState('password')
    const [isRemembered, set_isRemembered] = useState(localStorage.getItem("isLoginRemembered") === "true")
    const { userDetails } = useAppSelector(state => state.auth)
    const [codeSent, set_codeSent] = useState(false)

    const handleLogin = async () => {
        SetLoadingStatus(true)
        const response: any = await login({ email: email, password: pwd });
        //console.log('Full login response:', JSON.stringify(response, null, 2));
        if (response.status === 'SUCCESS') {
            //console.log('Login successful, code:', response.code);
            set_codeSent(true)
        } else {
            console.error('Login failed:', response.error);
            dispatch(showAlert(response.error))

        }
        SetLoadingStatus(false)
    }

    useEffect(() => {
        set_isValidEmail(!email ? true : validateEmail(email) ? true : false)
    }, [email])

    useEffect(() => {
        if (userDetails?.email) {
            if (isRemembered) {
                localStorage.setItem("isLoginRemembered", 'true')
            } else {
                localStorage.setItem("isLoginRemembered", 'false')
            }
            navigate(import.meta.env.VITE_AUTH_URL + userDetails?.role + "dashboard")
            SetLoadingStatus(false)
        }
    }, [userDetails, navigate])

    return (
        codeSent ?
            <ConfirmCode email={email} password={pwd} /> :
            <div className="w-full h-screen overflow-y-auto flex flex-col lg:flex-row">
                <div className="flex flex-col w-full pt-12 px-8 pb-[118px] lg:w-[50%] lg:h-full lg:px-[60px] lg:py-0 lg:justify-center bg-black ">
                    <Link to='/' className="w-fit flex items-center space-x-[2px] text-white font-black text-4xl">
                        <img src={logo} className="w-10 h-10" />
                        <span>OE</span>
                    </Link>
                    <div className="mt-10 text-[32px] leading-[150%] lg:text-[56px] lg:leading-[84px] font-bold gradient_text">Talk with experts</div>
                    <div className="text-white text-[32px] leading-[150%] lg:text-[56px] lg:leading-[84px] font-bold">about study, research and jobs overseas</div>
                    <div className="text-lightgrey mt-6 text-[14px] leading-[21px]">Top notch professors, scientists, senior engineers, and managers from all over the world are at finer tips for advice</div>
                </div>
                <div className="w-full bg-white lg:w-[50%] lg:h-full flex justify-center lg:items-center pt-[64px] px-[56px] pb-[52px] lg:p-0 relative">
                    <div className="w-full max-w-[416px] flex flex-col lg:-mt-10">
                        <button
                            className="w-6 h-6 text-darkgrey"
                            onClick={() => navigate(-1)}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9.57 5.92993L3.5 11.9999L9.57 18.0699" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M20.5 12H3.67004" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <div className="text-[24px] leading-[36px] lg:text-[32px] lg:leading-[48px] font-bold text-typo-title mt-8">
                            Let's login to your <br />TOE Consulting account
                        </div>
                        <div className="mt-8 text-grey text-[12px] leading-[19px]">Email</div>
                        <input
                            className="w-full rounded-[15px] h-[62px] mt-0.5 border text-darkgrey text-[14px] leading-[21px] px-[24px] border-lightgrey"
                            placeholder="Input your email address"
                            type='email'
                            value={email}
                            onChange={(e) => set_email(e.target.value)}
                        />
                        <ShowFieldError
                            show={!isValidEmail}
                            label="Invalid email address"
                        />
                        <div className="mt-8 w-full relative">
                            <div className="text-grey text-[12px] leading-[19px]">Password</div>
                            <input
                                className="w-full rounded-[15px] h-[62px] mt-0.5 border text-darkgrey text-[14px] leading-[21px] pl-[24px] pr-[58px] border-lightgrey"
                                placeholder="Input your password"
                                type={type}
                                value={pwd}
                                onChange={(e) => set_pwd(e.target.value)}
                            />
                            {/*<button className="absolute bottom-[19px] right-[24px] w-6 h-6 text-darkgrey" onMouseDown={() => set_type('')} onMouseUp={() => set_type('password')} onMouseLeave={() => set_type('password')}>*/}
                            {/*    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">*/}
                            {/*        <path d="M14.5299 9.46992L9.46992 14.5299C8.81992 13.8799 8.41992 12.9899 8.41992 11.9999C8.41992 10.0199 10.0199 8.41992 11.9999 8.41992C12.9899 8.41992 13.8799 8.81992 14.5299 9.46992Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />*/}
                            {/*        <path d="M17.8198 5.76998C16.0698 4.44998 14.0698 3.72998 11.9998 3.72998C8.46984 3.72998 5.17984 5.80998 2.88984 9.40998C1.98984 10.82 1.98984 13.19 2.88984 14.6C3.67984 15.84 4.59984 16.91 5.59984 17.77" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />*/}
                            {/*        <path d="M8.41992 19.5299C9.55992 20.0099 10.7699 20.2699 11.9999 20.2699C15.5299 20.2699 18.8199 18.1899 21.1099 14.5899C22.0099 13.1799 22.0099 10.8099 21.1099 9.39993C20.7799 8.87993 20.4199 8.38993 20.0499 7.92993" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />*/}
                            {/*        <path d="M15.5095 12.7C15.2495 14.11 14.0995 15.26 12.6895 15.52" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />*/}
                            {/*        <path d="M9.47 14.53L2 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />*/}
                            {/*        <path d="M21.9993 2L14.5293 9.47" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />*/}
                            {/*    </svg>*/}
                            {/*</button>*/}
                            <button
                                className="absolute bottom-[19px] right-[24px] w-6 h-6 text-darkgrey"
                                onClick={() => set_type(type === 'password' ? 'text' : 'password')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                     stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M2.458 12C3.732 7.943 7.522 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.478 0-8.268-2.943-9.542-7z"/>
                                </svg>
                            </button>

                        </div>
                        <ShowFieldError
                            show={!(pwd.length >= 6 || !pwd)}
                            label="Password must be longer than 6 characters."
                        />
                        <div className="w-full mt-6 flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                                <button
                                    className={`w-3 h-3 lg:w-4 lg:h-4 rounded-[4px] ${isRemembered ? 'text-green' : 'border border-green'}`}
                                    onClick={() => set_isRemembered(!isRemembered)}
                                >
                                    <svg className="w-[14px] h-[14px] lg:w-[18px] lg:h-[18px] -mt-[1px] -ml-[1px]" style={{ display: isRemembered ? 'block' : 'none' }} viewBox="0 0 12 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M8.44352 0.666748H3.55518C1.43185 0.666748 0.166016 1.93258 0.166016 4.05591V8.93841C0.166016 11.0676 1.43185 12.3334 3.55518 12.3334H8.43768C10.561 12.3334 11.8268 11.0676 11.8268 8.94425V4.05591C11.8327 1.93258 10.5668 0.666748 8.44352 0.666748ZM8.78768 5.15841L5.48018 8.46591C5.39852 8.54758 5.28768 8.59425 5.17102 8.59425C5.05435 8.59425 4.94352 8.54758 4.86185 8.46591L3.21102 6.81508C3.04185 6.64591 3.04185 6.36591 3.21102 6.19675C3.38018 6.02758 3.66018 6.02758 3.82935 6.19675L5.17102 7.53841L8.16935 4.54008C8.33852 4.37091 8.61852 4.37091 8.78768 4.54008C8.95685 4.70925 8.95685 4.98341 8.78768 5.15841Z" fill="currentColor" />
                                    </svg>
                                </button>
                                <div className="text-darkgrey text-[14px] leading-[21px] lg:text-[16px] lg:leading-[24px] font-semibold">Remember me</div>
                            </div>
                            <Link to='/forgotPassword' className="text-green text-[14px] leading-[21px] lg:text-[16px] lg:leading-[24px] font-semibold">Forgot Password</Link>
                        </div>
                        <button
                            className="mt-8 w-full rounded-[14px] h-12 flex items-center justify-center bg-green text-white text-[16px] leading-[24px] disabled:opacity-50"
                            disabled={!email || !pwd || pwd.length < 6 || !isValidEmail}
                            onClick={handleLogin}
                        >
                            Login
                        </button>
                        <div className="text-grey text-center text-[14px] leading-[21px] lg:text-[16px] lg:leading-[24px] font-semibold mt-8">Don't have an account?</div>
                        <div className="w-full flex flex-col sm:flex-row justify-center sm:space-x-3 items-center mt-2">
                            <Link to='/customerregister' className="text-green text-[14px] leading-[21px] lg:text-[16px] lg:leading-[24px] font-semibold underline">Customer Register</Link>
                            <Link to='/expertregister' className="text-green text-[14px] leading-[21px] lg:text-[16px] lg:leading-[24px] font-semibold underline">Expert Register</Link>
                        </div>
                        {/* <div className="w-full mt-[139px] flex flex-col space-y-3 items-center text-[12px] leading-[16px] lg:text-[14px] lg:leading-[21px] lg:absolute lg:bottom-[53px] lg:left-0 lg:flex-row lg:justify-center lg:space-x-3 lg:space-y-0">
                        <div className="text-center text-grey">©2023 TOE LTD. All rights reserved</div>
                        <div className=" w-fit flex justify-center items-center space-x-3">
                            <Link to='/term' className="text-green">Term & Condition</Link>
                            <div className="w-[1px] h-3 bg-grey"/>
                            <Link to='/privacy' className="text-green">Privacy & Policy</Link>
                        </div>
                    </div> */}
                    </div>
                </div>
            </div>
    )
}

export default LogIn;