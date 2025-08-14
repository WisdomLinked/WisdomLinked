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
                <div className="text-center text-white text-2xl">Confirmation Email Sent to {email}</div>
                <div className="text-center text-grey text-lg">The confirmation link will be expired in 24 hours</div>
                {/* Steps */}
                <ul className="text-gray-300 mt-6 space-y-2 text-base text-center">
                <li>1) After you confirm your email, your account will be sent to admin for review.</li>
                <li>2) The review process may take up to 24 hours.</li>
                <li>3) Once confirmed, you’ll get a final confirmation email.</li>
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