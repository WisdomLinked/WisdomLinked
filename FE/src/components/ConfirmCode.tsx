import React, { useState, useEffect } from "react";
import Header from "./header";
import LandingFooter from "./landingFooter";
import { SetLoadingStatus } from "../actions/appActions";
import { login, confirmLoginByCode } from "../api/api";
import { useDispatch } from "react-redux";
import { showAlert } from "../actions/alertActions";
import ReactCodeInput from "react-code-input";
import { actionTypes } from "../actions/types";
import { useAppSelector } from "../store";
import { useNavigate } from "react-router-dom";

const ConfirmCode = ({ email, password }: any) => {
    const dispatch = useDispatch();
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

    const resend = async () => {
        SetLoadingStatus(true);
        const response: any = await login({ email, password });
        if (response.status === "SUCCESS") {
            // console.log(response.code, "////");
            dispatch(showAlert("Verification code is sent again."));
            clearAllIntervals();
            set_inputCode('')
            set_timeRemained(60);
        }
        SetLoadingStatus(false);
    };

    const confirmCode = async () => {
        SetLoadingStatus(true);
        const response: any = await confirmLoginByCode({ email, password, code: inputCode, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        // console.log(response, '////')
        if (response.status === "SUCCESS") {
            localStorage.setItem("currentUser", JSON.stringify(response.userDetails));
            dispatch({
                type: actionTypes.authenticate,
                payload: response.userDetails
            })

            dispatch(
                showAlert(
                    `Hi, ${response.userDetails.username} 👋. Welcome back.`
                )
            );
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
            <div className="w-full h-[400px] flex flex-col items-center justify-center">
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
                    type="text"
                    pattern="[0-9]*" 
                    fields={6}
                    value={inputCode}
                    onChange={(value: any) => set_inputCode(value)}
                />
                <button
                    className="px-3 py-1 border border-green rounded-md text-white text-lg mt-6 bg-green hover:text-green hover:bg-transparent"
                    onClick={resend}
                >
                    Resend Code
                </button>
            </div>
            <LandingFooter />
        </>
    );
};

export default ConfirmCode