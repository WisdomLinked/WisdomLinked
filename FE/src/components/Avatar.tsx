import React from "react";
import { getAvatarTitle } from "../actions/common";

const Avatar = ({ username, isOnline, image, size = 'small', borderClass = '' }: {
    username: string,
    isOnline?: boolean,
    image?: any,
    size?: string,
    borderClass?: any
}) => {
    //console.log("Avatar component props:", { username, isOnline, image, size, borderClass });
    return (
        <div className={`${size === 'small' ? 'w-10 h-10' : 'w-14 h-14'} rounded-full !flex justify-center items-center border-2 ${borderClass ? borderClass : 'border-lightgrey'} text-lightgrey relative text-lg font-bold`}>
            {
                image ?
                    <div className="rounded-full overflow-hidden">
                        <img src={`${process.env.REACT_APP_SERVER_URL}/${image}`} className="w-full h-full object-center object-cover" />
                    </div> :
                    getAvatarTitle(username || '')
            }
            {
                isOnline ?
                    <div className='absolute -bottom-[1px] -right-[1px] w-3 h-3 rounded-full bg-green' /> :
                    null
            }
        </div>
    )
};

export default Avatar;
