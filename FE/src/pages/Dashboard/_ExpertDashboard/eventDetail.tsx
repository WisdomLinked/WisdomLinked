import React, { useState, useEffect } from "react";
import { formatDateYYYY_MM_DD_h_m } from "../../../actions/common";
import { getAvatarTitle } from "../../../actions/common";
import {profileImageFetch} from "../../../api/api";

const EventDetail = ({
    image,
    name,
    description,
    start,
    duration,
    title,
    price,
    paidBy,
    theme = "dark",
}: any) => {
    const [imageSrc, setImageSrc] = useState<any | null>(null);

    useEffect(() => {
        const fetchImage = async () => {
            if (image) {
                try {
                    const src = await profileImageFetch(image,"medium");
                    setImageSrc(src);
                } catch (error) {
                    console.error("Error fetching image:", error);
                }
            }
        };

        fetchImage();
    }, [image]);
    return (
        <div className="w-full flex flex-col space-y-6 sm:space-y-0 sm:flex-row sm:space-x-6 sm:justify-center sm:items-center">

            <div className={`w-[200px] h-[200px] mx-auto rounded-md flex items-center justify-center overflow-clip ${theme === "light" ? "bg-slate-100" : "bg-darkgrey"}`}>
                {
                    image ?
                        <img src={imageSrc} className="w-full h-full object-cover object-center" /> :
                        <div className={`w-[100px] h-[100px] rounded-full border-2 text-5xl font-bold !flex items-center justify-center ${theme === "light" ? "border-slate-200 text-slate-700 bg-white" : "border-lightgrey text-white"}`}>
                            {getAvatarTitle(name)}
                        </div>
                }
            </div>
            <div className="flex flex-col space-y-1">
                <div className={`text-2xl font-bold ${theme === "light" ? "text-sky-700" : "text-[#234C6A]"}`}>{title}</div>
                <div className={`text-xl font-bold ${theme === "light" ? "text-slate-900" : "text-white"}`}>{name}</div>
                <div className={`text-base pl-4 ${theme === "light" ? "text-slate-600" : ""}`}>{description}</div>
                <div className={theme === "light" ? "text-slate-700" : ""}><span className={`${theme === "light" ? "text-slate-900" : "text-white"} font-bold`}>Starts at : </span> {formatDateYYYY_MM_DD_h_m(start)}</div>
                <div className={theme === "light" ? "text-slate-700" : ""}><span className={`${theme === "light" ? "text-slate-900" : "text-white"} font-bold`}>Duration  : </span> {duration || price / 10} min</div>
                <div className={theme === "light" ? "text-slate-700" : ""}><span className={`${theme === "light" ? "text-slate-900" : "text-white"} font-bold`}>Price  : </span> ${price}</div>
                <div className={theme === "light" ? "text-slate-700" : ""}><span className={`${theme === "light" ? "text-slate-900" : "text-white"} font-bold`}>Paid by  : </span> {paidBy}</div>
            </div>
        </div>
    );
};

export default EventDetail;
