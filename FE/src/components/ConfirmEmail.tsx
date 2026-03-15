import React from "react"
import Header from "./header"
import LandingFooter from "./landingFooter"
import { SetLoadingStatus } from "../actions/appActions"
import { resendConfirmEmail } from "../api/api"
import { useDispatch } from "react-redux"
import { showAlert } from "../actions/alertActions"

const ConfirmEmail = ({ email }: any) => {

    const dispatch = useDispatch()

    const resend = async () => {
        SetLoadingStatus(true)
        const response = await resendConfirmEmail({ email })
        if (response.status === 'SUCCESS') {
            dispatch(showAlert('Verification email is sent again.'))
        }
        SetLoadingStatus(false)
    }

    return (
        <>
            <Header />
            <div className="w-full h-[400px] flex flex-col items-center justify-center">
                <div className="text-center text-white text-2xl">Your registration request needs to be verified via a link sent to your email account.</div>
                <div className="text-center text-white text-lg mt-2">A verification link has been sent to <strong>{email}</strong></div>
                <div className="text-center text-grey text-lg mt-1">The verification link will expire in 24 hours</div>
                <div className="text-center text-gray-300 text-base mt-4">After your verification, the following will happen:</div>
                {/* Steps */}
                <ul className="text-gray-300 mt-3 space-y-2 text-base text-center">
                <li>1) After you confirm your email, your account will be sent to admin for review.</li>
                <li>2) The review process may take up to 24 hours.</li>
                <li>3) Once approved, you'll get a notification of the final approval via email.</li>
                </ul>
                <button
                    className="px-3 py-1 border border-green rounded-md text-white text-lg mt-6 bg-green hover:text-green hover:bg-transparent"
                    onClick={resend}
                >
                    Resend
                </button>
            </div>
            <LandingFooter />
        </>
    )
}

export default ConfirmEmail