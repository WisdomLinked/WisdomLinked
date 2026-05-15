import React, { useState, useEffect, useRef } from "react";
import { Paperclip, Send } from "lucide-react";
import { useAppSelector } from "../../../store";
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Smile } from "lucide-react";
import { callApi } from "../../../api/api";
import { showAlert } from "../../../actions/alertActions";
import { useDispatch } from "react-redux";
import { addNewMessage, setChatChannelInfo } from "../../../actions/chatActions";
import { getOrCreateDM, sendDirectMessage as apiSendDM, sendGroupMessage as apiSendGroup } from "../../../api/chatApi";
import { sendRoomTyping, connectToRC } from "../../../services/rcRealtime";
import { toRocketChatUsername } from "../../../utils/rocketchatUsername";
import { sanitizeMessageHtml } from "../../../utils/safeMessageHtml";
import type { ReplyDraft } from "./ChatDetails";
import ReplyQuoteCard from "../../../components/messenger/ReplyQuoteCard";
import { buildReplyQuoteHtml, flattenReplyTextForNextQuote } from "../../../utils/chatReplyLayout";

function plainTextToMessageHtml(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return "";
    const escaped = trimmed
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    return "<p>" + escaped.replace(/\n/g, "<br>") + "</p>";
}

const MAX_CHAT_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB per file
const ALLOWED_CHAT_FILE_EXTENSIONS = [
    "pdf",
    "doc",
    "docx",
    "txt",
    "csv",
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
];
const CHAT_FILE_REQUIREMENTS_MESSAGE =
    "Allowed formats: PDF, DOC, DOCX, TXT, CSV, JPG, JPEG, PNG, WEBP, GIF, XLS, XLSX, PPT, PPTX. Max size: 1 MB per file.";
const CHAT_FILE_SIZE_EXCEEDED_MESSAGE = "File is too large. Max size: 1 MB per file.";

const escapeReplyText = (value: string): string =>
    String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

const cleanReplyExcerpt = (value: string): string =>
    flattenReplyTextForNextQuote(String(value || "").replace(/\s+/g, " ").trim());

function getFileExtension(name: string): string {
    const value = (name || "").trim();
    if (!value.includes(".")) return "";
    return value.split(".").pop()?.toLowerCase() || "";
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
}

function resolveUploadErrorMessage(response: any): string {
    const raw = String(response?.error || response?.message || "").trim();
    if (!raw) return `Could not upload file. ${CHAT_FILE_REQUIREMENTS_MESSAGE}`;
    if (raw.toLowerCase().includes("file too large")) return CHAT_FILE_SIZE_EXCEEDED_MESSAGE;
    return raw;
}

