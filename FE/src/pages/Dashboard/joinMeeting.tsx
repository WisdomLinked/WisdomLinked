import React, { useEffect, useState } from "react";
import {getGroupChatById, joinGroupChat} from "../../api/api"
import { useAppSelector } from "../../store";
import Payment from "./_CustomerDashboard/payment";
import { SetLoadingStatus } from "../../actions/appActions";
import { useLocation } from "react-router-dom";
import queryString from "query-string";
import { set } from "date-fns";
import { group } from "console";




const JoinMeeting = () => {

    const [meetingId, setMeetingId] = useState<string>("");
    const { auth: { userDetails } } = useAppSelector((state) => state);
    const [showPayment, set_showPayment] = useState(false);
    const location = useLocation();
    const [item, set_item] = useState<any>(null);
    

    const handleJoinMeeting = async () => {
        if (meetingId.trim() === "") {
            alert("Please enter a valid meeting ID.");
            return;
        }
        // Logic to join the meeting using the meetingId
        console.log(`Joining meeting with ID: ${meetingId}`);
        // Here you would typically call an API or navigate to a meeting page
        try {
            const groupChat = await getGroupChatById(meetingId);

            console.log("Group Chat Details:", groupChat);

            const now = new Date().getTime();
            if(new Date(groupChat.end).getTime() < now) {
                alert("Cannot join a past chat");
                return;
            }

            if(userDetails.role === "expert") {
                await joinGroupChat({ groupChatId: meetingId });
                alert("You have successfully joined the meeting.");
                // Navigate to the meeting page or perform any other action needed after joining

            } else {
                set_item(groupChat);
                set_showPayment(true);
            }

        } catch (err) {
            console.error("Error while joining meeting :", err);
            return null; // Ensure null is returned in case of an error
        }
        
    };

    useEffect(() => {
                let { redirect_status, payment_intent, price } = queryString.parse(location.search);
                if (redirect_status === 'succeeded') {
                    const pendingDetails = window.localStorage.getItem('pendingDetails')
                    if (pendingDetails) {
                        SetLoadingStatus(true)
                        const details = JSON.parse(pendingDetails)
                        window.localStorage.removeItem('pendingDetails')
                        SetLoadingStatus(false)
                        const res = joinGroupChat({groupChatId: details.groupChatId, payment_intent})
                    }
                } else {
                    window.localStorage.removeItem('pendingDetails')
                    if (redirect_status) {
                        set_showPayment(false);
                    }
                }
        }, [])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray">
            <div className="join-meeting bg-transparent p-8 rounded-lg border border-gray w-full max-w-md">
                <h2 className="text-2xl font-bold text-center mb-6 text-white">
                    Enter the meeting Id
                </h2>
                <input
                    type="text"
                    value={meetingId}
                    onChange={(e) => setMeetingId(e.target.value)}
                    placeholder="Meeting ID"
                    className="meeting-id-input w-full px-6 py-3 bg-transparent border border-gray-400 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent mb-6 text-white placeholder-gray-400"
                />
                <button 
                    onClick={handleJoinMeeting}
                    className="w-full bg-green text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors font-medium"
                >
                    Join Meeting
                </button>
            </div>
            {showPayment && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative">
                        {/* Close button */}
                        <button
                            onClick={() => set_showPayment(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-xl font-bold"
                        >
                            ×
                        </button>

                        {/* Payment Component */}
                        <Payment
                            type="Session"
                            price={item.price}
                            pendingDetails={{
                                name: item.name,
                                start: item.startTime,
                                end: item.endTime,
                                duration: item.duration,
                                price: item.price,
                                expert: item.admin,
                                groupChatId: item._id,
                            }}
                            onClose={() => set_showPayment(true)} // Pass close function to Payment component if needed
                        />
                    </div>
                </div>
            )}
        </div>
        
    );
}

export default JoinMeeting;