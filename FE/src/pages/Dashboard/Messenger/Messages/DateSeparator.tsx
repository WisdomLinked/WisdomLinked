const DateSeparator = ({ date, theme = "dark" }: { date: string; theme?: "dark" | "light" }) => {
    return (
        <div className={`w-full h-[1px] relative mt-5 mb-4 ${theme === "light" ? "bg-slate-200" : "bg-grey"}`}>
            <div className={`${theme === "light" ? "bg-white text-slate-500 border border-slate-200" : "bg-darkgrey text-lightgrey"} absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%] px-2 py-0.5 rounded-full text-[12px]`}>
                {new Date(date).toDateString()}
            </div>
        </div>
    );
};

export default DateSeparator;
