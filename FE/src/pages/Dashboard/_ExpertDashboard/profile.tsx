import React, { useState, useEffect } from "react";
import EditAvatar from "../EditAvatar";
import { callApi, doGetKeywordsAndServices, doUpdateProfile, doUpdateProfileByAdmin } from "../../../api/api";
import ShowFieldError from "../../../components/ShowFieldError";
import MultiSelectionWithInputTag from "../../../components/MultiSelectionWithInputTag";
import SelectionWithCheckBox from "../../../components/SelectionWithCheckBox";
import PhoneInput from "react-phone-input-2";
import { arraysEqual, checkTitleNameInvalid, getBase64FromImageURL } from "../../../actions/common";
import { useNavigate } from "react-router-dom";
import { SetLoadingStatus } from "../../../actions/appActions";
import CountrySelect from "../../../components/CountrySelection";
import FileBrowser from "../../../components/fileBrowser";
import { useDispatch } from "react-redux";
import { showAlert } from "../../../actions/alertActions";

const ExpertProfile = ({
    userDetails,
    isFromAdminPanel = false,
    updateOneUser
}: any) => {

    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [imageSrc, set_imageSrc] = useState<any>('')
    const [oldImageSrc, set_oldImageSrc] = useState<any>(null)
    const [name, set_name] = useState('')
    const [title, set_title] = useState('')
    const [description, set_description] = useState('')
    const [keywords, set_keywords] = useState([])
    const [services, set_services] = useState([])
    const [selectedKeywords, set_selectedKeywords] = useState<Array<any>>([])
    const [selectedServices, set_selectedServices] = useState<Array<any>>([])
    const [country, set_country] = useState<any>()
    const [state, set_state] = useState<any>()
    const [city, set_city] = useState<any>()
    const [stateAvailable, set_stateAvailable] = useState(false)
    const [cityAvailable, set_cityAvailable] = useState(false)
    const [phoneNumber, set_phoneNumber] = useState<any>('')
    const [showError, set_showError] = useState(false)
    const [enableToUpdate, set_enableToUpdate] = useState(false)
    const [resume, set_resume] = useState('')
    const [file, set_file] = useState('')
    const [fileError, set_fileError] = useState('')

    const reset = async () => {

        if (userDetails.image) {
            const image: any = await getBase64FromImageURL(`${process.env.REACT_APP_SERVER_URL}/${userDetails.image}`);
            if (image) {
                set_imageSrc(image)
                set_oldImageSrc(image)
            }
        }
        set_name(userDetails.username)
        set_title(userDetails.title)
        set_description(userDetails.description)
        set_selectedKeywords(userDetails.keywords)
        set_selectedServices(userDetails.services)
        set_country(userDetails.country)
        set_state(userDetails.state)
        set_city(userDetails.city)
        set_phoneNumber(userDetails.phoneNumber)
        set_resume(userDetails.resume)
    }

    const updateProfile = async () => {
        SetLoadingStatus(true)
        const updates = {
            email: userDetails.email,
            image: imageSrc,
            username: name,
            title: title,
            description: description,
            keywords: selectedKeywords,
            services: selectedServices.map((x: any) => x._id),
            country,
            state,
            city,
            phoneNumber: phoneNumber
        }
        if (!isFromAdminPanel) {
            await doUpdateProfile(updates)
        } else {
            const res = await doUpdateProfileByAdmin(updates)
            if (res) {
                updateOneUser(res.result)
            }
        }
        SetLoadingStatus(false)
    }

    const updateResume = async () => {
        SetLoadingStatus(true)
        const response = await callApi('POST', 'auth/updateResume', { email: userDetails.email }, file)
        if (response.status === 'SUCCESS') {
            set_resume(response.newResume)
            set_file('')
        } else {
            dispatch(showAlert(response.error))
        }
        SetLoadingStatus(false)
    }

    const getKeywordsAndServices = async () => {
        const response: any = await doGetKeywordsAndServices();
        if (response) {
            set_keywords(response.keywords || [])
            set_services(response.services || [])
        }
    }

    useEffect(() => {
        if (
            name.length >= 3 && !checkTitleNameInvalid('Username', name) &&
            title.length &&
            description.length > 20 && description.length <= 100 &&
            selectedKeywords.length >= 3 &&
            selectedServices.length &&
            country &&
            (!stateAvailable || (stateAvailable && state)) &&
            (!cityAvailable || (cityAvailable && city)) &&
            phoneNumber &&
            (
                !(imageSrc == oldImageSrc) ||
                name !== userDetails.username ||
                title !== userDetails.title ||
                description !== userDetails.description ||
                !arraysEqual(selectedKeywords || [], userDetails.keywords || []) ||
                !arraysEqual(selectedServices || [], userDetails.services || []) ||
                !userDetails.country?.name !== country?.name ||
                !userDetails.state?.name !== state?.name ||
                !userDetails.city?.name !== city?.name ||
                phoneNumber !== userDetails.phoneNumber
            )
        ) {
            set_enableToUpdate(true)
            set_showError(false)
        } else {
            set_enableToUpdate(false)
            set_showError(true)
        }
    }, [imageSrc, name, title, description, selectedKeywords, selectedServices, country, state, stateAvailable, city, cityAvailable, phoneNumber])

    useEffect(() => {
        if (!fileError && file) {
            updateResume()
        }
    }, [file, fileError])

    useEffect(() => {
        if (userDetails?.email) {
            reset()
        }
    }, [userDetails])

    useEffect(() => {
        getKeywordsAndServices()
    }, [])

    return (
        <div className={`w-full h-full overflow-y-auto relative ${isFromAdminPanel ? 'py-0' : 'py-6'}`}>
            <div className={`w-full max-w-[400px] p-6 mx-auto flex flex-col items-center ${isFromAdminPanel ? 'p-0' : 'p-6'}`}>
                {
                    !isFromAdminPanel ?
                        <>
                            <div className="w-full flex">
                                <button
                                    className="w-6 h-6 text-white hover:opacity-50"
                                    onClick={() => navigate(-1)}
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M9.57 5.92993L3.5 11.9999L9.57 18.0699" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M20.5 12H3.67004" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>
                            <div className="text-center text-white text-3xl">Edit Profile</div>
                        </> :
                        null
                }
                <div className="w-full flex flex-col justify-center items-center mt-8">
                    <EditAvatar
                        imageSrc={imageSrc}
                        set_imageSrc={set_imageSrc}
                        userId={userDetails.userId}
                    />
                    <div className="text-white text-xs">Profile Image should not be more than 500 kb</div>
                    <div className="w-full max-w-[400px] mt-6 text-white">
                        {
                            isFromAdminPanel ?
                                <>
                                    <div className="mt-6 text-grey text-[12px] leading-[19px]">Email *</div>
                                    <input
                                        className="w-full bg-transparent rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] px-[24px] border-lightgrey"
                                        disabled={true}
                                        value={userDetails.email}
                                    />
                                </> :
                                null
                        }
                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Full name *</div>
                        <input
                            className="w-full bg-transparent rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] px-[24px] border-lightgrey"
                            placeholder="Input your name"
                            value={name}
                            onChange={(e) => set_name(e.target.value)}
                        />
                        <ShowFieldError
                            show={!(name.length >= 3 && !checkTitleNameInvalid('Username', name)) && showError}
                            label={checkTitleNameInvalid('Username', name) ? checkTitleNameInvalid('Username', name) : "Name must be longer than 3 characters."}
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Title *</div>
                        <input
                            className="w-full bg-transparent rounded-[15px] h-[50px] mt-0.5 border text-[14px] leading-[21px] px-[24px] border-lightgrey"
                            placeholder="Input your title"
                            value={title}
                            onChange={(e) => set_title(e.target.value)}
                        />
                        <ShowFieldError
                            show={!title.length && showError}
                            label="Title is required."
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Short bio *</div>
                        <textarea
                            className="w-full bg-transparent rounded-[15px] h-[100px] mt-0.5 border text-[14px] leading-[21px] px-[24px] py-4 border-lightgrey"
                            placeholder="Describe yourself with few words"
                            value={description}
                            onChange={(e) => set_description(e.target.value)}
                        />
                        <ShowFieldError
                            show={!(description.length > 20 && description.length <= 100) && showError}
                            label="Bio should include 20 ~ 100 characters."
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Majors *</div>
                        <MultiSelectionWithInputTag
                            options={keywords}
                            selectedOptions={selectedKeywords}
                            set_selectedOptions={set_selectedKeywords}
                            placeholder="Select majors"
                        />
                        <ShowFieldError
                            show={!(selectedKeywords.length >= 3) && showError}
                            label="You have to add at least 3 keywords"
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Services *</div>
                        <SelectionWithCheckBox
                            options={services}
                            selectedOptions={selectedServices}
                            set_selectedOptions={set_selectedServices}
                            placeholder="Select services"
                            isMulti={true}
                        />
                        <ShowFieldError
                            show={!selectedServices.length && showError}
                            label="You have to select at least one service"
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

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Phone number *</div>
                        <PhoneInput
                            placeholder="Enter phone number"
                            value={phoneNumber}
                            onChange={(data) => set_phoneNumber(data)}
                        />
                        <ShowFieldError
                            show={!phoneNumber.length && showError}
                            label="You have to provide your phone number"
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Current resume</div>
                        <a href={`${process.env.REACT_APP_SERVER_URL}/${resume}`} target='_blank' className="text-blue underline">Resume</a>
                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Update resume</div>
                        <FileBrowser
                            file={file}
                            set_file={set_file}
                            set_fileError={set_fileError}
                        />
                        <ShowFieldError show={fileError || (!file && showError)} label={file ? fileError : 'Resume is required.'} />
                    </div>
                </div>
                <div className="w-full h-10 flex justify-between mt-14 text-lightgrey">
                    <button
                        className="w-[calc(50%-8px)] rounded-lg border border-lightgrey flex items-center justify-center"
                        onClick={reset}
                    >
                        Reset
                    </button>
                    <button
                        className="w-[calc(50%-8px)] bg-green rounded-lg flex items-center justify-center  disabled:opacity-50"
                        disabled={!enableToUpdate}
                        onClick={updateProfile}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExpertProfile;
