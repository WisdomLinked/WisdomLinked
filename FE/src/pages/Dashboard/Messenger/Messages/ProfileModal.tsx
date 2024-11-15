import React, { useEffect, useRef, useState } from "react";
import { fetchTimeZone } from "../../../../api/timezone";

interface Country {
    latitude: number;
    longitude: number;
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

    // Fetch timezone data whenever userDetails change
    useEffect(() => {
        const fetchTimezoneData = async () => {
            try {
                const { latitude, longitude } = userDetails.country;
                const res = await fetchTimeZone(latitude, longitude);
                console.log("timezone", res);

                if (res?.formatted) {
                    setTimezoneData(res.formatted);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div ref={modalRef} className="w-96 p-6 bg-white rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
                <p className="text-gray-700 mb-2">
                    <strong>Name:</strong> {userDetails.username}
                </p>
                <p className="text-gray-700">
                    <strong>Email:</strong> {userDetails.email}
                </p>
                <p className="text-gray-700">
                    <strong>Timezone:</strong> {timezone || "Loading..."}
                </p>
                <button
                    onClick={onClose}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

export default ProfileModal;