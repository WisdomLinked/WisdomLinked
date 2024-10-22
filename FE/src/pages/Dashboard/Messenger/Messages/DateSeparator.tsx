const DateSeparator = ({ date }: { date: string }) => {
    return (
        <div className="w-full bg-grey h-[1px] relative mt-5 mb-4">
            <div className="bg-darkgrey absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%] text-lightgrey px-1 text-base">{new Date(date).toDateString()}</div>
        </div>
    );
};

export default DateSeparator;