const NewMessageInput: React.FC<any> = ({
    theme = "dark",
    replyTo,
    onCancelReply,
}: {
    theme?: string;
    replyTo?: ReplyDraft | null;
    onCancelReply?: () => void;
}) => {
    const [_message, set_message] = useState("");
    const dispatch = useDispatch();
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [file, set_file] = useState<File | undefined>(undefined)
    const [uploadingFile, setUploadingFile] = useState(false);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const quillRef = useRef<ReactQuill | null>(null);

    const resizeTextarea = (textarea: HTMLTextAreaElement | null = textareaRef.current) => {
        if (!textarea) return;
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 36), 160)}px`;
    };

    const resizeQuillEditor = () => {
        const editor = quillRef.current?.getEditor?.().root;
        const container = editor?.parentElement;
        if (!editor || !container) return;
        editor.style.minHeight = "44px";
        editor.style.maxHeight = "180px";
        editor.style.overflowY = "auto";
        editor.style.height = "auto";
        editor.style.height = `${Math.min(Math.max(editor.scrollHeight, 44), 180)}px`;
        container.style.height = "auto";
        container.style.maxHeight = "220px";
        container.style.overflowY = "visible";
    };
    
    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;

        const extension = getFileExtension(selectedFile.name);
        if (!extension || !ALLOWED_CHAT_FILE_EXTENSIONS.includes(extension)) {
            dispatch(showAlert(`Unsupported file format. ${CHAT_FILE_REQUIREMENTS_MESSAGE}`));
            if (fileInputRef.current) fileInputRef.current.value = "";
            set_file(undefined);
            return;
        }

        if (selectedFile.size > MAX_CHAT_FILE_SIZE_BYTES) {
            dispatch(
                showAlert(
                    `File is too large (${formatBytes(selectedFile.size)}). Max allowed is 1 MB per file.`,
                ),
            );
            if (fileInputRef.current) fileInputRef.current.value = "";
            set_file(undefined);
            return;
        }

        set_file(selectedFile);
    };

    const { chat: { chosenChatDetails, chosenGroupChatDetails, conversationId, rcChannelId }, auth: { userDetails } } = useAppSelector((state) => state);
    const rcTypingName = userDetails?.email ? toRocketChatUsername(userDetails.email) : '';
    const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sentTypingOnRef = useRef(false);

    const onBlur = () => {
        if (rcChannelId && rcTypingName) {
            sendRoomTyping(rcChannelId, rcTypingName, false);
            sentTypingOnRef.current = false;
            if (typingStopTimerRef.current) {
                clearTimeout(typingStopTimerRef.current);
                typingStopTimerRef.current = null;
            }
        }
    };

    const correctStyling = (text: any, tag: any) => {
        let temp1 = text.split(`<${tag}>`)
        let temp2 = temp1[0]
        for (let i = 1; i < temp1.length; i++) {
            let val = temp1[i].replace('<li><br></li><<', `</${tag}><<`)
            val = val.replace('<<', `</${tag}><`)
            temp2 += `<${tag}>${val}`
        }
        return temp2
    }

    const dispatchOutgoingHtml = async (message: string) => {
        const replyHtml = replyTo
            ? buildReplyQuoteHtml({
                  messageId: replyTo.messageId,
                  authorNameEscaped: escapeReplyText(replyTo.authorName),
                  excerptEscaped: escapeReplyText(cleanReplyExcerpt(replyTo.excerpt)),
              })
            : "";
        const safeMessage = sanitizeMessageHtml(`${replyHtml}${message}`);
        if (!safeMessage.trim()) {
            set_message("");
            return;
        }
        if (chosenChatDetails) {
            let convId = conversationId;
            if (!convId) {
                const dm = await getOrCreateDM(chosenChatDetails.userId);
                if (dm?.conversationId) {
                    convId = dm.conversationId;
                    dispatch(
                        setChatChannelInfo({
                            conversationId: dm.conversationId,
                            rcChannelId: dm.rcChannelId ?? null,
                        })
                    );
                }
            }
            if (convId) {
                const result = await apiSendDM(convId, safeMessage);
                if (result?.message) {
                    dispatch(addNewMessage(result.message));
                }
            }
        }
        if (chosenGroupChatDetails) {
            // Send group message via REST API
            const result = await apiSendGroup(chosenGroupChatDetails.groupId, safeMessage);
            if (result?.message) {
                dispatch(addNewMessage(result.message));
            }
        }
        set_message("");
        onCancelReply?.();
    };

    const sendPlainMessage = () => {
        const html = plainTextToMessageHtml(_message);
        if (!html) return;
        dispatchOutgoingHtml(html);
    };

    const sendMessage = () => {
        if (_message.trim()) {
            let arr = _message.split("<p>");
            let temp = "";
            for (let i = 0; i < arr.length; i++) {
                let val = arr[i].slice(0, -4);
                val = val.trim();
                if ((val && val !== "<br>") || temp) {
                    temp += `<p>${arr[i].slice(0, -4)}</p>`;
                }
            }
            if (!temp) {
                set_message("");
                return;
            }
            let arr1 = temp.split("<p>");
            let temp1 = "";
            for (let i = arr1.length - 1; i > -1; i--) {
                let val = arr1[i].slice(0, -4);
                val = val.trim();
                if ((val && val !== "<br>") || temp1) {
                    temp1 = `<p>${arr1[i].slice(0, -4)}</p>` + temp1;
                }
            }
            let message: any = correctStyling(temp1, 'ol')
            message = correctStyling(message, 'ul')
            message = correctStyling(message, 'h1')
            message = correctStyling(message, 'h2')
            message = correctStyling(message, 'h3')

            dispatchOutgoingHtml(message);
        }
    };

    const handleSendMessage = (e: any) => {
        if (e.key === 'Enter' || e.keyCode === 13) {
            if (!e.shiftKey && _message) {
                let arr = _message.split('<p>')
                let temp = ''
                for (let i = 0; i < arr.length; i++) {
                    let val = arr[i].slice(0, -4)
                    val = val.trim()
                    if ((val && val !== '<br>') || temp) {
                        temp += `<p>${arr[i].slice(0, -4)}</p>`
                    }
                }
                if (!temp) {
                    set_message('')
                    return
                }
                let arr1 = temp.split('<p>')
                let temp1 = ''
                for (let i = arr1.length - 1; i > -1; i--) {
                    let val = arr1[i].slice(0, -4)
                    val = val.trim()
                    if ((val && val !== '<br>') || temp1) {
                        temp1 = `<p>${arr1[i].slice(0, -4)}</p>` + temp1
                    }
                }
                let message: any = correctStyling(temp1, 'ol')
                message = correctStyling(message, 'ul')
                message = correctStyling(message, 'h1')
                message = correctStyling(message, 'h2')
                message = correctStyling(message, 'h3')

                dispatchOutgoingHtml(message);
            }
        }
    };

    // Ensure RC connection for typing whenever room/identity changes.
    useEffect(() => {
        resizeTextarea();
        resizeQuillEditor();

        if (!rcChannelId || !rcTypingName) return;
        void connectToRC();
    }, [rcChannelId, rcTypingName]);

    /** Keep typing ON while user types; stop only after inactivity. */
    useEffect(() => {
        if (!rcChannelId || !rcTypingName) return;
        const plain = _message
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (plain) {
            if (!sentTypingOnRef.current) {
                sendRoomTyping(rcChannelId, rcTypingName, true);
                sentTypingOnRef.current = true;
            }
            if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
            typingStopTimerRef.current = setTimeout(() => {
                sendRoomTyping(rcChannelId, rcTypingName, false);
                sentTypingOnRef.current = false;
                typingStopTimerRef.current = null;
            }, 2000);
        } else {
            if (typingStopTimerRef.current) {
                clearTimeout(typingStopTimerRef.current);
                typingStopTimerRef.current = null;
            }
            if (sentTypingOnRef.current) {
                sendRoomTyping(rcChannelId, rcTypingName, false);
                sentTypingOnRef.current = false;
            }
        }

        return () => {
            // Intentionally avoid forcing `typing=false` on every keystroke rerender;
            // inactivity timer or blur/chat-switch handles stop events smoothly.
        };
    }, [_message, rcChannelId, rcTypingName]);

    const [prevChosenChatDetails, set_prevChosenChatDetails] = useState(chosenChatDetails)
    const [prevChosenGroupChatDetails, set_prevChosenGroupChatDetails] = useState(chosenGroupChatDetails)

    useEffect(() => {
        set_message('');
        if (rcChannelId && userDetails?.email) {
            sendRoomTyping(rcChannelId, toRocketChatUsername(userDetails.email), false);
            sentTypingOnRef.current = false;
            if (typingStopTimerRef.current) {
                clearTimeout(typingStopTimerRef.current);
                typingStopTimerRef.current = null;
            }
        }
        set_prevChosenChatDetails(chosenChatDetails);
        set_prevChosenGroupChatDetails(chosenGroupChatDetails);
    }, [chosenChatDetails, chosenGroupChatDetails, rcChannelId, userDetails?.email]);

    useEffect(() => {
        const uploadFile = async () => {
            if (!file || uploadingFile) return;
            setUploadingFile(true);
            try {
                const response = await callApi('POST', 'auth/uploadChatFile', { email: userDetails.email }, file);
                if (response?.status !== 'SUCCESS' || !response?.chatFile) {
                    dispatch(showAlert(resolveUploadErrorMessage(response)));
                    return;
                }
                const message = `Chatfile: ${response.chatFile}#####${response.fileName || file.name}`;
                if (chosenChatDetails) {
                    let convId = conversationId;
                    if (!convId) {
                        const dm = await getOrCreateDM(chosenChatDetails.userId);
                        if (dm?.conversationId) {
                            convId = dm.conversationId;
                            dispatch(
                                setChatChannelInfo({
                                    conversationId: dm.conversationId,
                                    rcChannelId: dm.rcChannelId ?? null,
                                })
                            );
                        }
                    }
                    if (convId) {
                        const result = await apiSendDM(convId, message);
                        if (result?.message) dispatch(addNewMessage(result.message));
                    }
                } else if (chosenGroupChatDetails) {
                    const result = await apiSendGroup(chosenGroupChatDetails.groupId, message);
                    if (result?.message) dispatch(addNewMessage(result.message));
                }
                set_message("");
            } catch (e: any) {
                dispatch(showAlert(resolveUploadErrorMessage(e)));
            } finally {
                setUploadingFile(false);
                set_file(undefined);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
    
        void uploadFile();
    }, [file, uploadingFile, userDetails?.email, chosenChatDetails, chosenGroupChatDetails, conversationId, dispatch]);

    const handleEmojiSelect = (emoji: any) => {
        set_message((prev) => prev + emoji.native);
        setShowEmojiPicker(false);
    };

    const toggleEmojiPicker = () => {
        setShowEmojiPicker(!showEmojiPicker);
    };

    // Standard toolbar configuration
    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'align': [] }],
            ['link'],
            ['clean']
        ]
    };

    // Add custom buttons to toolbar after component mounts (rich editor only)
    useEffect(() => {
        if (theme === "light") return;
        const toolbar = document.querySelector('.ql-toolbar');
        if (toolbar && !toolbar.querySelector('.custom-attachment-btn')) {
            // Create attachment button
            const attachmentBtn = document.createElement('button');
            attachmentBtn.className = 'custom-attachment-btn';
            attachmentBtn.innerHTML = '📎';
            attachmentBtn.title = 'Attach file';
            attachmentBtn.style.cssText = 'margin-left: 8px; padding: 6px 8px; border: none; background: transparent; border-radius: 3px; cursor: pointer; font-size: 12px';
            attachmentBtn.onclick = (e) => {
                e.preventDefault();
                handleButtonClick();
            };

            // Create emoji button
            const emojiBtn = document.createElement('button');
            emojiBtn.className = 'custom-emoji-btn';
            emojiBtn.innerHTML = '😊';
            emojiBtn.title = 'Add emoji';
            emojiBtn.style.cssText = 'margin-left: 4px; padding: 6px 8px; border: none; background: transparent; border-radius: 3px; cursor: pointer; font-size: 12px;';
            attachmentBtn.onclick = (e) => {
                e.preventDefault();
                handleButtonClick();
            };

            // Add buttons to toolbar
            toolbar.appendChild(attachmentBtn);
            toolbar.appendChild(emojiBtn);
        }

        // Update emoji button click handler
        const emojiBtn = toolbar?.querySelector('.custom-emoji-btn');
        if (emojiBtn) {
            (emojiBtn as HTMLButtonElement).onclick = (e) => {
                e.preventDefault();
                setShowEmojiPicker(prev => !prev);
            };
        }
    }, [theme]);

    if (theme === "light") {
        return (
            <div className="relative w-full border-t border-stone-200 bg-wl-page px-2 py-1.5 sm:px-3">
                {replyTo ? (
                    <ReplyQuoteCard
                        className="mb-1"
                        authorName={replyTo.authorName}
                        excerpt={replyTo.excerpt}
                        variant="composer"
                        theme={theme}
                        onCancel={onCancelReply}
                    />
                ) : null}
                <div className="flex items-end gap-1.5 rounded-2xl border border-stone-200 bg-white px-2 py-1.5 shadow-sm">
                    <button
                        type="button"
                        onClick={handleButtonClick}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-wl-muted transition hover:bg-wl-page hover:text-wl-brand"
                        aria-label="Attach file"
                    >
                        <Paperclip className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={toggleEmojiPicker}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-wl-muted transition hover:bg-wl-page hover:text-wl-brand"
                        aria-label="Add emoji"
                    >
                        <Smile className="h-3.5 w-3.5" />
                    </button>
                    <textarea
                        ref={textareaRef}
                        value={_message}
                        onChange={(e) => {
                            set_message(e.target.value);
                            resizeTextarea(e.currentTarget);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                sendPlainMessage();
                            }
                        }}
                        onBlur={onBlur}
                        placeholder="Type a message…"
                        rows={1}
                        className="max-h-40 min-h-9 w-0 flex-1 resize-none overflow-y-auto bg-transparent py-1.5 text-[13px] leading-5 text-wl-ink placeholder:text-slate-400 outline-none sm:text-sm"
                    />
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileChange}
                        accept={ALLOWED_CHAT_FILE_EXTENSIONS.map(ext => `.${ext}`).join(",")}
                    />
                    <button
                        type="button"
                        onClick={sendPlainMessage}
                        disabled={!_message.trim() || uploadingFile}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wl-brand text-white shadow-sm transition hover:brightness-95 disabled:pointer-events-none disabled:opacity-35"
                        aria-label="Send message"
                    >
                        <Send className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                </div>
                {showEmojiPicker && (
                    <div className="absolute bottom-12 left-3 z-[1000]">
                        <Picker data={data} onEmojiSelect={handleEmojiSelect} />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="w-full flex items-center border-t border-transparent p-4 pb-12 pt-0 sm:pb-4">
            <div className="relative w-full">
                {replyTo ? (
                    <ReplyQuoteCard
                        className="mb-2"
                        authorName={replyTo.authorName}
                        excerpt={replyTo.excerpt}
                        variant="composer"
                        theme={theme}
                        onCancel={onCancelReply}
                    />
                ) : null}
                <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    className="chat-composer-quill flex w-full flex-col-reverse rounded-md bg-black"
                    value={_message}
                    onChange={(value) => {
                        set_message(value);
                        requestAnimationFrame(resizeQuillEditor);
                    }}
                    onKeyDown={handleSendMessage}
                    onBlur={onBlur}
                    modules={modules}
                />

                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                    accept={ALLOWED_CHAT_FILE_EXTENSIONS.map(ext => `.${ext}`).join(",")}
                />

                {showEmojiPicker && (
                    <div
                        style={{
                            position: "absolute",
                            bottom: "60px",
                            left: "10px",
                            zIndex: 1000,
                        }}
                    >
                        <Picker data={data} onEmojiSelect={handleEmojiSelect} />
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={sendMessage}
                className="ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#31B099] text-white"
                aria-label="Send message"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="white"
                    viewBox="0 0 24 24"
                    width="20px"
                    height="20px"
                >
                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                </svg>
            </button>
        </div>
    );
};

export default NewMessageInput;