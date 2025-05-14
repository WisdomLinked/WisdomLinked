import React, { useState, useEffect } from "react"
import Header from "../components/header"
import LandingFooter from "../components/landingFooter"
import { SetLoadingStatus } from "../actions/appActions"
import { passwordResetRequest, confirmPasswordResetByCode } from "../api/api"
import { useDispatch } from "react-redux"
import { showAlert } from "../actions/alertActions"
import ShowFieldError from "../components/ShowFieldError"
import { validateEmail } from "../actions/common"
import ReactCodeInput from "react-code-input"
import { Link } from "react-router-dom"

const ForgotPassword = () => {

    const dispatch = useDispatch()
    const [email, set_email] = useState('')
    const [isValidEmail, set_isValidEmail] = useState(false)
    const [pwd, set_pwd] = useState('')
    const [confirmPwd, set_confirmPwd] = useState('')
    const [isValidConfirmPwd, set_isValidConfirmPwd] = useState(false)
    const [emailTouched, setEmailTouched] = useState(false)
    const [pwdTouched, setpwdTouched] = useState(false)
    const [confirmPwdTouched, setConfirmPwdTouched] = useState(false)
    const [type, set_type] = useState('password')
    const [type1, set_type1] = useState('password')
    const [enableToRegister, set_enableToRegister] = useState(false)
    const [codeSent, set_codeSent] = useState(false)
    const [success, set_success] = useState(false)

    useEffect(() => {
        if (emailTouched) {
            set_isValidEmail(!email ? true : validateEmail(email) ? true : false)
        }
    }, [email, emailTouched])

    useEffect(() => {
        if(confirmPwdTouched) {
            set_isValidConfirmPwd(!pwd && !confirmPwd ? true : pwd === confirmPwd ? true : false)
        }
    }, [pwd, confirmPwd, confirmPwdTouched])

    useEffect(() => {
        if (
            isValidEmail &&
            pwd.length >= 6 &&
            isValidConfirmPwd
        ) {
            set_enableToRegister(true)
        } else {
            set_enableToRegister(false)
        }
    }, [isValidEmail, isValidConfirmPwd, pwd])

    // confirm code
    const [timeRemained, set_timeRemained] = useState(60);
    const [inputCode, set_inputCode] = useState('');

    const countDown = () => {
        set_timeRemained((prev) => prev - 1);
    };

    const clearAllIntervals = () => {
        // Get a reference to the last interval + 1
        const interval_id = window.setInterval(function () { },
            Number.MAX_SAFE_INTEGER);

        // Clear any timeout/interval up to that id
        for (let i = 1; i < interval_id; i++) {
            window.clearInterval(i);
        }
    };

    const send = async () => {
        SetLoadingStatus(true)
        const response = await passwordResetRequest({ email, password: pwd })
        if (response.status === 'SUCCESS') {
            console.log(response, '////')
            dispatch(showAlert('Password is sent to the provided email address.'))
            clearAllIntervals()
            set_codeSent(true)
            set_timeRemained(60)
        } else {
            dispatch(showAlert(response.error))
        }
        SetLoadingStatus(false)
    }

    const confirmCode = async () => {
        SetLoadingStatus(true);
        const response: any = await confirmPasswordResetByCode({ email, password: pwd, code: inputCode });
        if (response.status === "SUCCESS") {
            set_success(true)
        } else {
            dispatch(showAlert(response.error))
        }
        SetLoadingStatus(false);
    }

    useEffect(() => {
        if (timeRemained === 60) {
            setInterval(countDown, 1000);
        }
        if (!timeRemained) {
            clearAllIntervals();
        }
    }, [timeRemained]);

    useEffect(() => {
        if (inputCode?.length === 6) {
            confirmCode()
        }
    }, [inputCode])

    return (
        <>
            <Header />
            <div className="w-full h-[600px] flex flex-col items-center justify-center">
                <div className="w-full max-w-[400px]">
                    <div className="text-center text-white text-2xl">Reset password</div>
                    {
                        success ?
                            <>
                                <div className="text-center text-white text-xl mt-20">Successfully reset password</div>
                                <Link
                                    to='/login'
                                    className="block w-fit  mx-auto px-3 py-1 border border-green rounded-md text-white text-lg mt-6 bg-green hover:text-green hover:bg-transparent"
                                >
                                    Go to Login
                                </Link>
                            </> :
                            codeSent ?
                                <div className="flex flex-col items-center">
                                    <div className="text-center text-white text-2xl">
                                        {!timeRemained
                                            ? "Your code is expired."
                                            : `Verification Code is Sent to ${email}`}
                                    </div>
                                    <div className="text-center text-grey text-lg">
                                        {!timeRemained
                                            ? "Please send the code again for login."
                                            : `The code expires in ${timeRemained}s`}
                                    </div>
                                    <br />
                                    <ReactCodeInput
                                        name="code"
                                        inputMode="numeric"
                                        type="number"
                                        fields={6}
                                        value={inputCode}
                                        onChange={(value: any) => set_inputCode(value)}
                                    />
                                    <button
                                        className="block mx-auto px-3 py-1 border border-green rounded-md text-white text-lg mt-6 bg-green hover:text-green hover:bg-transparent"
                                        onClick={send}
                                    >
                                        Resend Code
                                    </button>
                                </div> :
                                <>
                                    <div className="mt-6 text-grey text-[12px] leading-[19px]">Email *</div>
                                    <input
                                        className="mt-0.5 w-full bg-transparent rounded-[15px] h-[50px] border text-white text-[14px] leading-[21px] px-[24px] border-lightgrey"
                                        placeholder="Input your email address"
                                        type='email'
                                        value={email}
                                        onChange={(e) => set_email(e.target.value)}
                                        onBlur={() => setEmailTouched(true)}
                                    />
                                    <ShowFieldError
                                        show={emailTouched && !isValidEmail}
                                        label="Invalid email address"
                                    />
                                    <div className="mt-6 w-full relative">
                                        <div className="text-grey text-[12px] leading-[19px]">Password *</div>
                                        <input
                                            className="w-full bg-transparent text-white rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] pl-[24px] pr-[58px] border-lightgrey"
                                            placeholder="Input your password"
                                            type={type}
                                            value={pwd}
                                            onChange={(e) => set_pwd(e.target.value)}
                                            onBlur={() => setpwdTouched(true)}
                                        />
                                        <button className="absolute bottom-[13px] text-white right-[24px] w-6 h-6" onMouseDown={() => set_type('')} onMouseUp={() => set_type('password')} onMouseLeave={() => set_type('password')}>
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
                                        show={pwdTouched && !(pwd.length >= 6 || !pwd)}
                                        label="Password must be longer than 6 characters."
                                    />

                                    <div className="mt-6 w-full relative">
                                        <div className="text-grey text-[12px] leading-[19px]">Repeat Password *</div>
                                        <input
                                            className="w-full bg-transparent text-white rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] pl-[24px] pr-[58px] border-lightgrey"
                                            placeholder="Confirm your password"
                                            type={type1}
                                            value={confirmPwd}
                                            onChange={(e) => set_confirmPwd(e.target.value)}
                                            onBlur={() => setConfirmPwdTouched(true)}
                                        />
                                        <button className="absolute bottom-[13px] text-white right-[24px] w-6 h-6" onMouseDown={() => set_type1('')} onMouseUp={() => set_type1('password')} onMouseLeave={() => set_type('password')}>
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
                                        show={confirmPwdTouched && !isValidConfirmPwd}
                                        label="Invalid confirm password."
                                    />
                                    <button
                                        className="block mx-auto px-3 py-1 border border-green rounded-md text-white text-lg mt-6 bg-green hover:text-green hover:bg-transparent disabled:opacity-50 disabled:pointer-events-none"
                                        disabled={!enableToRegister}
                                        onClick={send}
                                    >
                                        Send
                                    </button>
                                </>
                    }
                </div>
            </div>
            <LandingFooter />
        </>
    )
}

export default ForgotPassword