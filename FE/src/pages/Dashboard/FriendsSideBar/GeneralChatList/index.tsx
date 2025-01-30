import { useState, useEffect } from "react";
import { useAppSelector } from "../../../../store";
import GeneralChatListItem from "./GeneralChatListItem";
import { styled } from "@mui/system";

const MainContainer = styled("div")({
    flexGrow: 1,
    width: "100%",
    margin: "20px 0",
});

const SearchInput = styled("input")({
    width: "100%",
    padding: "10px",
    marginBottom: "20px",
    borderRadius: "5px",
    border: "1px solid #444",
    fontSize: "16px",
    backgroundColor: "#222",
    color: "#fff",
    outline: "none",
    caretColor: "#00ffff",
    "::placeholder": {
        color: "#888",
    },
});

const GeneralChatList = () => {
    const { auth: { userDetails } } = useAppSelector((state) => state);
    const [updatedGeneralChats, set_updatedGeneralChats] = useState<any>([])
    const [searchQuery, setSearchQuery] = useState<string>("");

    useEffect(() => {
        let temp: any = []
        let globalChat: any, adminChat: any, generalChat: any
        userDetails.generalChats?.forEach((item: any) => {
            const chat = {
                ...item,
                missedChats: userDetails?.missedChats?.[item?._id] || 0
            }
            if (item.name === 'Global Chat') {
                chat.type = 'global'
                globalChat = chat
            } else if (item.name === 'Admin') {
                chat.type = 'admin'
                adminChat = chat
            } else if (item.admin._id === userDetails.userId) {
                chat.type = 'mine'
                generalChat = chat
            } else {
                temp.push(chat)
            }
        })
        if (generalChat) {
            temp.unshift(generalChat)
        }
        if (globalChat) {
            temp.unshift(globalChat)
        }
        if (adminChat) {
            temp.unshift(adminChat)
        }
        set_updatedGeneralChats([...temp])

    }, [userDetails])

    const filteredGeneralChats = updatedGeneralChats.filter((chat: any) =>
        chat.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <MainContainer>
            {/* Search bar identical in style & behavior to FriendsList */}
            <SearchInput
                type="text"
                placeholder="Search by user name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />

            {filteredGeneralChats.map((chat: any) => (
                <GeneralChatListItem
                    chat={chat}
                    key={chat._id}
                    missedChats={chat.missedChats}
                    lastChatDate={chat.updatedAt}
                />
            ))}
        </MainContainer>
    );
};

export default GeneralChatList;
