import { useState, useEffect } from "react";
import {
    doGetKeywordsAndServices,
    doUpdateProfile,
    doUpdateProfileByAdmin,
    profileImageFetch,
    profileImageUpload
} from "../../../api/api";
import ShowFieldError from "../../../components/ShowFieldError";
import MultiSelectionWithInputTag from "../../../components/MultiSelectionWithInputTag";
import SelectionWithCheckBox from "../../../components/SelectionWithCheckBox";
import { arraysEqual, checkTitleNameInvalid } from "../../../actions/common";
import { useNavigate } from "react-router-dom";
import { SetLoadingStatus } from "../../../actions/appActions";
import CountrySelect from "../../../components/CountrySelection";
import PhoneInput from "react-phone-input-2";
import { useDispatch } from "react-redux";
import { validateImageSize } from "../../../utils/validators";
import { showAlert } from "../../../actions/alertActions";
import ImagePicker from "../../../components/imagePicker";
import { filterApiServicesToCanonical } from "../../../constants/serviceOptions";

const CustomerProfile = ({
    userDetails,
    isFromAdminPanel = false,
    updateOneUser
}: any) => {
    let curr_filename = ""  // Need to implement this with the state instead of a new variable

    const dispatch = useDispatch()
    const navigate = useNavigate()

    // This key is used to force re-render image picker component when reset button is clicked
    const [imagePickerKey, set_imagePickerKey] = useState(0);

    // This is the variable that gets updated by the image picker component.
    const [imageSrc, set_imageSrc] = useState<any>(null)
    // This is the original image downloaded when page loads. This state shouldn't be modified. 
    const [originalImageSrc, set_originalImageSrc] = useState<any>(null);
    const [image, set_image] = useState<any>(null)


    const [name, set_name] = useState(userDetails.username)
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

    const reset = () => {
        if (userDetails.image) {
            set_imagePickerKey((key) => key + 1)
            set_imageSrc(originalImageSrc)
        }
        set_name(userDetails.username)
        set_selectedKeywords(userDetails.keywords)
        set_selectedServices(userDetails.services)
        set_country(userDetails.country)
        set_state(userDetails.state)
        set_city(userDetails.city)
        set_phoneNumber(userDetails.phoneNumber)
    }

    const loadData = async () => {
        if (userDetails.image) {
            const image: any = imageSrc ? imageSrc : await profileImageFetch(userDetails.image, "small");
            if (image) {
                set_originalImageSrc(image);
                set_image(userDetails.image)
            }
        }
        set_name(userDetails.username)
        set_selectedKeywords(userDetails.keywords)
        set_selectedServices(userDetails.services)
        set_country(userDetails.country)
        set_state(userDetails.state)
        set_city(userDetails.city)
        set_phoneNumber(userDetails.phoneNumber)
    }

    const uploadProfileImage = async (newDataUri: any) => {
        try {
            const fileExtension = newDataUri.split(';')[0].split('/')[1];
            const base64Response = await fetch(newDataUri);
            const blob = await base64Response.blob();
            const file = new File(
                [blob],
                `${userDetails.userId}_${Date.now()}.${fileExtension}`,
                { type: blob.type }
            );

            const formData = new FormData();
            formData.append('image', file);

            const res = await profileImageUpload(formData);
            curr_filename = res.data.details[0].filename

            return res.data.details[0].filename;
        } catch (error: any) {
            dispatch(showAlert("Error uploading image: " + error.response.data.error))
        }
    };

    const updateProfile = async () => {
        SetLoadingStatus(true)
        if (originalImageSrc != imageSrc) {
            await uploadProfileImage(imageSrc)
            console.log("after upload ", image)
        }
        const updates = {
            email: userDetails.email,
            image: curr_filename ? curr_filename : image,
            username: name,
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

    const getKeywordsAndServices = async () => {
        const response: any = await doGetKeywordsAndServices();
        if (response) {
            set_keywords(response.keywords || [])
            set_services(filterApiServicesToCanonical(response.services || []))
        }
    }

    // Returns true if input is valid
    const validateInput = () => {
        if (
            name.length >= 3 &&
            !checkTitleNameInvalid('Username', name) &&
            country &&
            (!stateAvailable || (stateAvailable && state)) &&
            (!cityAvailable || (cityAvailable && city)) &&
            phoneNumber &&
            (
                !(imageSrc == originalImageSrc) ||
                name !== userDetails.username ||
                !arraysEqual(selectedKeywords, userDetails.keywords || []) ||
                !arraysEqual(selectedServices, userDetails.services || []) ||
                !userDetails.country?.name !== country?.name ||
                !userDetails.state?.name !== state?.name ||
                !userDetails.city?.name !== city?.name ||
                phoneNumber !== userDetails.phoneNumber
            )
        ) {
            return true;
        } else {
            return false;
        }
    }

    // Validates input and controls if submit button is enabled
    const on_imageChange = (newImageSrc: any) => {
        if (validateImageSize(newImageSrc) === false) {
            set_enableToUpdate(false);
        } else {
            set_imageSrc(newImageSrc);
            set_enableToUpdate(true);
        }
    }

    useEffect(() => {
        set_enableToUpdate(validateInput())
        set_showError(!validateInput())
    }, [imageSrc, name, selectedKeywords, selectedServices, country, state, stateAvailable, city, cityAvailable, phoneNumber])

    useEffect(() => {
        loadData()
        getKeywordsAndServices()
    }, [])

    return (
        <div className={`w-full h-full overflow-y-auto relative bg-[#F5F3EF] ${isFromAdminPanel ? 'py-0' : 'py-6'}`}>
            <div className={`w-full max-w-3xl mx-auto flex flex-col items-stretch ${isFromAdminPanel ? 'p-0' : 'px-4 py-8 sm:px-6'}`}>
                {
                    !isFromAdminPanel ?
                        <>
                            <div className="w-full flex">
                                <button
                                    className="w-6 h-6 text-slate-700 hover:opacity-70"
                                    onClick={() => navigate(-1)}
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M9.57 5.92993L3.5 11.9999L9.57 18.0699" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M20.5 12H3.67004" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>
                            <div className="text-center text-slate-900 text-3xl font-semibold">Edit Profile</div>
                        </> :
                        null
                }

                <div className="w-full flex flex-col justify-center items-stretch mt-2 rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
                    <div className="mx-auto">
                        <ImagePicker key={imagePickerKey} initialImage={originalImageSrc} on_imageChange={on_imageChange} validator={validateImageSize} />
                    </div>
                    <div className="w-full mt-6">
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

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Majors</div>
                        <MultiSelectionWithInputTag
                            options={keywords}
                            selectedOptions={selectedKeywords}
                            set_selectedOptions={set_selectedKeywords}
                            placeholder="Select majors"
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Services</div>
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
                    </div>
                </div>
                <div className="w-full h-10 flex justify-end gap-3 mt-8 text-slate-600">
                    <button
                        className="w-[170px] rounded-lg border border-slate-300 flex items-center justify-center hover:bg-slate-50 transition"
                        onClick={reset}
                    >
                        Reset
                    </button>
                    <button
                        className="w-[170px] bg-[#234C6A] text-white rounded-lg flex items-center justify-center hover:bg-[#1b3c53] disabled:opacity-50 transition"
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

export default CustomerProfile;
