import React from "react";
import { formatDateYYYY_MM_DD_h_m } from "../../../actions/common";
import { getAvatarTitle } from "../../../actions/common";

const EventDetail = ({
    image,
    name,
    description,
    start,
    duration,
    title,
    price,
    paidBy
}: any) => {
    return (
        <div className="w-full flex flex-col space-y-6 sm:space-y-0 sm:flex-row sm:space-x-6 sm:justify-center sm:items-center">
            <div className="w-[200px] h-[200px] mx-auto bg-darkgrey rounded-md flex items-center justify-center overflow-clip">
                {
                    image ?
                        <img src={`${process.env.REACT_APP_SERVER_URL}/${image}`} className="w-full h-full object-cover object-center" /> :
                        <div className="w-[100px] h-[100px] rounded-full border-2 border-lightgrey text-5xl text-white font-bold !flex items-center justify-center">
                            {getAvatarTitle(name)}
                        </div>
                }
            </div>
            <div className="flex flex-col space-y-1">
                <div className="text-2xl font-bold text-green">{title}</div>
                <div className="text-xl text-white font-bold">{name}</div>
                <div className="text-base pl-4">{description}</div>
                <div><span className="text-white font-bold">Starts at : </span> {formatDateYYYY_MM_DD_h_m(start)}</div>
                <div><span className="text-white font-bold">Duration  : </span> {duration || price / 10} min</div>
                <div><span className="text-white font-bold">Price  : </span> ${price}</div>
                <div><span className="text-white font-bold">Paid by  : </span> {paidBy}</div>
            </div>
        </div>
    );
};

export default EventDetail;
