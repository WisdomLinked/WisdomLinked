import React, { useState } from "react";
import { getAvatarTitle } from "../actions/common";

const Avatar = ({
  username,
  isOnline,
  image,
  size = 'small',
  borderClass = ''
}: {
  username: string;
  isOnline?: boolean;
  image?: string;
  size?: string;
  borderClass?: string;
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClass = size === 'small' ? 'w-10 h-10' : 'w-14 h-14';
  const border = borderClass || 'border-lightgrey';

  return (
    <div
      className={`${sizeClass} rounded-full flex justify-center items-center border-2 ${border} text-lightgrey relative text-lg font-bold bg-lightgrey overflow-hidden`}
    >
      {image && !imageError ? (
        <img
          src={image}
          alt="avatar"
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        getAvatarTitle(username || "")
      )}

      {isOnline && (
        <div className="absolute -bottom-[1px] -right-[1px] w-3 h-3 rounded-full bg-green" />
      )}
    </div>
  );
};

export default Avatar;

