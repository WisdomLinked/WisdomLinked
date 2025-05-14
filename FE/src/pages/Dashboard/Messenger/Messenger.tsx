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

const Messenger = ({
  videoChaton
}: any) => {
  // Extract relevant data from the store
  const {
    chat: { chosenChatDetails, chosenGroupChatDetails },
    friends: { groupChatList }
  } = useAppSelector((state) => state);

  const dispatch = useDispatch();

  useEffect(() => {
    if (!chosenGroupChatDetails) return;

    const selectedGroupChat: any = groupChatList.find(
        (x: any) => x.groupId === chosenGroupChatDetails.groupId
    );

    if (
        selectedGroupChat &&
        selectedGroupChat._id !== chosenGroupChatDetails._id
    ) {
      console.log(selectedGroupChat, "UPDATED GROUP CHAT DETAIL");
      dispatch(setChosenGroupChatDetails(selectedGroupChat));
    }
  }, [groupChatList, chosenGroupChatDetails, dispatch]);

  return (
      <div className="w-full h-full flex">
        <div className="w-full flex flex-grow bg-darkgrey-1">
          {chosenChatDetails?.userId || chosenGroupChatDetails?.groupId ? (
              <ChatDetails videoChaton = {videoChaton}/>
          ) : (
              <WelcomeMessage />
          )}
        </div>
      </div>
  );
};

export default Messenger;

