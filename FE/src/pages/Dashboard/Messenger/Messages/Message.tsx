import React, {useEffect, useState} from "react";
import Avatar from "../../../../components/Avatar";
import parse from 'html-react-parser';
import { formatDate } from "../../../../actions/common";
import { useDispatch } from "react-redux";
import { setChosenChatDetails, setChosenGroupChatDetails } from "../../../../actions/chatActions";
import { useNavigate } from "react-router-dom";
import { SetLoadingStatus } from "../../../../actions/appActions";
import {joinGeneralChat, profileImageFetch} from "../../../../api/api";
import { Card, CardContent, Typography } from "@mui/material";

const parseHtml = (html: any) => {
    return parse(html ? html : '')
}

const Message = ({ content, sameAuthor, hiddenDropDown, disableBookButton, hideDate, userId, username, image, date, incomingMessage, isFriend, role, myRole, status }: any) => {

    const dispatch = useDispatch()
    const navigate = useNavigate()

    const chat = async () => {
        SetLoadingStatus(true)
        if (isFriend) {
            dispatch(setChosenChatDetails({ userId, username, image }));
        } else {
            const response = await joinGeneralChat(userId)
            if (response) {
                const currentGeneralChat = response.user.generalChats.find((x: any) => x.admin._id === userId)
                dispatch({
                    type: 'updateUserDetails',
                    payload: response.user
                })
                dispatch(setChosenGroupChatDetails({
                    ...currentGeneralChat,
                    groupId: currentGeneralChat._id,
                    groupName: currentGeneralChat.name,
                }))
            }
        }
        SetLoadingStatus(false)
    }

    const book = async () => {
        if (myRole === 'customer') {
            navigate(`${import.meta.env.VITE_AUTH_URL}${myRole}dashboard/search?_id=${userId}`)
        } else {
            navigate(`${import.meta.env.VITE_AUTH_URL}${myRole}dashboard/search?_id=${userId}`)
        }
    }

    const isCallDurationMessage =
        content.includes("Call Lasted for:") || content.includes("Seminar Lasted for:");

    if (!incomingMessage) {
        // If it's a call-duration message, show the special template
        if (isCallDurationMessage) {
            return (
                <div className="chat_value_container flex flex-col items-end mt-1 pl-14">
                    {!hideDate && (
                        <div className="text-grey text-[12px]">
                            {formatDate(new Date(date))}
                        </div>
                    )}
                    {/*
                      Special Template for "Call Lasted for" or "Seminar Lasted for"
                      using MUI Card
                    */}
                    <Card
                        sx={{
                            backgroundColor: "#333333",
                            color: "#ffffff",
                            borderRadius: "10px",
                            maxWidth: "250px",
                            mt: 0.5,
                            overflow: "hidden",
                            border: "1px solid #31B099",
                        }}
                    >
                        <CardContent>
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                                {parseHtml(content)}
                            </Typography>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        // Else, render the normal outgoing message
        return (
            <div className="chat_value_container">
                <div className="flex flex-col items-end mt-1 pl-14">
                    {!hideDate ? (
                        <div className="text-grey text-[12px]">
                            {formatDate(new Date(date))}
                        </div>
                    ) : null}
                    <div className="w-fit text-white bg-gray-800 rounded-[13px] px-1.5 py-1">
                        {parseHtml(content)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex mt-1 chat_value_container">
            {/* If not the same author, show the avatar */}
            {!sameAuthor && (
                <div
                    title={status}
                    className={`w-[60px] flex items-start justify-center relative ${
                        role === myRole || hiddenDropDown ? "" : "hoverBox"
                    }`}
                >
                    <div className="absolute bottom-10 left-2 pb-2 z-30 hidden">
                        <div className="p-3 rounded-md bg-black">
                            <div className="!flex flex-col gap-2">
                                <button
                                    className="w-[100px] p-1 rounded-lg border text-lightgrey border-lightgrey flex items-center justify-center"
                                    onClick={chat}
                                >
                                    Chat
                                </button>
                                <button
                                    className="w-[100px] p-1 mx-auto rounded-lg flex items-center justify-center bg-green text-white text-[16px] leading-[24px] disabled:opacity-50"
                                    disabled={disableBookButton}
                                    onClick={book}
                                >
                                    Book
                                </button>
                            </div>
                        </div>
                    </div>
                    <div
                        className={`rounded-full cursor-pointer ${
                            status === "review" ? "opacity-50" : ""
                        }`}
                    >
                        <Avatar
                            username={username}
                            image={image}
                            borderClass={
                                role === "admin"
                                    ? "border-brownyellow"
                                    : myRole === "admin" || isFriend
                                        ? ""
                                        : role === myRole
                                            ? "border-green"
                                            : "border-red"
                            }
                        />
                    </div>
                </div>
            )}

            {/* Main message content area */}
            <div className={`${sameAuthor ? "ml-[60px]" : ""} max-w-[calc(100%-60px)] pr-14`}>
                {!hideDate && (
                    <div className="text-grey text-[12px]">
                        {formatDate(new Date(date))}
                    </div>
                )}

                {/* If it's a call-duration message, show the special template */}
                {isCallDurationMessage ? (
                    <Card
                        sx={{
                            backgroundColor: "#222222",
                            color: "#ffffff",
                            borderRadius: "10px",
                            maxWidth: "250px",
                            mt: 0.5,
                            overflow: "hidden",
                            border: "1px solid #31B099",
                        }}
                    >
                        <CardContent>
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                                {parseHtml(content)}
                            </Typography>
                        </CardContent>
                    </Card>
                ) : (
                    // Otherwise, show the regular incoming message bubble
                    <div className="w-fit text-white bg-black rounded-[13px] px-1.5 py-1">
                        {parseHtml(content)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Message;