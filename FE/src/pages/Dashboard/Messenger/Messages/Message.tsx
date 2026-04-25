import React, { useState } from "react";
import parse from 'html-react-parser';
import { Check, Trash2 } from "lucide-react";
import { formatDate } from "../../../../actions/common";
import { Card, CardContent, Typography } from "@mui/material";
import FilePreviewModal from "../../FilePreviewModal";

function DeliveryTicks({ status, theme }: { status?: string; theme?: string }) {
    if (!status) return null;
    const mutedCls = theme === "light" ? "text-slate-400" : "text-slate-500";
    const seenCls = "text-sky-500";
    if (status === "sending") {
        return (
            <span className={`shrink-0 text-[11px] leading-none ${mutedCls}`} aria-hidden>
                …
            </span>
        );
    }
    if (status === "sent") {
        return (
            <span className={`shrink-0 ${mutedCls}`} aria-label="Sent">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
        );
    }
    if (status === "delivered" || status === "seen") {
        const cls = status === "seen" ? seenCls : mutedCls;
        return (
            <span className={`relative inline-flex h-3.5 w-5 shrink-0 ${cls}`} aria-label={status === "seen" ? "Seen" : "Delivered"}>
                <Check className="absolute left-0 h-3.5 w-3.5" strokeWidth={2.5} />
                <Check className="absolute right-0 h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
        );
    }
    return (
        <span className={`shrink-0 ${mutedCls}`} aria-label="Sent">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
    );
}

const parseHtml = (html: any) => {
    return parse(html ? html : '')
}

const Message = ({
    content,
    hideDate,
    date,
    incomingMessage,
    theme = "dark",
    deliveryStatus,
    messageId,
    roomId,
    canDelete,
    deleteForMeAvailable,
    onDeleteMessage,
}: any) => {

    const [showPreview, setShowPreview] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteOptions, setShowDeleteOptions] = useState(false);

    const tryDelete = async (mode: 'me' | 'both') => {
        if (!onDeleteMessage || !messageId) return;
        setDeleting(true);
        try {
            await onDeleteMessage(String(messageId), mode);
            setShowDeleteOptions(false);
        } finally {
            setDeleting(false);
        }
    };

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
        const renderDeleteActions = () => {
            if (!canDelete || !onDeleteMessage) return null;
            if (!showDeleteOptions) {
                return (
                    <button
                        type="button"
                        disabled={deleting}
                        onClick={() => setShowDeleteOptions(true)}
                        className={`shrink-0 rounded p-1 ${theme === "light" ? "text-slate-500 hover:bg-slate-100" : "text-slate-400 hover:bg-white/10"}`}
                        title="Delete message"
                        aria-label="Delete message"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                );
            }
            return (
                <div className={`flex items-center gap-1 rounded-md px-1 py-1 ${theme === "light" ? "bg-white border border-slate-200" : "bg-black/70 border border-white/10"}`}>
                    {deleteForMeAvailable ? (
                        <button
                            type="button"
                            disabled={deleting}
                            onClick={() => void tryDelete('me')}
                            className={`rounded px-2 py-1 text-[11px] ${theme === "light" ? "text-slate-700 hover:bg-slate-100" : "text-white hover:bg-white/10"}`}
                        >
                            Delete for me
                        </button>
                    ) : null}
                    <button
                        type="button"
                        disabled={deleting}
                        onClick={() => void tryDelete('both')}
                        className={`rounded px-2 py-1 text-[11px] ${theme === "light" ? "text-rose-700 hover:bg-rose-50" : "text-rose-300 hover:bg-white/10"}`}
                    >
                        Delete for everyone
                    </button>
                    <button
                        type="button"
                        disabled={deleting}
                        onClick={() => setShowDeleteOptions(false)}
                        className={`rounded px-2 py-1 text-[11px] ${theme === "light" ? "text-slate-500 hover:bg-slate-100" : "text-slate-300 hover:bg-white/10"}`}
                    >
                        Cancel
                    </button>
                </div>
            );
        };

        // If it's a file message, show the file link
        if (isFile) {
            return (
                <div className="chat_value_container flex w-full justify-end pr-2 sm:pr-4">
                <div className="flex max-w-[min(100%,36rem)] flex-col items-end px-1 py-1">
                    {!hideDate && (
                        <div className="text-grey text-[12px]">
                            {formatDate(new Date(date))}
                        </div>
                    )}
                    <div className="flex items-end gap-1">
                        {renderDeleteActions()}
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
                        <DeliveryTicks status={deliveryStatus} theme={theme} />
                    </div>
                </div>
                </div>
            );
        }
        // If it's a call-duration message, show the special template
        if (isCallDurationMessage) {
            return (
                <div className="chat_value_container flex w-full justify-end pr-2 sm:pr-4">
                <div className="flex max-w-[min(100%,36rem)] flex-col items-end mt-1">
                    {!hideDate && (
                        <div className="text-grey text-[12px]">
                            {formatDate(new Date(date))}
                        </div>
                    )}
                    {/*
                      Special Template for "Call Lasted for" or "Seminar Lasted for"
                      using MUI Card
                    */}
                    <div className="mt-0.5 flex items-end gap-1">
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
                        <DeliveryTicks status={deliveryStatus} theme={theme} />
                    </div>
                </div>
                </div>
            );
        }

        // Else, render the normal outgoing message (right-aligned)
        return (
            <div className="chat_value_container flex w-full justify-end pr-2 sm:pr-4">
                <div className="flex max-w-[min(100%,36rem)] flex-col items-end mt-1">
                    {!hideDate ? (
                        <div className={`text-[12px] ${theme === "light" ? "text-slate-500" : "text-grey"}`}>
                            {formatDate(new Date(date))}
                        </div>
                    ) : null}
                    <div className="flex min-w-0 items-end gap-1">
                        {renderDeleteActions()}
                        <div
                            className={`min-w-0 max-w-full rounded-[13px] px-2 py-1.5 text-[14px] leading-[20px] shadow-sm ${
                                theme === "light" ? "text-white bg-[#234C6A]" : "text-white bg-[#234C6A]"
                            }`}
                        >
                            <div className="break-words whitespace-pre-wrap">
                                {parseHtml(content)}
                            </div>
                        </div>
                        <DeliveryTicks status={deliveryStatus} theme={theme} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-1 flex w-full chat_value_container justify-start pl-2 sm:pl-4">
            <div className="min-w-0 max-w-[min(100%,36rem)]">
                {!hideDate && (
                    <div className={`text-[12px] ${theme === "light" ? "text-slate-500" : "text-grey"}`}>
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
                        <div className="chat_value_container flex flex-col items-start px-1 py-1">
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
                    <div
                        className={`min-w-0 max-w-full rounded-[13px] px-2 py-1.5 text-[14px] leading-[20px] shadow-sm ${
                            theme === "light"
                                ? "text-[#234C6A] bg-[#D9EAFD] border border-[#BCD6EA]"
                                : "text-white bg-[#456882]"
                        }`}
                    >
                        <div className="break-words whitespace-pre-wrap">
                            {parseHtml(content)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Message;