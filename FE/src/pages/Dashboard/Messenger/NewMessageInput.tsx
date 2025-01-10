import React, { useState, useEffect } from "react";
import { useAppSelector } from "../../../store";
import { notifyTyping, sendDirectMessage, sendGroupMessage } from "../../../socket/socketConnection";
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

const NewMessageInput: React.FC = () => {
    const [_message, set_message] = useState("");
    const [typing, set_typing] = useState(0);

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

            if (chosenChatDetails) {
                console.log("Sending direct message...");
                console.log("Message content:", message);
                console.log("Receiver User ID:", chosenChatDetails.userId);
                sendDirectMessage({
                    message,
                    receiverUserId: chosenChatDetails.userId!,
                });
            }

            if (chosenGroupChatDetails) {
                console.log("Sending group message...");
                console.log("Message content:", message);
                console.log("Group Chat ID:", chosenGroupChatDetails.groupId);
                sendGroupMessage({
                    message,
                    groupChatId: chosenGroupChatDetails.groupId,
                });
            }
            set_message("");
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

    return (
        <div className="w-full p-4 pt-0 pb-12 sm:pb-4 flex items-center">
            <ReactQuill
                theme="snow"
                className="w-full bg-black flex flex-col-reverse rounded-md"
                value={_message}
                onChange={set_message}
                onKeyDown={handleSendMessage}
                onBlur={onBlur}
            />
            <button
                onClick={sendMessage}
                className="ml-2 flex items-center justify-center"
                style={{
                    backgroundColor: "#31B099",
                    borderRadius: "50%",
                    width: "40px",
                    height: "40px",
                }}
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
