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

import {doGetKeywordsAndServices, registerUserByAdmin, sendWelcomeEmail} from "../api/api";
import { filterApiServicesToCanonical } from "../constants/serviceOptions";
import { SetLoadingStatus } from "../actions/appActions";
import { useAppSelector } from "../store";

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

    const [emailTouched, setEmailTouched] = useState(false)
    const [pwdTouched, setpwdTouched] = useState(false)
    const [confirmPwdTouched, setConfirmPwdTouched] = useState(false)

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

            const emailRes = await sendWelcomeEmail(email, pwd);

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
            set_services(filterApiServicesToCanonical(response.services || []));
        }
    };

    useEffect(() => {
        if (emailTouched) {
            set_isValidEmail(!email ? true : validateEmail(email) ? true : false);
        }
    }, [email, emailTouched]);

    useEffect(() => {
        if (confirmPwdTouched) {
            set_isValidConfirmPwd(!pwd && !confirmPwd ? true : pwd === confirmPwd);
        }
    }, [pwd, confirmPwd, confirmPwdTouched]);

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

    const field =
        "w-full h-[50px] px-4 rounded-[15px] bg-wl-pageAlt border border-wl-line text-wl-ink text-[14px] shadow-[inset_0_1px_2px_rgba(35,76,106,0.06)] placeholder:text-grey transition-colors hover:border-wl-brand/20 focus:outline-none focus:border-wl-brand/40 focus:ring-2 focus:ring-wl-brand/25 focus:bg-white";
    const label = "mb-1.5 text-sm text-wl-muted";

    return (
        <div className="admin-register-form w-full max-w-[520px] mx-auto rounded-2xl border border-wl-line bg-white p-6 sm:p-8 shadow-[0_10px_30px_rgba(35,76,106,0.08)] text-wl-ink">
            <h3 className="text-xl font-semibold text-wl-brand mb-6">
                Register Customer (By Admin)
            </h3>

            <div className={label}>Full name *</div>
            <input
                className={`${field} mb-1`}
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

            <div className={`${label} mt-5`}>Majors</div>
            <MultiSelectionWithInputTag
                options={keywords}
                selectedOptions={selectedKeywords}
                set_selectedOptions={set_selectedKeywords}
                placeholder="Input or select majors"
            />

            <div className={`${label} mt-5`}>Services</div>
            <SelectionWithCheckBox
                options={services}
                selectedOptions={selectedServices}
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

            <div className={`${label} mt-5`}>Phone number *</div>
            <PhoneInput
                placeholder="Enter phone number"
                value={phoneNumber}
                onChange={(data) => set_phoneNumber(data)}
                containerClass="mb-2 !w-full"
                inputClass="!h-[50px] !w-full !rounded-[15px] !bg-wl-pageAlt !text-wl-ink !border !border-wl-line !text-[14px] !pl-[52px] !shadow-[inset_0_1px_2px_rgba(35,76,106,0.06)] hover:!border-wl-brand/20 focus:!ring-2 focus:!ring-wl-brand/25 focus:!border-wl-brand/40 focus:!bg-white"
                buttonClass="!bg-wl-pageAlt !border-wl-line !rounded-l-[15px] hover:!bg-wl-brandSoft"
            />
            <ShowFieldError
                show={phoneNumber.length < 8 && showError}
                label="You must provide a valid phone number"
            />

            <div className={`${label} mt-5`}>Email *</div>
            <input
                className={`${field} mb-1`}
                type="email"
                placeholder="Input email address"
                value={email}
                onChange={(e) => set_email(e.target.value)}
                onBlur={() => setEmailTouched(true)}
            />
            <ShowFieldError
                show={emailTouched && !isValidEmail}
                label="Invalid email address."
            />

            <div className={`${label} mt-5`}>
                Password *
                <span className="ml-2 text-xs text-wl-muted">
                    (Should be greater than 5 characters)
                </span>
            </div>
            <input
                className={field}
                placeholder="Input your password"
                type="text"
                value={pwd}
                onChange={(e) => set_pwd(e.target.value)}
                onBlur={() => setpwdTouched(true)}
            />
            <ShowFieldError
                show={pwdTouched && pwd.length < 6 && showError}
                label="Password must be longer than 6 characters."
            />

            <div className={`${label} mt-5`}>Repeat Password *</div>
            <input
                className={field}
                placeholder="Confirm your password"
                type="text"
                value={confirmPwd}
                onChange={(e) => set_confirmPwd(e.target.value)}
                onBlur={() => setConfirmPwdTouched(true)}
            />
            <ShowFieldError
                show={confirmPwdTouched && !isValidConfirmPwd}
                label="Invalid confirm password."
            />

            <button
                type="button"
                className={`mt-8 w-full rounded-xl px-6 py-3 text-sm font-semibold transition-colors ${
                    enableToRegister
                        ? "bg-wl-brand text-white hover:brightness-95 shadow-sm"
                        : "bg-wl-line text-wl-muted cursor-not-allowed"
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
