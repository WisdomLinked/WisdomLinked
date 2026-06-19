import React, { useState } from "react";
import { Check, Reply, Trash2 } from "lucide-react";
import { formatMessageTime } from '../../../../utils/formatMessageTime';
import { Card, CardContent, Typography } from "@mui/material";
import FilePreviewModal from "../../FilePreviewModal";
import { renderSafeMessageHtml } from "../../../../utils/safeMessageHtml";
import { resolveSafeChatFileUrl } from "../../../../utils/safeFileUrl";
import ReplyQuoteCard from "../../../../components/messenger/ReplyQuoteCard";
import { resolveReplyAuthorLabel } from "../../../../utils/displayName";
import { immediateReplyQuote, peelWisdomLinkedReplyQuotes } from "../../../../utils/chatReplyLayout";

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

const parseHtml = (html: string | undefined | null) => renderSafeMessageHtml(html);

function renderChatRichContent(
    html: string,
    theme: string,
    bubble: "incoming" | "outgoing",
    onJumpToParent?: (messageId: string) => void,
    replyLabelOpts?: { peerDisplayName?: string; peerSlug?: string },
): React.ReactNode {
    const { quotes, bodyHtml } = peelWisdomLinkedReplyQuotes(html);
    const quote = immediateReplyQuote(quotes);

    if (!quote) {
        return <>{parseHtml(bodyHtml || html)}</>;
    }

    const divider =
        bubble === "outgoing"
            ? "my-2 h-px w-full bg-white/25"
            : theme === "light"
              ? "my-2 h-px w-full bg-slate-300/80"
              : "my-2 h-px w-full bg-white/20";

    const authorLabel = resolveReplyAuthorLabel(quote.to, replyLabelOpts);

    return (
        <>
            <ReplyQuoteCard
                authorName={authorLabel}
                excerpt={quote.excerpt}
                variant={bubble}
                theme={theme}
                parentMessageId={quote.messageId}
                onJumpToParent={onJumpToParent}
            />
            <div className={divider} role="separator" />
            {parseHtml(bodyHtml || "")}
        </>
    );
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
    onReplyMessage,
    onJumpToParent,
    replyPeerDisplayName,
    replyPeerSlug,
    threadBubbleShellClassName,
    showDeleteAffix,
    canDeleteForEveryone,
}: {
    content: string;
    hideDate?: boolean;
    date?: string;
    incomingMessage?: boolean;
    theme?: string;
    deliveryStatus?: string;
    messageId?: string;
    roomId?: string | null;
    canDelete?: boolean;
    deleteForMeAvailable?: boolean;
    onDeleteMessage?: (messageId: string, mode: 'me' | 'both') => Promise<void>;
    onReplyMessage?: () => void;
    onJumpToParent?: (messageId: string) => void;
    replyPeerDisplayName?: string;
    replyPeerSlug?: string;
    threadBubbleShellClassName?: string;
    showDeleteAffix?: boolean;
    /** When false, only "Delete for me" is offered (peer messages). Default: !incomingMessage */
    canDeleteForEveryone?: boolean;
    sameAuthor?: boolean;
    userId?: string;
    username?: string;
    image?: string;
    role?: string;
    status?: string;
    isFriend?: boolean;
    disableBookButton?: boolean;
    myRole?: string;
}) => {
    const replyLabelOpts = {
        peerDisplayName: replyPeerDisplayName,
        peerSlug: replyPeerSlug,
    };

    const [showPreview, setShowPreview] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteOptions, setShowDeleteOptions] = useState(false);

    const tryDelete = async (mode: 'me' | 'both') => {
        if (!onDeleteMessage || !messageId) return;
        if (mode === 'both' && typeof window !== "undefined") {
            const confirmed = window.confirm("Delete this message for everyone? This cannot be undone.");
            if (!confirmed) return;
        }
        setDeleting(true);
        try {
            await onDeleteMessage(String(messageId), mode);
            setShowDeleteOptions(false);
        } finally {
            setDeleting(false);
        }
    };

    const handleDownload = () => {
        if (!safeFileUrl) return;
        window.open(safeFileUrl, '_blank', 'noopener,noreferrer');
    };  

    const isCallDurationMessage =
        content.startsWith("Call Lasted for:") || content.startsWith("Seminar Lasted for:");

    const isFile = content.startsWith("Chatfile: ");
    const fileUrl = isFile ? content.replace("Chatfile: ", "").split("#####")[0] : "";
    const fileName = isFile ? content.split("#####")[1] : "";
    const safeFileUrl = resolveSafeChatFileUrl(fileUrl);

    if( isCallDurationMessage && content.includes("#####") )
    {
        const startTimeUTC = content.split("#####")[1];
        const endTimeUTC = content.split("#####")[2];
        
        // Convert UTC strings to Date objects
        const startDate = new Date(startTimeUTC);
        const endDate = new Date(endTimeUTC);

        // Log the local time strings
        const startTimeOnly = formatMessageTime(startDate);
        const endTimeOnly = formatMessageTime(endDate);
        content = content.split("#####")[0];
        //ADD the start and end time to content
        content = content + ` <br/> Start Time: ${startTimeOnly} <br/> End Time: ${endTimeOnly}`;
    }

    const useThreadBubble =
        Boolean(threadBubbleShellClassName) && !isFile && !isCallDurationMessage;

    const renderReplyAction = () => {
        if (!onReplyMessage || !messageId || String(messageId).startsWith('temp-')) return null;
        return (
            <button
                type="button"
                onClick={onReplyMessage}
                className={`shrink-0 rounded p-1 ${theme === "light" ? "text-slate-500 hover:bg-slate-100" : "text-slate-400 hover:bg-white/10"}`}
                title="Reply to message"
                aria-label="Reply to message"
            >
                <Reply className="h-3.5 w-3.5" />
            </button>
        );
    };

    const allowDeleteForEveryone = canDeleteForEveryone ?? !incomingMessage;

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
                {allowDeleteForEveryone ? (
                    <button
                        type="button"
                        disabled={deleting}
                        onClick={() => void tryDelete('both')}
                        className={`rounded px-2 py-1 text-[11px] ${theme === "light" ? "text-rose-700 hover:bg-rose-50" : "text-rose-300 hover:bg-white/10"}`}
                    >
                        Delete for everyone
                    </button>
                ) : null}
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

    const showThreadDelete = (showDeleteAffix ?? canDelete) && canDelete;

    if (incomingMessage && useThreadBubble) {
        return (
            <div className="flex min-w-0 max-w-full items-end gap-1">
                <div
                    className={`chat-message-rich min-w-0 max-w-full px-2 py-1.5 text-sm leading-5 shadow-sm break-words whitespace-pre-wrap ${threadBubbleShellClassName}`}
                >
                    {renderChatRichContent(content, theme, "incoming", onJumpToParent, replyLabelOpts)}
                </div>
                {showThreadDelete ? renderDeleteActions() : null}
                {renderReplyAction()}
            </div>
        );
    }

    if (!incomingMessage) {

        // If it's a file message, show the file link
        if (isFile) {
            return (
                <div className="chat_value_container flex w-full justify-end pr-2 sm:pr-4">
                <div className="flex max-w-[min(100%,36rem)] flex-col items-end px-1 py-1">
                    {!hideDate && (
                        <div className="text-grey text-[12px]">
                            {formatMessageTime(new Date(date))}
                        </div>
                    )}
                    <div className="flex items-end gap-1">
                        {renderDeleteActions()}
                        <div className="flex">
                            {/* Preview section */}
                            <button
                            onClick={() => safeFileUrl && setShowPreview(true)}
                            disabled={!safeFileUrl}
                            style={{ backgroundColor: '#227768' }}
                            className="flex items-center gap-2 text-white font-semibold px-4 py-1.5 rounded-l-lg shadow-md hover:brightness-90 transition text-sm"
                            >
                                📄 {fileName}
                            </button>
                            
                            {/* Download section */}
                            <button
                            onClick={handleDownload}
                            disabled={!safeFileUrl}
                            style={{ backgroundColor: '#227768' }}
                            className="flex items-center px-3 py-1.5 text-white font-semibold rounded-r-lg shadow-md hover:brightness-90 transition text-sm"
                            title="Download file"
                            >
                                ⬇                        
                            </button>

                            {showPreview && (
                            <FilePreviewModal
                                fileUrl={safeFileUrl || ""}
                                fileName={fileName}
                                documentType="File Preview"
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
                            {formatMessageTime(new Date(date))}
                        </div>
                    )}
                    {/*
                      Special Template for "Call Lasted for" or "Seminar Lasted for"
                      using MUI Card
                    */}
                    <div className="mt-0.5 flex min-w-0 items-end gap-1">
                        {renderDeleteActions()}
                        <Card
                            sx={{
                                backgroundColor: "#333333",
                                color: "#ffffff",
                                borderRadius: "10px",
                                maxWidth: "min(100%, 36rem)",
                                mt: 0.5,
                                overflow: "hidden",
                                border: "1px solid #31B099",
                            }}
                        >
                            <CardContent>
                                <Typography sx={{ fontSize: 14, fontWeight: 600, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
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

        if (useThreadBubble) {
            return (
                <div className="flex min-w-0 max-w-full items-end justify-end gap-1">
                    {renderReplyAction()}
                    {showThreadDelete ? renderDeleteActions() : null}
                    <div
                        className={`chat-message-rich min-w-0 max-w-full px-2 py-1.5 text-sm leading-5 shadow-sm break-words ${threadBubbleShellClassName}`}
                    >
                        {renderChatRichContent(content, theme, "outgoing", onJumpToParent, replyLabelOpts)}
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
                            {formatMessageTime(new Date(date))}
                        </div>
                    ) : null}
                    <div className="flex min-w-0 items-end gap-1">
                        {renderReplyAction()}
                        {renderDeleteActions()}
                        <div
                            className={`min-w-0 max-w-full rounded-[13px] px-2 py-1.5 text-[14px] leading-[20px] shadow-sm ${
                                theme === "light" ? "text-white bg-[#234C6A]" : "text-white bg-[#234C6A]"
                            }`}
                        >
                            <div className="chat-message-rich break-words">
                                {renderChatRichContent(content, theme, "outgoing", onJumpToParent, replyLabelOpts)}
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
                        {formatMessageTime(new Date(date))}
                    </div>
                )}

                {/* If it's a call-duration message, show the special template */}
                {isCallDurationMessage ? (
                    <div className="flex items-end gap-1">
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
                    {renderDeleteActions()}
                    {renderReplyAction()}
                    </div>
                    ) : isFile ? (
                        <div className="chat_value_container flex flex-col items-start px-1 py-1">
                            <div className="flex items-end gap-1">
                                {/* Preview section */}
                                <button
                                onClick={() => safeFileUrl && setShowPreview(true)}
                                disabled={!safeFileUrl}
                                style={{ backgroundColor: '#227768' }}
                                className="flex items-center gap-2 text-white font-semibold px-4 py-1.5 rounded-l-lg shadow-md hover:brightness-90 transition text-sm"
                                >
                                    📄 {fileName}
                                </button>
                                
                                {/* Download section */}
                                <button
                                onClick={handleDownload}
                                disabled={!safeFileUrl}
                                style={{ backgroundColor: '#227768' }}
                                className="flex items-center px-3 py-1.5 text-white font-semibold rounded-r-lg shadow-md hover:brightness-90 transition text-sm"
                                title="Download file"
                                >
                                    ⬇                        
                                </button>

                                {showPreview && (
                                <FilePreviewModal
                                    fileUrl={safeFileUrl || ""}
                                    fileName={fileName}
                                    documentType="File Preview"
                                    onClose={() => setShowPreview(false)}
                                />
                                )}
                                {renderDeleteActions()}
                                {renderReplyAction()}
                            </div>
                        </div>
                ) : (
                    // Otherwise, show the regular incoming message bubble
                    <div className="flex min-w-0 items-end gap-1">
                        <div
                            className={`min-w-0 max-w-full rounded-[13px] px-2 py-1.5 text-[14px] leading-[20px] shadow-sm ${
                                theme === "light"
                                    ? "text-[#234C6A] bg-[#D9EAFD] border border-[#BCD6EA]"
                                    : "text-white bg-[#456882]"
                            }`}
                        >
                            <div className="chat-message-rich break-words">
                                {renderChatRichContent(content, theme, "incoming", onJumpToParent, replyLabelOpts)}
                            </div>
                        </div>
                        {renderDeleteActions()}
                        {renderReplyAction()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Message;