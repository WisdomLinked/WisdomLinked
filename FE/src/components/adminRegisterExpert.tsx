import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import {
    checkTitleNameInvalid,
    validateEmail,
    makeAnOffsetToAvailableTimeSlots
} from "../actions/common";

import ShowFieldError from "./ShowFieldError";
import MultiSelectionWithInputTag from "./MultiSelectionWithInputTag";
import SelectionWithCheckBox from "./SelectionWithCheckBox";
import CountrySelect from "./CountrySelection";
import FileBrowser from "./fileBrowser";
import PhoneInput from "react-phone-input-2";

import {doGetKeywordsAndServices, registerUserByAdmin, sendWelcomeEmail} from "../api/api";
import { filterApiServicesToCanonical } from "../constants/serviceOptions";
import { SetLoadingStatus } from "../actions/appActions";
import FormAlert from './FormAlert';
import { useFormAlert } from '../hooks/useFormAlert';
import { useAppSelector } from "../store";

function AdminRegisterExpert() {
    const dispatch = useDispatch();
    const { message: formBannerMessage, variant: formBannerVariant, setFormError, setFormSuccess, clearFormAlert } = useFormAlert();
    const { userDetails } = useAppSelector((state) => state.auth);

    const [keywords, set_keywords] = useState<any[]>([]);
    const [services, set_services] = useState<any[]>([]);
    const [name, set_name] = useState("");
    const [title, set_title] = useState("");
    const [description, set_description] = useState("");
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

    const [file, set_file] = useState("");
    const [fileError, set_fileError] = useState("");

    const [pwd, set_pwd] = useState("");
    const [confirmPwd, set_confirmPwd] = useState("");
    const [isValidConfirmPwd, set_isValidConfirmPwd] = useState(false);

    const [emailTouched, setEmailTouched] = useState(false)
    const [pwdTouched, setpwdTouched] = useState(false)
    const [confirmPwdTouched, setConfirmPwdTouched] = useState(false)

    const [showError, set_showError] = useState(false);
    const [enableToRegister, set_enableToRegister] = useState(false);

    useEffect(() => {
        set_description("This is an Expert Account created by the Admin");
    }, []);

    const handleRegisterAsExpert = async () => {
        if (!enableToRegister) {
            set_showError(true);
            return;
        }
        SetLoadingStatus(true);

        let slots = [16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35];
        const timezoneOffset = - new Date().getTimezoneOffset() / 30;
        slots = makeAnOffsetToAvailableTimeSlots(slots, -timezoneOffset);

        const data: any = {
            role: "expert",
            username: name,
            title,
            description,
            keywords: selectedKeywords,
            services: selectedServices.map((x: any) => x._id),
            country,
            state,
            city,
            phoneNumber,
            email,
            password: pwd,
            timeSlots: slots
        };

        const response = await registerUserByAdmin(data);

        let accountCreationMsg = "";
        let emailSendingMsg = "";

        if (response && response.status === "SUCCESS") {
            accountCreationMsg = "Expert account registered successfully.";

            const emailRes = await sendWelcomeEmail(email, pwd);

            if (emailRes && emailRes.status === "SUCCESS") {
                emailSendingMsg = "Welcome email sent successfully.";
            } else {
                emailSendingMsg = "Failed to send welcome email.";
            }
        } else {
            const errorMessage = response?.error ? `${response.error}` : "";
            accountCreationMsg = `Failed to create Expert: ${errorMessage}`;
            emailSendingMsg = "Failed to send email to the Expert";
        }

        const combined = [accountCreationMsg, emailSendingMsg].filter(Boolean).join(' ');
        if (response && response.status === 'SUCCESS') {
            setFormSuccess(combined);
        } else {
            setFormError(combined || 'Registration failed. Please try again.');
        }
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
            title.length > 0 &&
            description.length > 20 &&
            description.length <= 100 &&
            selectedKeywords.length > 0 &&
            selectedServices.length > 0 &&
            country &&
            (!stateAvailable || (stateAvailable && state)) &&
            (!cityAvailable || (cityAvailable && city)) &&
            phoneNumber.length >= 8 &&
            isValidEmail &&
            pwd.length >= 6 &&
            isValidConfirmPwd &&
            (!fileError && file);

        if (canRegister) {
            set_enableToRegister(true);
            set_showError(false);
        } else {
            set_enableToRegister(false);
        }
    }, [
        name, title, description, selectedKeywords, selectedServices,
        country, state, stateAvailable, city, cityAvailable,
        phoneNumber, isValidEmail, pwd, isValidConfirmPwd,
        file, fileError
    ]);

    useEffect(() => {
        getKeywordsAndServices();
    }, []);

    const field =
        "w-full h-[50px] px-4 rounded-[15px] bg-wl-pageAlt border border-wl-line text-wl-ink text-[14px] shadow-[inset_0_1px_2px_rgba(35,76,106,0.06)] placeholder:text-grey transition-colors hover:border-wl-brand/20 focus:outline-none focus:border-wl-brand/40 focus:ring-2 focus:ring-wl-brand/25 focus:bg-white";
    const label = "mb-1.5 text-sm text-wl-muted";
    const textareaField =
        "w-full min-h-[100px] px-4 py-3 rounded-[15px] bg-wl-pageAlt border border-wl-line text-wl-ink text-[14px] shadow-[inset_0_1px_2px_rgba(35,76,106,0.06)] placeholder:text-grey transition-colors hover:border-wl-brand/20 focus:outline-none focus:border-wl-brand/40 focus:ring-2 focus:ring-wl-brand/25 focus:bg-white resize-y";

    return (
        <div className="admin-register-form w-full max-w-[520px] mx-auto rounded-2xl border border-wl-line bg-white p-6 sm:p-8 shadow-[0_10px_30px_rgba(35,76,106,0.08)] text-wl-ink">
            <h3 className="text-xl font-semibold text-wl-brand mb-6">
                Register Expert (By Admin)
            </h3>
            <FormAlert
                variant={formBannerVariant}
                message={formBannerMessage}
                onDismiss={clearFormAlert}
            />

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

            <div className={`${label} mt-5`}>Title *</div>
            <input
                className={`${field} mb-1`}
                placeholder="Input your title"
                value={title}
                onChange={(e) => set_title(e.target.value)}
            />
            <ShowFieldError
                show={!title.length && showError}
                label="Title is required."
            />

            <div className={`${label} mt-5`}>Short bio *</div>
            <textarea
                className={`${textareaField} mb-1`}
                rows={3}
                value={description}
                onChange={(e) => set_description(e.target.value)}
            />
            <ShowFieldError
                show={!(description.length > 20 && description.length <= 100) && showError}
                label="Bio should include 20 ~ 100 characters."
            />

            <div className={`${label} mt-5`}>Majors *</div>
            <MultiSelectionWithInputTag
                options={keywords}
                selectedOptions={selectedKeywords}
                set_selectedOptions={set_selectedKeywords}
                placeholder="Input or select majors"
            />
            <ShowFieldError
                show={selectedKeywords.length < 3 && showError}
                label="Add at least 3 keywords"
            />

            <div className={`${label} mt-5`}>Services *</div>
            <SelectionWithCheckBox
                options={services}
                selectedOptions={selectedServices}
                set_selectedOptions={set_selectedServices}
                placeholder="Select services"
                isMulti={true}
            />
            <ShowFieldError
                show={selectedServices.length < 1 && showError}
                label="Select at least 1 service"
            />

            <CountrySelect
                selectedCountry={country}
                set_selectedCountry={set_country}
                selectedState={state}
                set_selectedState={set_state}
                selectedCity={city}
                set_selectedCity={set_city}
                stateAvailable={stateAvailable}
                set_stateAvailable={set_stateAvailable}
                cityAvailable={cityAvailable}
                set_cityAvailable={set_cityAvailable}
                showError={showError}
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
                label="Must provide phone number"
            />

            <div className={`${label} mt-5`}>Email *</div>
            <input
                className={`${field} mb-1`}
                placeholder="Input email address"
                value={email}
                onChange={(e) => set_email(e.target.value)}
                onBlur={() => setEmailTouched(true)}
            />
            <ShowFieldError
                show={emailTouched && !isValidEmail && showError}
                label="Invalid email address."
            />

            {/* Password fields ALWAYS visible (type="text") */}
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
                show={confirmPwdTouched && !isValidConfirmPwd && showError}
                label="Passwords do not match."
            />

            <div className={`${label} mt-5`}>Upload resume *</div>
            <FileBrowser
                file={file}
                set_file={set_file}
                set_fileError={set_fileError}
            />
            <ShowFieldError
                show={fileError || (!file && showError)}
                label={file ? fileError : "Resume is required."}
            />

            <button
                type="button"
                className={`mt-8 w-full rounded-xl px-6 py-3 text-sm font-semibold transition-colors ${
                    enableToRegister
                        ? "bg-wl-brand text-white hover:brightness-95 shadow-sm"
                        : "bg-wl-line text-wl-muted cursor-not-allowed"
                }`}
                disabled={!enableToRegister}
                onClick={handleRegisterAsExpert}
            >
                Register as Expert (Admin)
            </button>
        </div>
    );
}

export default AdminRegisterExpert;
