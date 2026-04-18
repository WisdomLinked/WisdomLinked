// import React, { useEffect } from "react";
// import { styled } from "@mui/system";
// import { useAppSelector } from "../../../store";
// import WelcomeMessage from "./WelcomeMessage";
// import ChatDetails from "./ChatDetails";
// import { setChosenGroupChatDetails } from "../../../actions/chatActions";
// import { useDispatch } from "react-redux";
//
// const Messenger = () => {
//   const {chat: { chosenChatDetails, chosenGroupChatDetails }, friends: { groupChatList }} = useAppSelector((state) => state);
//   const dispatch = useDispatch()
//   useEffect(() => {
//     if (chosenGroupChatDetails) {
//       const selectedGroupChat:any = groupChatList.find((x: any) => x.groupId === chosenGroupChatDetails.groupId)
//       if (selectedGroupChat) {
//         console.log(selectedGroupChat, 'UPDATED GROUP CHAT DETAIL')
//         dispatch(setChosenGroupChatDetails(selectedGroupChat))
//       }
//     }
//   }, [groupChatList])
//
//   return (
//     <div className="w-full h-full flex">
//       <div className="w-full flex flex-grow bg-darkgrey-1">
//         {chosenChatDetails?.userId || chosenGroupChatDetails?.groupId ?  <ChatDetails/> : <WelcomeMessage/>}
//       </div>
//     </div>
//   );
// };
//
// export default Messenger;

import React, { useEffect } from "react";
import { useAppSelector } from "../../../store";
import WelcomeMessage from "./WelcomeMessage";
import ChatDetails from "./ChatDetails";
import { setChosenGroupChatDetails } from "../../../actions/chatActions";
import { useDispatch } from "react-redux";
import { ensureChatNotificationsEnabled } from "../../../utils/chatBrowserNotifications";

const Messenger = ({
  videoChaton,
  theme = "dark",
}: any) => {
  // Extract relevant data from the store
  const {
    chat: { chosenChatDetails, chosenGroupChatDetails },
    friends: { groupChatList }
  } = useAppSelector((state) => state);

  const dispatch = useDispatch();

  /** Ask for desktop notification permission in the same user gesture chain as opening a chat. */
  useEffect(() => {
    if (chosenChatDetails?.userId || chosenGroupChatDetails?.groupId) {
      void ensureChatNotificationsEnabled();
    }
  }, [chosenChatDetails?.userId, chosenGroupChatDetails?.groupId]);

  // Keep chosen group in sync with friends.groupChatList when the server sends a newer
  // snapshot (e.g. participants). Do not churn when ids match as strings — that was
  // clearing messages / making the active chat feel like it "disappeared" after send.
  useEffect(() => {
    if (!chosenGroupChatDetails?.groupId) return;

    const gid = String(chosenGroupChatDetails.groupId);
    const selectedGroupChat: any = groupChatList.find(
      (x: any) => String(x.groupId) === gid || String(x._id) === gid
    );
    if (!selectedGroupChat) return;

    const curKey = String(
      chosenGroupChatDetails._id ?? chosenGroupChatDetails.groupId ?? ''
    );
    const nextKey = String(selectedGroupChat._id ?? selectedGroupChat.groupId ?? '');
    if (!nextKey || nextKey === curKey) return;

    dispatch(
      setChosenGroupChatDetails({
        ...chosenGroupChatDetails,
        ...selectedGroupChat,
        groupId: gid,
        groupName:
          selectedGroupChat.groupName ||
          selectedGroupChat.name ||
          chosenGroupChatDetails.groupName,
      } as any)
    );
  }, [groupChatList, chosenGroupChatDetails, dispatch]);

  return (
      <div className="w-full h-full flex min-h-0">
        <div className={`w-full min-h-0 flex flex-1 flex-col ${theme === "light" ? "bg-wl-chatGold text-slate-900" : "bg-darkgrey-1"}`}>
          {chosenChatDetails?.userId || chosenGroupChatDetails?.groupId ? (
              <ChatDetails videoChaton = {videoChaton} theme={theme}/>
          ) : (
              <WelcomeMessage theme={theme} />
          )}
        </div>
      </div>
  );
};

export default Messenger;

