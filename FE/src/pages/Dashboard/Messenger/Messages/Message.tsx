// Message.tsx (refactored to use image URLs directly and clean props)
import React from "react";
import Avatar from "../../../../components/Avatar";
import { formatDateHH_MM_AMPM } from "../../../../actions/common";

const Message = ({
  content,
  userId,
  username,
  image,
  role,
  status,
  sameAuthor,
  date,
  incomingMessage,
  isFriend,
  disableBookButton,
  myRole,
  hideDate,
  hiddenDropDown
}: {
  content: string;
  userId?: string;
  username: string;
  image?: string;
  role?: string;
  status?: string;
  sameAuthor: boolean;
  date: string;
  incomingMessage: boolean;
  isFriend?: boolean;
  disableBookButton?: boolean;
  myRole: string;
  hideDate: boolean;
  hiddenDropDown?: boolean;
}) => {
  return (
    <div className={`flex ${incomingMessage ? "justify-start" : "justify-end"} mb-2 px-4`}>
      {!sameAuthor && incomingMessage && (
        <Avatar username={username} image={image} size="small" />
      )}
      <div className="max-w-[70%] bg-darkgrey text-white rounded-xl px-4 py-2 ml-2">
        {!hideDate && (
          <div className="text-xs text-grey mb-1">
            {formatDateHH_MM_AMPM(new Date(date))}
          </div>
        )}
        <div>{content}</div>
      </div>
    </div>
  );
};

export default Message;
