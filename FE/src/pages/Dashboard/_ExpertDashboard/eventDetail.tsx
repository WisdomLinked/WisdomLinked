import React from "react";
import { formatDateYYYY_MM_DD_h_m } from "../../../actions/common";

/**
 * EventDetail — the session "around the card" facts for the expert calendar.
 * The student's background (photo, name, email) lives in the shared ProfileCard,
 * opened via the calendar's "View student card" action — not duplicated here.
 */
const EventDetail = ({
    start,
    duration,
    title,
    price,
    paidBy,
    theme = "dark",
}: any) => {
    return (
        <div className="w-full flex flex-col space-y-1">
            <div className={`text-2xl font-bold ${theme === "light" ? "text-sky-700" : "text-[#234C6A]"}`}>{title}</div>
            <div className={theme === "light" ? "text-slate-700" : ""}><span className={`${theme === "light" ? "text-slate-900" : "text-white"} font-bold`}>Starts at : </span> {formatDateYYYY_MM_DD_h_m(start)}</div>
            <div className={theme === "light" ? "text-slate-700" : ""}><span className={`${theme === "light" ? "text-slate-900" : "text-white"} font-bold`}>Duration  : </span> {duration || price / 10} min</div>
            <div className={theme === "light" ? "text-slate-700" : ""}><span className={`${theme === "light" ? "text-slate-900" : "text-white"} font-bold`}>Price  : </span> ${price}</div>
            <div className={theme === "light" ? "text-slate-700" : ""}><span className={`${theme === "light" ? "text-slate-900" : "text-white"} font-bold`}>Paid by  : </span> {paidBy}</div>
        </div>
    );
};

export default EventDetail;
