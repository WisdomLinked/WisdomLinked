import React from "react";
import { getAvatarTitle } from "../actions/common";

const Avatar = ({ username, isOnline, image, size = 'small', borderClass = '' }: {
    username: string,
    isOnline?: boolean,
    image?: any,
    size?: string,
    borderClass?: any
}) => {

    return (
        <div
            className={`${
                size === 'small' ? 'w-10 h-10 text-base' : 'w-14 h-14 text-xl'
            } rounded-full !flex justify-center items-center border-2 ${
                borderClass ? borderClass : 'border-[#BCD6EA]'
            } bg-[#E8EEF4] text-[#234C6A] relative font-semibold shadow-inner`}
        >
            {
                image ?
                    <div className="w-full h-full rounded-full overflow-hidden">
                        <img src={image} className="w-full h-full object-center object-cover aspect-square" />
                    </div> :
                    getAvatarTitle(username || '')
            }
            {
                isOnline ?
                    <span
                        className="pointer-events-none absolute bottom-0 right-0 z-10 h-3 w-3 shrink-0 rounded-full bg-[#22c55e] shadow-[0_0_0_2px_#ffffff]"
                        aria-hidden
                    /> :
                    null
            }
        </div>
    )
};

export default Avatar;
