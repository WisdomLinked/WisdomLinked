import React from "react";

interface LegendCalendarProps {
    showTimeSlotSelector: boolean;
    toggleTimeSlotSelector: () => void;
    selectedIndex: number;
    setSelectedIndex: (index: number) => void;
    duration: number;
    setDuration: (duration: number) => void;
    timeSlotIndices: Array<{index: number, time: string}>;
    durations: number[];
    selectedUser?: any;
    hidePriceInDurationSelection?: boolean;
}

const LegendCalendar: React.FC<LegendCalendarProps> = ({ 
    showTimeSlotSelector, 
    toggleTimeSlotSelector,
    selectedIndex,
    setSelectedIndex,
    duration,
    setDuration,
    timeSlotIndices,
    durations,
    selectedUser,
    hidePriceInDurationSelection = false
}) => {
    return (
        <div className="flex flex-row justify-between gap-8 mb-5 w-full"> 
            {/* Left side - Availability legend */}
            <div className="flex flex-col gap-2">
                <div className="text-lg font-bold text-white mb-1">
                    Availability
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-5 h-5 bg-[#f94144] rounded"></div>
                    <span className="text-white">No</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-5 h-5 bg-[#f9a826] rounded"></div>
                    <span className="text-white">Partial</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-5 h-5 bg-[#30B199] rounded"></div>
                    <span className="text-white">Full</span>
                </div>
                <button
                    onClick={toggleTimeSlotSelector}
                    className="mt-2 py-2 px-4 border-2 border-[#1e90ff] rounded bg-transparent text-white cursor-pointer text-center"
                >
                    {showTimeSlotSelector ? "hide time slots" : "search time slots"}
                </button>
            </div>
            
            {/* Right side - selectors */}
            {showTimeSlotSelector && (
                <div className="flex flex-row items-end gap-3">
                    <button
                        className="bg-black text-white px-3 py-2 rounded h-10"
                        onClick={() => setSelectedIndex(-1)}
                    >
                        Clear time
                    </button>
                    
                    <select
                        className="bg-black text-white rounded px-3 py-2 h-10"
                        value={selectedIndex >= 0 ? selectedIndex : ""}
                        onChange={(e) => setSelectedIndex(parseInt(e.target.value))}
                    >
                        <option value="" disabled>
                            Select Time Slot
                        </option>
                        {timeSlotIndices.map((slot) => (
                            <option key={slot.index} value={slot.index}>
                                {slot.time}
                            </option>
                        ))}
                    </select>
                    
                    <select
                        className="bg-black text-white rounded px-3 py-2 h-10"
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value))}
                    >
                        {durations.map((val) => (
                            <option key={val} value={val}>
                                {val} min{" "}
                                {hidePriceInDurationSelection ? "" : `( $${(val * (selectedUser?.price || 0)) / 60} )`}
                            </option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
};

export default LegendCalendar;