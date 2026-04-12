import React, { useState, useEffect, useRef } from "react";
import { Paperclip, Send } from "lucide-react";
import { useAppSelector } from "../../../store";
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { callApi } from "../../../api/api";
import { showAlert } from "../../../actions/alertActions";
import { useDispatch } from "react-redux";

function plainTextToMessageHtml(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return "";
    const escaped = trimmed
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    return "<p>" + escaped.replace(/\n/g, "<br>") + "</p>";
}

const NewMessageInput: React.FC<any> = ({ theme = "dark" }: any) => {
    const [_message, set_message] = useState("");
    const [typing, set_typing] = useState(0);
    const dispatch = useDispatch();
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [file, set_file] = useState<File | undefined>(undefined)

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const quillRef = useRef<ReactQuill | null>(null);
    
    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            set_file(selectedFile);
        }
    };

    const onBlur = () => set_typing(0);

    const { chat: { chosenChatDetails, chosenGroupChatDetails }, auth: { userDetails } } = useAppSelector((state) => state);

    const correctStyling = (text: any, tag: any) => {
        let temp1 = text.split(`<${tag}>`)
        let temp2 = temp1[0]
        for (let i = 1; i < temp1.length; i++) {
            let val = temp1[i].replace('<li><br></li><<', `</${tag}><`)
            val = val.replace('<<', `</${tag}><`)
            temp2 += `<${tag}>${val}`
        }
        return temp2
    }

    const dispatchOutgoingHtml = (message: string) => {
        if (chosenChatDetails) {
            sendDirectMessage({
                message,
                receiverUserId: chosenChatDetails.userId!,
            });
        }
        if (chosenGroupChatDetails) {
            sendGroupMessage({
                message,
                groupChatId: chosenGroupChatDetails.groupId,
            });
        }
        set_message("");
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
            let message: any = correctStyling(temp1, "ol");
            message = correctStyling(message, "ul");
            message = correctStyling(message, "h1");
            message = correctStyling(message, "h2");
            message = correctStyling(message, "h3");

            dispatchOutgoingHtml(message);
        }
    };

    const handleSendMessage = (e: any) => {
        if (e.key === 'Enter' || e.keyCode === 13) {
            if (!e.shiftKey && _message) {
                let arr = _message.split('<p>')
                console.log(arr)
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
        } else {
            set_typing(typing + 1)
        }
    };

    useEffect(() => {
        if (chosenChatDetails?.userId && _message) {
            console.log('00000')
            notifyTyping({
                chatId: null,
                receiverId: chosenChatDetails.userId!,
                typing: typing ? true : false,
            });
        } else if (chosenGroupChatDetails?.groupId && _message) {
            console.log('11111', typing)
            notifyTyping({
                chatId: chosenGroupChatDetails?.groupId,
                receiverId: null,
                typing: typing ? true : false,
            });
        }
        let timer = setTimeout(() => {
            set_typing(0)
        }, 3000)
        return (() => clearTimeout(timer))
    }, [typing, chosenChatDetails?.userId, chosenGroupChatDetails?.groupId]);

    const [prevChosenChatDetails, set_prevChosenChatDetails] = useState(chosenChatDetails)
    const [prevChosenGroupChatDetails, set_prevChosenGroupChatDetails] = useState(chosenGroupChatDetails)

    useEffect(() => {
        set_message('')
        set_typing(0)
        if (prevChosenChatDetails?.userId) {
            notifyTyping({
                chatId: null,
                receiverId: prevChosenChatDetails.userId!,
                typing: false,
            });
        } else if (prevChosenGroupChatDetails?.groupId) {
            notifyTyping({
                chatId: prevChosenGroupChatDetails?.groupId,
                receiverId: null,
                typing: false,
            });
        }
        set_prevChosenChatDetails(chosenChatDetails)
        set_prevChosenGroupChatDetails(chosenGroupChatDetails)
    }, [chosenChatDetails, chosenGroupChatDetails])

    useEffect(() => {
        const uploadFile = async () => {
            if (file) {
                console.log("Uploading file:", file);
                const response = await callApi('POST', 'auth/uploadChatFile', { email: userDetails.email }, file);
                if (response.status === 'SUCCESS') {
                    console.log('File uploaded successfully:', response.chatFile);
                    let message = "Chatfile: " + response.chatFile + "#####" + file.name;
                    if (chosenChatDetails) {
                        sendDirectMessage({
                            message,
                            receiverUserId: chosenChatDetails.userId!,
                        });
                    }
    
                    if (chosenGroupChatDetails) {
                        sendGroupMessage({
                            message,
                            groupChatId: chosenGroupChatDetails.groupId
                        })
                    }
                    set_message("");
                } else {
                    dispatch(showAlert(response.error));
                }
            }
        };
    
        uploadFile();
    }, [file]);

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
            ['link', 'image'],
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
            <div className="w-full border-t border-wl-line bg-white px-3 py-2 sm:px-4 sm:pb-3">
                <div className="flex items-end gap-2 rounded-full bg-slate-100 px-3 py-1.5">
                    <button
                        type="button"
                        onClick={handleButtonClick}
                        className="mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-wl-muted transition hover:bg-white hover:text-wl-brand"
                        aria-label="Attach file"
                    >
                        <Paperclip className="h-4 w-4" />
                    </button>
                    <textarea
                        value={_message}
                        onChange={(e) => {
                            set_message(e.target.value);
                            set_typing((t) => t + 1);
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
                        className="min-h-[40px] max-h-28 w-0 flex-1 resize-none bg-transparent text-xs text-wl-ink placeholder:text-slate-400 outline-none sm:text-sm"
                    />
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <button
                        type="button"
                        onClick={sendPlainMessage}
                        disabled={!_message.trim()}
                        className="mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wl-brand text-white shadow-sm transition hover:brightness-95 disabled:pointer-events-none disabled:opacity-35"
                        aria-label="Send message"
                    >
                        <Send className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full flex items-center border-t border-transparent p-4 pb-12 pt-0 sm:pb-4">
            <div className="relative w-full">
                <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    className="flex w-full flex-col-reverse rounded-md bg-black"
                    value={_message}
                    onChange={set_message}
                    onKeyDown={handleSendMessage}
                    onBlur={onBlur}
                    modules={modules}
                />

                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={handleFileChange}
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