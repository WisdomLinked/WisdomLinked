import React, { useEffect, useState } from "react";
import OverlayPortal from "./OverayPortal";
import { useDispatch } from "react-redux";
import CloseIcon from '@mui/icons-material/Close';
import { useAppSelector } from "../store";
import ShowFieldError from "./ShowFieldError";
import { Rating } from "@mui/material";
import { leaveFeedback } from "../api/api";
import { SetLoadingStatus } from "../actions/appActions";

export default function LeaveFeedback() {

    const dispatch = useDispatch();
    const { app: { feedbackModalShow },chat: { currentEvent }, room: { roomDetails}, auth: { userDetails } } = useAppSelector((state) => state);
    const [description, set_description] = useState("");
    const [rating, set_rating] = useState(0);
    const [enableToSubmit, set_enableToSubmit] = useState(false)

    const closeFeedbackModal = () => {
        dispatch({
            type: "SetFeedbackModalShow",
            payload: false,
        });
    }

    const submit = async () => {
        SetLoadingStatus(true)
        console.log("currentEvent", currentEvent);
        const response = await leaveFeedback({
            eventId: currentEvent ? currentEvent._id : null,
            // groupChatId: roomDetails ? roomDetails.groupId : null,
            groupChatId: currentEvent ? currentEvent._id : null,
            eventType: currentEvent ? currentEvent.type : null,
            start: currentEvent ? currentEvent.start : null,
            end: currentEvent ? currentEvent.end : null,
            totalTimeSpent: currentEvent ? currentEvent.totalTimeSpent : null,
            otherUserId: feedbackModalShow,
            description,
            rating
        })
        if (response) {
            dispatch({
                type: "SetFeedbackModalShow",
                payload: null,
            });
        }
        SetLoadingStatus(false)
        set_enableToSubmit(false)
        set_description('')
        set_rating(0)
    }

    useEffect(() => {
        if (description && rating) {
            set_enableToSubmit(true);
        } else {
            set_enableToSubmit(false);
        }
    }, [description, rating])

    return (
        <React.Fragment>
            {
                feedbackModalShow ?
                    <OverlayPortal closeModal={closeFeedbackModal}>
                        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center px-4">
                            <div
                                className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 backdrop-blur-sm"
                                onClick={closeFeedbackModal}
                            />
                            <div className="w-full max-w-[400px] rounded-md bg-black p-6 text-white relative">
                                <button
                                    className="absolute right-2 top-2 rounded-md hover:bg-grey"
                                    onClick={closeFeedbackModal}
                                >
                                    <CloseIcon />
                                </button>
                                <div className="text-center text-xl"> Leave a feedback </div>
                                <div className="mt-6 text-grey text-[12px] leading-[19px]">Feedback *</div>
                                <textarea
                                    className="w-full bg-transparent rounded-[15px] h-[100px] mt-0.5 border text-[14px] leading-[21px] px-[24px] py-4 border-lightgrey"
                                    placeholder="Describe yourself with few words"
                                    value={description}
                                    onChange={(e) => set_description(e.target.value)}
                                />
                                {
                                    <>
                                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Rate *</div>
                                        <Rating size="large" onChange={(e, newValue) => set_rating(newValue || 0)} value={rating} />
                                    </>
                                }
                                <div className="w-full h-10 flex justify-between mt-6 text-lightgrey">
                                    <button
                                        className="w-[calc(50%-8px)] rounded-lg border border-lightgrey flex items-center justify-center"
                                        onClick={closeFeedbackModal}
                                    >
                                        Skip
                                    </button>
                                    <button
                                        className="w-[calc(50%-8px)] bg-green rounded-lg flex items-center justify-center  disabled:opacity-50"
                                        disabled={!enableToSubmit}
                                        onClick={submit}
                                    >
                                        Submit
                                    </button>
                                </div>
                            </div>
                        </div>
                    </OverlayPortal> :
                    null
            }

        </React.Fragment>
    );
}