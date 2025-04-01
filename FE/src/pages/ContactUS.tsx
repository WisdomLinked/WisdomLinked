import React, {useState, useEffect, useCallback} from "react";
import { useNavigate } from "react-router-dom"; // Hook for navigation
import FileBrowser from "../components/fileBrowser";
import ShowFieldError from "../components/ShowFieldError";
import { validateEmail } from "../actions/common";
import {doContactUs, sendEmailToAdmin, sendEmailToUser} from "../api/api"; // Import the new function
import { SetLoadingStatus } from "../actions/appActions";

const ContactUS = () => {
    const navigate = useNavigate(); // For programmatic navigation

    // State Variables
    const [name, set_name] = useState("");
    const [email, set_email] = useState("");
    const [isValidEmail, set_isValidEmail] = useState(false);
    const [issue, set_issue] = useState("");
    const [countryCode, set_countryCode] = useState("");
    const [contactNumber, set_contactNumber] = useState("");
    const [showError, set_showError] = useState(false);
    const [issueError, set_issueError] = useState(false);
    const [enableToSubmit, set_enableToSubmit] = useState(false);

    const createEmailTemplate = (name: string, email: string, countryCode:string, contactNumber: string, issue: string) => {
        return `
Someone just reached us at WisdomLinked.com,

Here are the user's details:

Name: ${name}
Email: ${email}
Country Code: ${countryCode}
Contact Number: ${contactNumber}
Reason: ${issue} 

Warm Regards,
The WisdomLinked.com Team
        `.trim();
    };

    const handleSendEmail = async (message: string) => {
        try {
          const res = await sendEmailToAdmin(message);      
            if(res && res.status ==="SUCCESS"){
                console.log("Email sent successfully!");
            }
            else{
                console.log("Failed to send email");
            }
        }
        catch (error){
            console.error("Error sending email:", error);
        }
    }


    // Submit Function
    const submit = async () => {
        // Validate Reason Field (Issue)
        if (!issue.trim()) {
            set_issueError(true);
            return; // Stop submission if Reason is empty
        }
        set_issueError(false);

        if (!enableToSubmit) {
            set_showError(true);
        } else {
            set_showError(false);
            SetLoadingStatus(true);

            try {
                // Call API to submit contact details
                const response = await doContactUs({
                    name,
                    email,
                    countryCode,
                    contactNumber,
                    issue
                });

                if (response) {

                    const finalMessage = createEmailTemplate(name, email, countryCode, contactNumber, issue);
                    await handleSendEmail(finalMessage);
                    alert("Thank you for contacting us. Your query has been submitted successfully.");

                    // Clear input fields
                    set_name("");
                    set_email("");
                    set_issue("");
                    set_countryCode("");
                    set_contactNumber("");

                    // Navigate to home
                    navigate("/");

                    // Scroll to top
                    setTimeout(() => {
                        window.scrollTo(0, 0);
                    }, 0);
                } else {
                    alert("Failed to submit contact details. Please try again later.");
                }
            } catch (error) {
                console.error("Error submitting contact:", error);
                alert("An error occurred. Please try again.");
            } finally {
                SetLoadingStatus(false);
            }
        }
    };

    // Validate Email Format
    useEffect(() => {
        set_isValidEmail(!email ? true : !!validateEmail(email));
    }, [email]);

    // Enable Submit Button Only If Valid
    useEffect(() => {
        if (name.length >= 3 && isValidEmail && issue.trim().length > 0) {
            set_enableToSubmit(true);
            set_showError(false);
        } else {
            set_enableToSubmit(false);
        }
    }, [name, isValidEmail, issue]);

    return (
        <div className="w-full main_container py-[40px] lg:py-[60px]">
            <div className="w-fit mx-auto flex items-center space-x-[10px] bg-darkgrey rounded-[80px] p-[5px] px-[25px]">
                <div className="text-white text-[12px] leading-[15px] lg:text-[14px] lg:leading-[21px]">
                    Become a member 🤟🏻
                </div>
            </div>
            <div className="max-w-[1060px] mx-auto mt-3 text-center text-white font-bold text-[32px] leading-[48px] lg:text-[56px] lg:leading-[78px]">
                Please contact us
            </div>
            <div className="w-full max-w-[734px] mx-auto mt-[55px] lg:mt-12">
                {/* Full Name Field */}
                <div className="text-lightgrey text-[12px] leading-[19px]">Full Name *</div>
                <input
                    className="w-full bg-black rounded-[15px] h-[62px] mt-0.5 border text-white text-[14px] leading-[21px] px-[24px]"
                    placeholder="Input your Full Name"
                    value={name}
                    onChange={(e) => set_name(e.target.value)}
                />
                <ShowFieldError
                    show={!(name.length >= 3) && showError}
                    label="Name must be longer than 3 characters."
                />

                {/* Email Field */}
                <div className="mt-6 text-white text-[12px] leading-[19px]">Email *</div>
                <input
                    className="w-full bg-black text-white rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] px-[24px]"
                    placeholder="Input your email address"
                    type="email"
                    value={email}
                    onChange={(e) => set_email(e.target.value)}
                />
                <ShowFieldError
                    show={!isValidEmail || (showError && !email)}
                    label={!isValidEmail ? "Invalid email address." : "Email is required."}
                />

                {/* Country Code Field */}
                <div className="mt-6 text-white text-[12px] leading-[19px]">Country Code</div>
                <input
                    className="w-full bg-black text-white rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] px-[24px]"
                    placeholder="e.g. +1"
                    type="text"
                    value={countryCode}
                    onChange={(e) => set_countryCode(e.target.value)}
                />

                {/* Contact Number Field */}
                <div className="mt-6 text-white text-[12px] leading-[19px]">Contact Number</div>
                <input
                    className="w-full bg-black text-white rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] px-[24px]"
                    placeholder="Your phone number"
                    type="text"
                    value={contactNumber}
                    onChange={(e) => set_contactNumber(e.target.value)}
                />

                {/* Reason Field (Mandatory) */}
                <div className="mt-8 lg:mt-12 text-lightgrey text-[12px] leading-[19px]">Reason *</div>
                <textarea
                    className="w-full bg-black rounded-[15px] h-[200px] mt-0.5 border text-white text-[14px] leading-[21px] p-[24px]"
                    placeholder="Input your reason in detail"
                    value={issue}
                    onChange={(e) => set_issue(e.target.value)}
                />
                <ShowFieldError
                    show={issueError || (showError && issue.trim().length === 0)}
                    label="Reason is required."
                />

                {/* Submit Button */}
                <div className="flex flex-row-reverse mt-[54px]">
                    <button
                        className="px-[48px] py-[15px] rounded-[14px] bg-green text-white text-[16px] leading-[24px] font-[600] disabled:opacity-50"
                        disabled={showError}
                        onClick={submit}
                    >
                        Submit
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ContactUS;
