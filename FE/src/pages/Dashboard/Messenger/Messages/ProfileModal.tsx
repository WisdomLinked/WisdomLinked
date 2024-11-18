import React, { useEffect, useRef, useState } from "react";
import { getTimezone } from "../../../../api/api";

interface Country {
    latitude: number;
    longitude: number;
    name: string
}

interface UserDetails {
    username: string;
    email: string;
    country: Country;
}

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    userDetails: UserDetails;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, userDetails }) => {
    const [timezone, setTimezoneData] = useState<string>("");
    const modalRef = useRef<HTMLDivElement>(null);

    // Handle clicks outside the modal to close it
    const handleOutsideClick = (e: MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    // Handle close button click
    const handleCloseClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClose();
    };

    // Fetch timezone data whenever userDetails change
    useEffect(() => {
        const fetchTimezoneData = async () => {
            try {
                const { latitude, longitude } = userDetails.country;
                const {response} = await getTimezone({ lat: latitude, lng: longitude });
                console.log("timezone", response);

                if (response?.formatted) {
                    setTimezoneData(response.formatted);
                } else {
                    console.error("Formatted field is missing in the response");
                }
            } catch (error) {
                console.error("Error fetching timezone data:", error);
            }
        };

        if (userDetails?.country) {
            console.log("Fetching timezone data for", userDetails.country);
            fetchTimezoneData();
        }
    }, [userDetails]);

    // Handle mounting and unmounting of event listeners for outside clicks
    useEffect(() => {
        if (isOpen) {
            document.addEventListener("mousedown", handleOutsideClick);
        } else {
            document.removeEventListener("mousedown", handleOutsideClick);
        }

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, [isOpen]);

    // Do not render the modal if it's not open
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div ref={modalRef} className="w-96 p-6 bg-[#1a1a24] rounded-lg shadow-2xl border border-gray-800">
                <h2 className="text-xl font-semibold mb-4 text-gray-100 border-b border-gray-800 pb-3">Profile
                    Information</h2>
                <div className="space-y-4 bg-[#20202c] p-4 rounded-md">
                    <p className="text-gray-300">
                        <strong className="text-gray-200">Name:</strong> {userDetails.username}
                    </p>
                    <p className="text-gray-300">
                        <strong className="text-gray-200">Email:</strong> {userDetails.email}
                    </p>
                    <p className="text-gray-300">
                        <strong className="text-gray-200">Country:</strong> {userDetails?.country?.name}
                    </p>
                    <p className="text-gray-300">
                        <strong className="text-gray-200">Timezone:</strong> {timezone}
                    </p>
                </div>
                <button
                    onClick={handleCloseClick}
                    className="mt-6 w-full px-4 py-2.5 bg-[#2d2d3d] text-gray-200 rounded-lg hover:bg-[#363649] transition-all duration-200"
                >
                    Close
                </button>
            </div>
        </div>


    );
};

export default ProfileModal;
