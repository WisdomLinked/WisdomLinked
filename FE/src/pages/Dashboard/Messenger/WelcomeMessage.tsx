import React from "react";

const WelcomeMessage = ({ theme = "dark" }: any) => {
    return (
        <div
            className={
                theme === "light"
                    ? "w-full h-full flex flex-col items-center justify-center p-6 text-center bg-wl-page rounded-2xl border border-stone-200 shadow-sm"
                    : "w-full h-full flex flex-col items-center justify-center p-6 text-center"
            }
        >
            <div className={theme === "light" ? "text-[15px] font-semibold text-wl-ink" : "text-[15px] font-semibold text-white"}>
                {theme === "light"
                  ? "Choose a chat from the list to get started."
                  : "To start chatting — select a chat from the left"}
            </div>
            <div className={theme === "light" ? "mt-1 text-[13px] text-wl-muted" : "mt-1 text-[13px] text-lightgrey"}>
                {theme === "light"
                  ? "Community rooms and direct messages open in this panel."
                  : "You can open a private chat or join a community."}
            </div>
        </div>
    );
};

export default WelcomeMessage;