import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import {
    checkTitleNameInvalid,
    validateEmail
} from "../actions/common";

import ShowFieldError from "./ShowFieldError";
import MultiSelectionWithInputTag from "./MultiSelectionWithInputTag";
import SelectionWithCheckBox from "./SelectionWithCheckBox";
import CountrySelect from "./CountrySelection";
import PhoneInput from "react-phone-input-2";

import {doGetKeywordsAndServices, registerUserByAdmin, sendEmailToUser} from "../api/api";
import { SetLoadingStatus } from "../actions/appActions";
import { showAlert } from "../actions/alertActions";
import { useAppSelector } from "../store";

const buildWelcomeEmailMessage = (email: string, password: string) => {
            return `
        Greetings of the day!
        
        Your account has been successfully registered at varun-sahni.com.
        
        Below are your credentials:
        Email ID: ${email}
        Password: ${password}
        
        We look forward to having you explore our services.
        
        Best Regards,
        Team varun-sahni.com
        `;
        };

function AdminRegisterCustomer() {
    const dispatch = useDispatch();
    const { userDetails } = useAppSelector((state) => state.auth);

    const [keywords, set_keywords] = useState<any[]>([]);
    const [services, set_services] = useState<any[]>([]);
    const [name, set_name] = useState("");
    const [selectedKeywords, set_selectedKeywords] = useState<Array<any>>([]);
    const [selectedServices, set_selectedServices] = useState<Array<any>>([]);

    const [country, set_country] = useState<any>();
    const [state, set_state] = useState<any>();
    const [city, set_city] = useState<any>();
    const [stateAvailable, set_stateAvailable] = useState(false);
    const [cityAvailable, set_cityAvailable] = useState(false);

    const [phoneNumber, set_phoneNumber] = useState<any>("");
    const [email, set_email] = useState("");
    const [isValidEmail, set_isValidEmail] = useState(false);

    const [pwd, set_pwd] = useState("");
    const [confirmPwd, set_confirmPwd] = useState("");
    const [isValidConfirmPwd, set_isValidConfirmPwd] = useState(false);

    const [showError, set_showError] = useState(false);
    const [enableToRegister, set_enableToRegister] = useState(false);

    const handleRegisterAsCustomer = async () => {
        if (!enableToRegister) {
            set_showError(true);
            return;
        }
        SetLoadingStatus(true);

        const data: any = {
            role: "customer",
            username: name,
            keywords: selectedKeywords,
            services: selectedServices.map((x: any) => x._id),
            state,
            country,
            city,
            phoneNumber,
            email,
            password: pwd
        };

        const response = await registerUserByAdmin(data);

        let accountCreationMsg = "";
        let emailSendingMsg = "";

        if (response && response.status === "SUCCESS") {
            accountCreationMsg = "Customer account registered successfully.";

            const welcomeMessage = buildWelcomeEmailMessage(email, pwd);
            const emailRes = await sendEmailToUser(email, welcomeMessage);

            if (emailRes && emailRes.status === "SUCCESS") {
                emailSendingMsg = "Welcome email sent successfully.";
            } else {
                emailSendingMsg = "Failed to send welcome email.";
            }
        } else {
            const errorMessage = response?.error ? `${response.error}` : "";
            accountCreationMsg = `Failed to create Customer: ${errorMessage}`;
            emailSendingMsg = "Failed to send email to the Customer";
        }

        alert(`${accountCreationMsg}\n${emailSendingMsg}`);
        SetLoadingStatus(false);
    };

    const getKeywordsAndServices = async () => {
        const response: any = await doGetKeywordsAndServices();
        if (response) {
            set_keywords(response.keywords || []);
            set_services(response.services || []);
        }
    };

    useEffect(() => {
        set_isValidEmail(!email ? true : validateEmail(email) ? true : false);
    }, [email]);

    useEffect(() => {
        set_isValidConfirmPwd(!pwd && !confirmPwd ? true : pwd === confirmPwd);
    }, [pwd, confirmPwd]);

    useEffect(() => {
        if (country) {
            set_phoneNumber(country.phonecode);
        } else {
            set_phoneNumber("");
        }
    }, [country]);

    useEffect(() => {
        const canRegister =
            name.length >= 3 &&
            !checkTitleNameInvalid("Username", name) &&
            country &&
            (!stateAvailable || (stateAvailable && state)) &&
            (!cityAvailable || (cityAvailable && city)) &&
            phoneNumber.length >= 8 &&
            isValidEmail &&
            pwd.length >= 6 &&
            isValidConfirmPwd;

        if (canRegister) {
            set_enableToRegister(true);
            set_showError(false);
        } else {
            set_enableToRegister(false);
        }
    }, [
        name, country, state, stateAvailable,
        city, cityAvailable, phoneNumber,
        isValidEmail, pwd, isValidConfirmPwd
    ]);

    useEffect(() => {
        getKeywordsAndServices();
    }, []);

    return (
        <div className="bg-[#181818] text-white p-6 rounded-lg shadow-lg w-[500px]">
            <h3 className="text-xl font-bold text-[#31B099] mb-4">
                Register Customer (By Admin)
            </h3>

            <div className="mb-2 text-sm text-gray-200">Full name *</div>
            <input
                className="w-full mb-1 p-2 rounded bg-[#2e2e2e] text-white
                   border border-gray-700 focus:outline-none"
                placeholder="Input your name"
                value={name}
                onChange={(e) => set_name(e.target.value)}
            />
            <ShowFieldError
                show={!(name.length >= 3 && !checkTitleNameInvalid("Username", name)) && showError}
                label={
                    checkTitleNameInvalid("Username", name)
                        ? checkTitleNameInvalid("Username", name)
                        : "Name must be longer than 3 characters."
                }
            />

            <div className="mb-2 text-sm text-gray-200 mt-4">Majors</div>
            <MultiSelectionWithInputTag
                options={keywords}
                selectedOptions={selectedKeywords}
                set_selectedOptions={set_selectedKeywords}
                placeholder="Input or select majors"
            />

            <div className="mb-2 text-sm text-gray-200 mt-4">Services</div>
            <SelectionWithCheckBox
                options={services}
                set_selectedOptions={set_selectedServices}
                placeholder="Select services"
                isMulti={true}
            />

            <CountrySelect
                selectedCountry={country}
                set_selectedCountry={set_country}
                selectedState={state}
                set_selectedState={set_state}
                selectedCity={city}
                set_selectedCity={set_city}
                showError={showError}
                stateAvailable={stateAvailable}
                set_stateAvailable={set_stateAvailable}
                cityAvailable={cityAvailable}
                set_cityAvailable={set_cityAvailable}
            />

            <div className="mb-2 text-sm text-gray-200 mt-4">Phone number *</div>
            <PhoneInput
                placeholder="Enter phone number"
                value={phoneNumber}
                onChange={(data) => set_phoneNumber(data)}
                containerClass="mb-2"
                inputClass="!bg-[#2e2e2e] !text-white !border !border-gray-700"
                buttonClass="!bg-[#2e2e2e] !text-white"
            />
            <ShowFieldError
                show={phoneNumber.length < 8 && showError}
                label="You must provide a valid phone number"
            />

            <div className="mb-2 text-sm text-gray-200 mt-4">Email *</div>
            <input
                className="w-full mb-1 p-2 rounded bg-[#2e2e2e] text-white
                   border border-gray-700 focus:outline-none"
                type="email"
                placeholder="Input email address"
                value={email}
                onChange={(e) => set_email(e.target.value)}
            />
            <ShowFieldError
                show={!isValidEmail}
                label="Invalid email address."
            />

            <div className="mb-2 text-sm text-gray-200 mt-4">
                Password *
                <span className="ml-2 text-xs text-gray-400">
          (Should be greater than 5 characters)
        </span>
            </div>
            <input
                className="w-full p-2 rounded bg-[#2e2e2e] text-white
                   border border-gray-700 focus:outline-none"
                placeholder="Input your password"
                type="text"
                value={pwd}
                onChange={(e) => set_pwd(e.target.value)}
            />
            <ShowFieldError
                show={pwd.length < 6 && showError}
                label="Password must be longer than 6 characters."
            />

            <div className="mb-2 text-sm text-gray-200 mt-4">Repeat Password *</div>
            <input
                className="w-full p-2 rounded bg-[#2e2e2e] text-white
                   border border-gray-700 focus:outline-none"
                placeholder="Confirm your password"
                type="text"
                value={confirmPwd}
                onChange={(e) => set_confirmPwd(e.target.value)}
            />
            <ShowFieldError
                show={!isValidConfirmPwd}
                label="Invalid confirm password."
            />

            <button
                className={`mt-6 px-6 py-3 rounded font-semibold 
                    ${
                    enableToRegister
                        ? "bg-[#31B099] text-black hover:bg-[#28a286]"
                        : "bg-gray-600 text-gray-400 cursor-not-allowed"
                }`}
                disabled={!enableToRegister}
                onClick={handleRegisterAsCustomer}
            >
                Register as Customer (Admin)
            </button>
        </div>
    );
}

export default AdminRegisterCustomer;
