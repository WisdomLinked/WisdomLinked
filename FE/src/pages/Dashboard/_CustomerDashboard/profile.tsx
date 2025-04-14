import React, { useState, useEffect } from "react";
import EditAvatar from "../EditAvatar";
import {
    callApi,
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
import CountrySelect, { Address } from "../../../components/CountrySelection";
import PhoneInput from "react-phone-input-2";
import { useDispatch } from "react-redux";
import ReactImagePickerEditor from "react-image-picker-editor";
import { City, ICity, ICountry, IState, State } from "country-state-city";
import { set } from "date-fns";


const CustomerProfile = ({
    userDetails,
    isFromAdminPanel = false,
    updateOneUser
}: any) => {

    let curr_filename = ""  // Need to implement this with the state instead of a new variable

    const navigate = useNavigate()
    const [imageSrc, set_imageSrc] = useState<any>(null)
    const [image, set_image] = useState<any>(null)
    const [oldImageSrc, set_oldImageSrc] = useState<any>(null)
    const [name, set_name] = useState(userDetails.username)
    const [keywords, set_keywords] = useState([])
    const [services, set_services] = useState([])
    const [selectedKeywords, set_selectedKeywords] = useState<Array<any>>([])
    const [selectedServices, set_selectedServices] = useState<Array<any>>([])

    // Country State and City picker
    const [address, set_address] = useState<Address>({ country: userDetails?.country, state: userDetails?.state, city: userDetails?.city })

    const [phoneNumber, set_phoneNumber] = useState<any>('')
    const [enableToUpdate, set_enableToUpdate] = useState(false)

    const reset = async () => {
        console.log("inside reset outside if");
        if (userDetails.image) {
            set_imageSrc(oldImageSrc)
        }
        set_name(userDetails.username)
        set_selectedKeywords(userDetails.keywords)
        set_selectedServices(userDetails.services)
        set_address({ country: userDetails.country, state: userDetails.state, city: userDetails.city })
        set_phoneNumber(userDetails.phoneNumber)
    }

    const loadData = async () => {
        console.log("inside load outside if");
        if (userDetails.image) {
            const image: any = imageSrc ? imageSrc : await profileImageFetch(userDetails.image, "small");
            if (image) {
                console.log("inside load inside if");
                set_imageSrc(image)
                set_oldImageSrc(image)
                set_image(userDetails.image)
            }
        }
        set_name(userDetails.username)
        set_selectedKeywords(userDetails.keywords)
        set_selectedServices(userDetails.services)
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
        } catch (error) {
            console.error('Error uploading image:', error);
        }
    };

    // TODO (Navya) : Do not re-upload image if image has not changed. Check backend logs of updateProfile API for more details
    const updateProfile = async () => {
        SetLoadingStatus(true)
        if (oldImageSrc != imageSrc) {
            console.log("inside upload ", oldImageSrc, imageSrc, image)
            await uploadProfileImage(imageSrc)
            console.log("after upload ", image)
        }
        const updates = {
            email: userDetails.email,
            image: curr_filename ? curr_filename : image,
            username: name,
            keywords: selectedKeywords,
            services: selectedServices.map((x: any) => x._id),
            country: address.country,
            state: address.state,
            city: address.city,
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
            set_services(response.services || [])
        }
    }

    useEffect(() => {
        loadData()
        getKeywordsAndServices()
    }, [])

    /*** INPUT CHANGE HANDLERS ***/
    const on_nameChange = (name: string) => {
        set_name(name)
        set_enableToUpdate(validateName(name))
    }

    const on_phoneNumberChange = (phoneNumber: string) => {
        set_phoneNumber(phoneNumber);
        set_enableToUpdate(validatePhoneNumber(phoneNumber))
    }

    const on_addressChange = (address: Address) => {
        set_address(address)
        const isValid = validateAddress(address)
        set_enableToUpdate(isValid)
    }

    /*** INPUT CHANGE HANDLERS END ***/


    /*** INPUT VALIDATORS ***/
    // Return true if input is valid
    // Return false if input is invalid
    const validatePhoneNumber = (phoneNumber: string) => {
        if (phoneNumber.length > 0) {
            return true;
        }
        return false;
    }

    const validateName = (name: string) => {
        if (name.length >= 3 && !checkTitleNameInvalid('Username', name)) {
            return true;
        }
        return false;
    }

    const validateAddress = (address: Address) => {
        const availableStates = address.country ? State.getStatesOfCountry(address.country.isoCode) : []
        const availableCities = address.state ? City.getCitiesOfState(address.state?.countryCode, address.state?.isoCode) : []

        return (validateCountry(address.country) && validateState(address.state, availableStates) && validateCity(address.city, availableCities))
    }

    const validateCountry = (country: ICountry | null | undefined) => {
        if (!country) {
            return false;
        }
        return true;
    }

    const validateState = (state: IState | null | undefined, statesAvailable: IState[] | null) => {
        if (statesAvailable?.length && (!state || !statesAvailable.includes(state))) {
            return false;
        }
        return true;
    }

    const validateCity = (city: ICity | null, citiesAvailable: ICity[] | null) => {
        if (citiesAvailable?.length && (!city || !citiesAvailable.includes(city))) {
            return false;
        }
        return true;
    }

    /*** INPUT VALIDATORS END ***/


    // TODO (Navya) : Input component + Error component can be made a new component
    // TODO (Navya) : Button can be made a component
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
                <div className="w-full text-white flex flex-col justify-center items-center mt-8">

                    <ReactImagePickerEditor
                        config={{
                            borderRadius: '100%',
                            language: 'en',
                            width: '195px',
                            height: '195px',
                            objectFit: 'cover',
                            compressInitial: 50,
                            aspectRatio: 1
                        }}
                        imageSrcProp={imageSrc}
                        imageChanged={(newDataUri: any) => set_imageSrc(newDataUri)}
                    />
                    <div className="w-full max-w-[400px] mt-6">
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
                            onChange={(e) => on_nameChange(e.target.value)}
                        />
                        <ShowFieldError
                            show={!validateName(name)}
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
                            address={address}
                            on_Change={on_addressChange}
                        />

                        <div className="mt-6 text-grey text-[12px] leading-[19px]">Phone number *</div>
                        <PhoneInput
                            placeholder="Enter phone number"
                            value={phoneNumber}
                            onChange={(data) => on_phoneNumberChange(data)}
                        />
                        <ShowFieldError
                            show={!phoneNumber.length}
                            label="You have to provide your phone number"
                        />
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
                        className="w-[calc(50%-8px)] bg-green rounded-lg flex items-center justify-center disabled:opacity-50"
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
