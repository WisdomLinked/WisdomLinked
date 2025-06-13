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
import FilePreviewModal from "../../FilePreviewModal";
import { is } from "date-fns/locale";

const parseHtml = (html: any) => {
    return parse(html ? html : '')
}

const Message = ({ content, sameAuthor, hiddenDropDown, disableBookButton, hideDate, userId, username, image, date, incomingMessage, isFriend, role, myRole, status }: any) => {

    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [showPreview, setShowPreview] = useState(false);

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
            navigate(`${process.env.REACT_APP_AUTH_URL}${myRole}dashboard/search?_id=${userId}`)
        } else {
            navigate(`${process.env.REACT_APP_AUTH_URL}${myRole}dashboard/search?_id=${userId}`)
        }
    }

    const handleDownload = () => {
        // Open file in new tab for download
        window.open(fileUrl, '_blank');
    };  

    const isCallDurationMessage =
        content.startsWith("Call Lasted for:") || content.startsWith("Seminar Lasted for:");

    const isFile = content.startsWith("Chatfile: ");
    const fileUrl = isFile ? content.replace("Chatfile: ", "").split("#####")[0] : "";
    const fileName = isFile ? content.split("#####")[1] : "";

    if( isCallDurationMessage && content.includes("#####") )
    {
        const startTimeUTC = content.split("#####")[1];
        const endTimeUTC = content.split("#####")[2];
        
        // Convert UTC strings to Date objects
        const startDate = new Date(startTimeUTC);
        const endDate = new Date(endTimeUTC);

        // Log the local time strings
        const startTimeOnly = startDate.toLocaleTimeString();
        const endTimeOnly = endDate.toLocaleTimeString();
        content = content.split("#####")[0];
        //ADD the start and end time to content
        content = content + ` <br/> Start Time: ${startTimeOnly} <br/> End Time: ${endTimeOnly}`;
    }


    if (!incomingMessage) {
        // If it's a file message, show the file link
        if (isFile) {
            return (
                <div className="chat_value_container flex flex-col items-end px-1 py-1">
                    {!hideDate && (
                        <div className="text-grey text-[12px]">
                            {formatDate(new Date(date))}
                        </div>
                    )}
                    <div className="flex">
                        {/* Preview section */}
                        <button
                        onClick={() => setShowPreview(true)}
                        style={{ backgroundColor: '#227768' }}
                        className="flex items-center gap-2 text-white font-semibold px-4 py-1.5 rounded-l-lg shadow-md hover:brightness-90 transition text-sm"
                        >
                            📄 {fileName}
                        </button>
                        
                        {/* Download section */}
                        <button
                        onClick={handleDownload}
                        style={{ backgroundColor: '#227768' }}
                        className="flex items-center px-3 py-1.5 text-white font-semibold rounded-r-lg shadow-md hover:brightness-90 transition text-sm"
                        title="Download file"
                        >
                            ⬇                        
                        </button>

                        {showPreview && (
                        <FilePreviewModal
                            fileUrl={fileUrl}
                            fileName={fileName}
                            onClose={() => setShowPreview(false)}
                        />
                        )}
                    </div>
                </div>
            );
        }
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
                    ) : isFile ? (
                        <div className="chat_value_container flex flex-col items-end px-1 py-1">
                            <div className="flex">
                                {/* Preview section */}
                                <button
                                onClick={() => setShowPreview(true)}
                                style={{ backgroundColor: '#227768' }}
                                className="flex items-center gap-2 text-white font-semibold px-4 py-1.5 rounded-l-lg shadow-md hover:brightness-90 transition text-sm"
                                >
                                    📄 {fileName}
                                </button>
                                
                                {/* Download section */}
                                <button
                                onClick={handleDownload}
                                style={{ backgroundColor: '#227768' }}
                                className="flex items-center px-3 py-1.5 text-white font-semibold rounded-r-lg shadow-md hover:brightness-90 transition text-sm"
                                title="Download file"
                                >
                                    ⬇                        
                                </button>

                                {showPreview && (
                                <FilePreviewModal
                                    fileUrl={fileUrl}
                                    fileName={fileName}
                                    onClose={() => setShowPreview(false)}
                                />
                                )}
                            </div>
                        </div>
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