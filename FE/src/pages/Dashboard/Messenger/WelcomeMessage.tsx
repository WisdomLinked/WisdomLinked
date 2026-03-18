import React from "react";
import Robot from "./robot.gif";

const WelcomeMessage = ({ theme = "dark" }: any) => {
    return (
        <div
            className={
                theme === "light"
                    ? "w-full h-full flex flex-col items-center justify-center p-6 text-center bg-white rounded-2xl border border-slate-200 shadow-sm"
                    : "w-full h-full flex flex-col items-center justify-center p-6 text-center"
            }
        >
            <img src={Robot} alt="robot greeting welcome" className="h-56 w-auto" />
            <div className={theme === "light" ? "mt-4 text-[15px] font-semibold text-slate-800" : "mt-4 text-[15px] font-semibold text-white"}>
                To start chatting — select a chat from the left
            </div>
            <div className={theme === "light" ? "mt-1 text-[13px] text-slate-500" : "mt-1 text-[13px] text-lightgrey"}>
                You can open a private chat or join a community.
            </div>
        </div>
    );
};

export default WelcomeMessage;