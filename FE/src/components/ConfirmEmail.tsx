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