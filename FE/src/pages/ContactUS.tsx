import React, { useState, useEffect } from "react";
import FileBrowser from "../components/fileBrowser";
import ShowFieldError from "../components/ShowFieldError";
import { validateEmail } from "../actions/common";
import { callApi } from "../api/api";
import { SetLoadingStatus } from "../actions/appActions";

const ContactUS = () => {

    const [name, set_name] = useState('')
    const [email, set_email] = useState('')
    const [isValidEmail, set_isValidEmail] = useState(false)
    const [demand, set_demand] = useState('')
    const [file, set_file] = useState('')
    const [showError, set_showError] = useState(false)
    const [enableToSubmit, set_enableToSubmit] = useState(false)
    const [fileError, set_fileError] = useState('')

    const submit = async () => {
        if (!enableToSubmit) {
            set_showError(true)
        } else {
            set_showError(false)
            SetLoadingStatus(true)
            const response = await callApi(
                'POST',
                'auth/submit',
                {
                    email: email,
                    name: name,
                    demand: demand
                },
                file
            )
            SetLoadingStatus(false)
            if (response) {
                set_name('')
                set_email('')
                set_demand('')
                set_file('')
            }
        }
    }

    useEffect(() => {
        set_isValidEmail(!email ? true : validateEmail(email) ? true : false)
    }, [email])


    useEffect(() => {
        if (
            name.length >= 3 &&
            isValidEmail &&
            (!fileError && file)
        ) {
            set_enableToSubmit(true)
            set_showError(false)
        } else {
            set_enableToSubmit(false)
        }
    }, [name, isValidEmail, file, fileError])


    return (
        <div className="w-full main_container py-[40px] lg:py-[60px]">
            <div className="w-fit mx-auto flex items-center space-x-[10px] bg-darkgrey rounded-[80px] p-[5px] px-[25px]">
                <div className="text-white text-[12px] leading-[15px] lg:text-[14px] lg:leading-[21px]">
                    Become a member  🤟🏻
                </div>
            </div>
            <div className="max-w-[1060px] mx-auto mt-3 text-center text-white font-bold text-[32px] leading-[48px] lg:text-[56px] lg:leading-[78px]">
                Please contact us
            </div>
            <div className="w-full max-w-[734px] mx-auto mt-[55px] lg:mt-12">
                <div className="text-lightgrey text-[12px] leading-[19px]">Full Name *</div>
                <input
                    className="w-full bg-black rounded-[15px] h-[62px] mt-0.5 border text-white text-[14px] leading-[21px] px-[24px]"
                    placeholder="Input your Full Name"
                    value={name}
                    onChange={(e) => set_name(e.target.value)}
                />
                <ShowFieldError
                    show={!(name.length >= 3) && showError}
                    label="Name must be longer than 3 characters."
                />

                <div className="mt-6 text-white text-[12px] leading-[19px]">Email *</div>
                <input
                    className="w-full bg-black text-white rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] px-[24px]"
                    placeholder="Input your email address"
                    type='email'
                    value={email}
                    onChange={(e) => set_email(e.target.value)}
                />
                <ShowFieldError
                    show={!isValidEmail || (showError && !email)}
                    label={!isValidEmail ? "Invalid email address." : "Email is required."}
                />
                <div className="mt-8 lg:mt-12 text-lightgrey text-[12px] leading-[19px]">Demand</div>
                <textarea
                    className="w-full bg-black rounded-[15px] h-[200px] mt-0.5 border text-white text-[14px] leading-[21px] p-[24px]"
                    placeholder="Input your demand in detail"
                    value={demand}
                    onChange={(e) => set_demand(e.target.value)}
                />
                <div className="mt-8 lg:mt-12 text-lightgrey text-[12px] leading-[19px]">Upload a File *</div>
                <FileBrowser
                    file={file}
                    set_file={set_file}
                    set_fileError={set_fileError}
                />
                <ShowFieldError show={fileError || (!file && showError)} label={file ? fileError : 'File is required.'} />
                <div className="flex flex-row-reverse mt-[54px]">
                    <button
                        className="px-[48px] py-[15px] rounded-[14px] bg-green text-white text-[16px] leading-[24px] font-[600] disabled:opacity-50"
                        disabled={showError}
                        onClick={submit}
                    >
                        Submit
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ContactUS;