/**
 * Community system line (join/leave/remove): centered pill only.
 * Do not use a 1px-tall wrapper with an absolutely positioned badge — that collapses layout and overlaps chat bubbles.
 */
const ChatSystemNotice = ({ text, theme = 'dark' }: { text: string; theme?: 'dark' | 'light' }) => {
    return (
        <div className="flex w-full justify-center px-2 py-2.5">
            <div
                className={`max-w-[min(100%,92vw)] rounded-full px-3 py-1.5 text-center text-[12px] leading-snug ${
                    theme === 'light'
                        ? 'border border-stone-200 bg-[#EDEAE4] text-stone-700 shadow-sm'
                        : 'border border-slate-600 bg-darkgrey text-lightgrey'
                }`}
            >
                {text}
            </div>
        </div>
    );
};

export default ChatSystemNotice;
