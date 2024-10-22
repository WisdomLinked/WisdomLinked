import React, { useEffect, useState } from "react"
import Header from "../components/header"
import LandingFooter from "../components/landingFooter"
import { SetLoadingStatus } from "../actions/appActions"
import { useDispatch } from "react-redux"
import { Link, useParams } from "react-router-dom"
import { verifyRegistration } from "../api/api"

const VerifyEmail = () => {

    const dispatch = useDispatch()
    const { email, confirmCode } = useParams()
    const [error, set_error] = useState(false)
    const [confirmed, set_confirmed] = useState(false)

    const verify = async (email: string, confirmCode: string) => {
        SetLoadingStatus(true)
        const response = await verifyRegistration({ email, confirmCode })
        if (response?.status === 'SUCCESS') {
            set_confirmed(true)
        } else {
            set_error(true)
        }
        SetLoadingStatus(false)
    }

    useEffect(() => {
        set_confirmed(false)
        if (email && confirmCode) {
            set_error(false)
            verify(email, confirmCode)
        } else {
            set_error(true)
        }
    }, [email, confirmCode])

    return (
        <>
            <Header />
            {
                error ?
                    <div className="w-full h-[400px] flex flex-col items-center justify-center">
                        <div className="text-center text-white text-2xl">Oops, something went wrong :(</div>
                        <div className="text-center text-grey text-lg">Please check your confirmation link again.</div>
                    </div> :
                    confirmed ?
                        <div className="w-full h-[400px] flex flex-col items-center justify-center">
                            <div className="text-center text-white text-2xl">Your registration request is confirmed</div>
                            <Link
                                to='/login'
                                className="px-3 py-1 border border-green rounded-md text-white text-lg mt-6 bg-green hover:text-green hover:bg-transparent"
                            >
                                Go to Login
                            </Link>
                        </div> :
                        <div className="w-full h-[400px] flex flex-col items-center justify-center">
                            <div className="text-center text-white text-2xl">Verifying your email address ...</div>
                            <div className="text-center text-grey text-lg">Please wait for a moment, you'll be done soon.</div>
                        </div>
            }
            <LandingFooter />
        </>
    )
}

export default VerifyEmail