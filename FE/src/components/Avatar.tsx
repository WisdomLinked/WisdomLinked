import React, {useEffect, useState} from "react";
import { getAvatarTitle } from "../actions/common";
import {profileImageFetch} from "../api/api";

const Avatar = ({ username, isOnline, image, size = 'small', borderClass = '' }: {
    username: string,
    isOnline?: boolean,
    image?: any,
    size?: string,
    borderClass?: any
}) => {
    const [imageSrc, setImageSrc] = useState<any | null>(null);
    useEffect(() => {
        const fetchImage = async () => {
            if (image) {
                try {
                    const src = await profileImageFetch(image,size);
                    setImageSrc(src);
                } catch (error) {
                    console.error("Error fetching image:", error);
                }
            }
        };

        fetchImage();
    }, [image]);
    //console.log("Avatar component props:", { username, isOnline, image, size, borderClass });
    return (
        <div className={`${size === 'small' ? 'w-10 h-10' : 'w-14 h-14'} rounded-full !flex justify-center items-center border-2 ${borderClass ? borderClass : 'border-lightgrey'} text-lightgrey relative text-lg font-bold`}>
            {
                image ?
                    <div className="rounded-full overflow-hidden">
                        <img src={imageSrc} className="w-full h-full object-center object-cover" />
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
