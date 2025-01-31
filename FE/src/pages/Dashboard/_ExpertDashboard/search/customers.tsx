import React, { useEffect, useState } from "react";
import {doFilterCustomers, doGetKeywordsAndServices, joinGeneralChat, profileImageFetch} from "../../../../api/api";
import { getAvatarTitle } from "../../../../actions/common";
import { Rating } from "@mui/material";
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import SelectionWithCheckBox from "../../../../components/SelectionWithCheckBox";
import { useAppSelector } from "../../../../store";
import OverlayPortal from "../../../../components/OverayPortal";
import { SetLoadingStatus } from "../../../../actions/appActions";
import { updateMe } from "../../../../actions/authActions";
import { useDispatch } from "react-redux";
import { setChosenGroupChatDetails } from "../../../../actions/chatActions";
import { useNavigate } from "react-router-dom";

const Customers = ({
    qCustomerId,
    selectedCustomer,
    selectCustomer
}: any) => {

    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { auth: { userDetails } } = useAppSelector((state) => state);
    const [keywords, set_keywords] = useState([])
    const [services, set_services] = useState([])
    const sorts = [
        {
            value: "Name in ASC",
            label: "Name in ASC"
        },
        {
            value: "Name in DESC",
            label: "Name in DESC"
        }
    ]
    const [selectedKeywords, set_selectedKeywords] = useState<Array<any>>(userDetails.keywords || [])
    const [selectedServices, set_selectedServices] = useState<Array<any>>(userDetails.services || [])
    const [sortBy, set_sortBy] = useState(sorts[0])
    const [nameFilter, set_nameFilter] = useState('')
    const [customers, set_customers] = useState<Array<any>>([])
    const [filterModalShow, set_filterModalShow] = useState(false)
    const [mobileView, set_mobileView] = useState(window.innerWidth <= 768)
    const [customersImage,set_customers_image]= useState<Array<any>>([])

    const getKeywordsAndServices = async () => {
        const response: any = await doGetKeywordsAndServices();
        if (response) {
            set_keywords(response.keywords || [])
            set_services(response.services || [])
        }
    }

    const filterCustomers = async () => {
        SetLoadingStatus(true)
        const response = await doFilterCustomers({
            _id: qCustomerId,
            username: nameFilter,
            keywords: selectedKeywords,
            services: selectedServices,
            sortBy: sortBy.value
        });

        if (response) {
            console.log(response.result, '========')
            set_customers([...response.result])
            const imagePromises = response.result.map((customer: any) =>
                    fetchCustomerProfile(customer.image)
            );

            const customerImages = await Promise.all(imagePromises);
            set_customers_image(customerImages);
            console.log("customerImaged", customerImages)
            if (qCustomerId) {
                selectCustomer(response.result?.[0])
            }
        }
        SetLoadingStatus(false)
    }

    const fetchCustomerProfile = async (customerId: string | null) => {
        try {
            if (!customerId) {
                return null;
            }
            const res = await profileImageFetch(customerId, "medium");
            return res;
        } catch (err) {
            console.error("Error while fetching customer profile:", err);
            return null; // Ensure null is returned in case of an error
        }
    };


    const joinGeneralChatOfCustomer = async (otherUserId: string) => {
        SetLoadingStatus(true)
        const response = await joinGeneralChat(otherUserId)
        if (response) {
            const currentGeneralChat = response.user.generalChats.find((x: any) => x.admin._id === otherUserId)
            dispatch({
                type: 'updateUserDetails',
                payload: response.user
            })
            dispatch(setChosenGroupChatDetails({
                ...currentGeneralChat,
                groupId: currentGeneralChat._id,
                groupName: currentGeneralChat.name,
            }))
            navigate(`${process.env.REACT_APP_AUTH_URL}expertdashboard/chat`)
        }
        SetLoadingStatus(false)
    }

    useEffect(() => {
        let timer = setTimeout(() => {
            filterCustomers()
        }, 500)
        return (() => clearTimeout(timer))
    }, [qCustomerId, nameFilter, selectedKeywords, selectedServices, sortBy])

    useEffect(() => {
        getKeywordsAndServices()
        window.addEventListener('resize', () => {
            set_mobileView(window.innerWidth <= 768)
        })
        return () => {
            window.removeEventListener('resize', () => {
                set_mobileView(window.innerWidth <= 768)
            })
        }
    }, [])

    return (
        <div className="w-full h-full relative text-white">
            <div className={`hidden w-full py-1 bg-darkgrey-1 md:grid grid-cols-1 md:grid-cols-2 gap-4 ${qCustomerId ? 'md:hidden' : ''}`}>
                <div>
                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by name</div>
                    <input
                        className="w-full rounded-[15px] h-[50px] bg-transparent border border-lightgrey text-[14px] leading-[21px] px-[24px]"
                        placeholder="Input name"
                        value={nameFilter}
                        onChange={(e) => set_nameFilter(e.target.value)}
                    />
                </div>
                <div>
                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Sort by</div>
                    <SelectionWithCheckBox
                        options={sorts}
                        selectedOptions={sortBy}
                        set_selectedOptions={set_sortBy}
                        placeholder="Sort by"
                        isMulti={false}
                    />
                </div>
                <div>
                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by majors</div>
                    <SelectionWithCheckBox
                        options={keywords}
                        selectedOptions={selectedKeywords}
                        set_selectedOptions={set_selectedKeywords}
                        placeholder="Select majors"
                        isMulti={true}
                    />
                </div>
                <div>
                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by services</div>
                    <SelectionWithCheckBox
                        options={services}
                        selectedOptions={selectedServices}
                        set_selectedOptions={set_selectedServices}
                        placeholder="Select services"
                        isMulti={true}
                    />
                </div>
            </div>
            <div className="w-full flex flex-wrap justify-center mt-6 gap-6 pb-6">
                {
                    customers.map((customer,i) => (
                        <div
                            key={`customer_${customer._id}`}
                            className={`w-[250px] rounded-md bg-darkgrey overflow-clip hoverBox relative ${selectedCustomer?._id === customer._id ? 'border-[2px] border-green' : ''}`}
                        >
                            <div className="absolute top-0 left-0 w-full h-[250px] bg-black bg-opacity-10 backdrop-blur-sm hidden">
                                <div className="w-full max-h-full overflow-y-auto">
                                    <div className="w-full h-fit m-auto overflow-y-auto !flex flex-col justify-center items-center text-base space-y-2 p-4 text-white">
                                        <div className="w-full">
                                            <span className="text-green font-bold">Bio : </span>
                                            {customer.description || 'Customer has no bio'}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            <span className="text-green font-bold">Majors : </span>
                                            {
                                                customer.keywords?.map((keyword: any) => <span className="bg-grey text-lightgrey rounded-sm py-0.5 px-1" key={keyword._id}>{keyword.value}</span>)
                                            }
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            <span className="text-green font-bold">Services : </span>
                                            {
                                                customer.services?.map((service: any) => <span className="bg-grey text-lightgrey rounded-sm py-0.5 px-1" key={service._id}>{service.value}</span>)
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="w-full h-[250px] bg-midgrey !flex items-center justify-center">
                                {
                                    customer.image ?
                                        <img src={customersImage[i]} className="w-full h-full object-cover object-center" /> :
                                        <div className="w-[100px] h-[100px] rounded-full border-2 border-lightgrey text-4xl text-white font-bold !flex items-center justify-center">
                                            {getAvatarTitle(customer.username)}
                                        </div>
                                }
                            </div>
                            <div className="w-full p-2 pb-3 !flex flex-col items-center justify-center">
                                <div className="text-2xl text-center text-white font-bold">{customer.username}</div>
                                <div className="text-md text-center text-lightgrey">{customer.title}</div>
                                <Rating name="read-only" className="mt-2" value={customer.rating || 0} readOnly />
                                <div className="w-full flex space-x-4 mt-4">
                                    <button
                                        className="w-[calc(50%-8px)] rounded-lg border text-lightgrey border-lightgrey flex items-center justify-center"
                                        onClick={() => joinGeneralChatOfCustomer(customer._id)}
                                    >
                                        General Chat
                                    </button>
                                    <button
                                        className="w-[calc(50%-8px)] p-2 mx-auto rounded-[14px] flex items-center justify-center bg-green text-white text-[16px] leading-[24px] disabled:opacity-50"
                                        disabled={customer.status === 'review'}
                                        onClick={() => selectCustomer(customer)}
                                    >
                                        Select
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                }
            </div>
            <button
                className={`fixed bottom-4 right-4 w-14 h-14 rounded-full bg-grey shadow-md text-white md:hidden flex items-center justify-center ${qCustomerId ? 'hidden' : ''}`}
                onClick={() => set_filterModalShow(true)}
            >
                <FilterListIcon fontSize="large" />
            </button>
            {
                filterModalShow && mobileView && !qCustomerId ?
                    <OverlayPortal closeModal={() => set_filterModalShow(false)}>
                        <div className="absolute bottom-0 left-0 w-full h-full bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-end">
                            <div className="absolute top-0 left-0 w-full h-full" onClick={() => set_filterModalShow(false)}></div>
                            <div className="relative z-10 px-6 py-10 bg-darkgrey-1 text-white w-full h-max max-h-[90vh] overflow-y-auto">
                                <button
                                    className="absolute right-2 top-2 rounded-md hover:bg-grey"
                                    onClick={() => set_filterModalShow(false)}
                                >
                                    <CloseIcon />
                                </button>
                                <div>
                                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by name</div>
                                    <input
                                        className="w-full rounded-[15px] h-[50px] bg-transparent border border-lightgrey text-[14px] leading-[21px] px-[24px]"
                                        placeholder="Input name"
                                        value={nameFilter}
                                        onChange={(e) => set_nameFilter(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Sort by</div>
                                    <SelectionWithCheckBox
                                        options={sorts}
                                        selectedOptions={sortBy}
                                        set_selectedOptions={set_sortBy}
                                        placeholder="Sort by"
                                        isMulti={false}
                                    />
                                </div>
                                <div>
                                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by majors</div>
                                    <SelectionWithCheckBox
                                        options={keywords}
                                        selectedOptions={selectedKeywords}
                                        set_selectedOptions={set_selectedKeywords}
                                        placeholder="Select majors"
                                        isMulti={true}
                                    />
                                </div>
                                <div>
                                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by services</div>
                                    <SelectionWithCheckBox
                                        options={services}
                                        selectedOptions={selectedServices}
                                        set_selectedOptions={set_selectedServices}
                                        placeholder="Select services"
                                        isMulti={true}
                                    />
                                </div>
                            </div>
                        </div>
                    </OverlayPortal> :
                    null
            }

        </div>
    );
};

export default Customers;
