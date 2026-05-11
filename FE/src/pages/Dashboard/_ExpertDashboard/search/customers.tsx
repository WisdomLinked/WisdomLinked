import React, { useEffect, useState } from "react";
import {
    doFilterCustomers,
    doGetKeywordsAndServices,
    joinGeneralChat,
    joinPrivateChat,
    profileImageFetch,
} from "../../../../api/api";
import { getAvatarTitle } from "../../../../actions/common";
import { Rating } from "@mui/material";
import { Search as SearchIcon } from "lucide-react";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";
import SelectionWithCheckBox from "../../../../components/SelectionWithCheckBox";
import OverlayPortal from "../../../../components/OverayPortal";
import { SetLoadingStatus } from "../../../../actions/appActions";
import { useDispatch } from "react-redux";
import { setChosenChatDetails, setChosenGroupChatDetails } from "../../../../actions/chatActions";
import { useNavigate } from "react-router-dom";

const Customers = ({
    qCustomerId,
    selectedCustomer,
    selectCustomer
}: any) => {

    const dispatch = useDispatch()
    const navigate = useNavigate()
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
    const [selectedKeywords, set_selectedKeywords] = useState<Array<any>>([])
    const [selectedServices, set_selectedServices] = useState<Array<any>>([])
    const [sortBy, set_sortBy] = useState(sorts[0])
    const [nameFilter, set_nameFilter] = useState('')
    const [customers, set_customers] = useState<Array<any>>([])
    const [customersImage,set_customers_image]= useState<Array<any>>([])
    const [filterModalShow, set_filterModalShow] = useState(false)
    const [mobileView, set_mobileView] = useState(window.innerWidth <= 768)

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

    const joinPrivateChatOfCustomer = async (customerId: string) => {
        SetLoadingStatus(true);
        try {
          const response = await joinPrivateChat(customerId);
      
          if (response) {
            const { user, otherUser } = response as any;
      
            dispatch({
              type: "updateUserDetails",
              payload: user,
            });
      
            dispatch(
              setChosenChatDetails({
                userId: customerId,
                username: otherUser?.username,
                image: otherUser?.image,
                peerRole: String(otherUser?.role || '')
                  .toLowerCase()
                  .trim() || undefined,
              })
            );
      
            navigate(`${process.env.REACT_APP_AUTH_URL}expertdashboard/chat`);
          }
        } catch (err) {
          console.error("joinPrivateChatOfCustomer error:", err);
        }
        SetLoadingStatus(false);
      };

    useEffect(() => {
        let timer = setTimeout(() => {
            filterCustomers()
        }, 500)
        return (() => clearTimeout(timer))
    }, [qCustomerId, nameFilter, selectedKeywords, selectedServices, sortBy])

    useEffect(() => {
        getKeywordsAndServices();
        const onResize = () => set_mobileView(window.innerWidth <= 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return (
        <div className="w-full h-full relative bg-[#f8f7f4] text-[14px]">
            {/* Top filter bar */}
            <div className="w-full px-4 pt-4 pb-3 border-b border-slate-200 bg-[#f8fafc]">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1 flex items-center gap-2">
                        <div className="relative flex-1">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                className="w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]"
                                placeholder="Search by name or keyword"
                                value={nameFilter}
                                onChange={(e) => set_nameFilter(e.target.value)}
                            />
                        </div>
                        <div className="hidden md:flex items-center gap-2">
                            <SelectionWithCheckBox
                                options={sorts}
                                selectedOptions={sortBy}
                                set_selectedOptions={set_sortBy}
                                placeholder="Sort"
                                isMulti={false}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                            onClick={() => {
                                set_selectedKeywords([]);
                                set_selectedServices([]);
                                set_sortBy(sorts[0]);
                                set_nameFilter('');
                            }}
                        >
                            Reset
                        </button>
                        <div className="hidden md:flex items-center gap-2">
                            <SelectionWithCheckBox
                                options={keywords}
                                selectedOptions={selectedKeywords}
                                set_selectedOptions={set_selectedKeywords}
                                placeholder="Majors"
                                isMulti={true}
                            />
                            <SelectionWithCheckBox
                                options={services}
                                selectedOptions={selectedServices}
                                set_selectedOptions={set_selectedServices}
                                placeholder="Services"
                                isMulti={true}
                            />
                        </div>
                    </div>
                </div>
                {/* Filter chips (summary) */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedKeywords.map((k: any) => (
                        <span
                            key={k._id || k.value}
                            className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                        >
                            {k.value}
                        </span>
                    ))}
                    {selectedServices.map((s: any) => (
                        <span
                            key={s._id || s.value}
                            className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                        >
                            {s.value}
                        </span>
                    ))}
                </div>
            </div>

            {/* Customers grid */}
            <div className="w-full flex flex-wrap justify-center mt-4 gap-4 pb-6 px-4">
                {
                    customers.map((customer,i) => (
                        <div
                            key={`customer_${customer._id}`}
                            className={`w-full max-w-[260px] rounded-2xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow relative ${
                                selectedCustomer?._id === customer._id ? 'ring-2 ring-[#234C6A]' : ''
                            }`}
                        >
                            <div className="w-full h-[180px] bg-slate-200 flex items-center justify-center overflow-hidden">
                                {
                                    customer.image ?
                                        <img src={customersImage[i]} className="w-full h-full object-cover object-center" /> :
                                        <div className="w-[80px] h-[80px] rounded-full border-2 border-white text-2xl text-white font-bold flex items-center justify-center bg-slate-500/60">
                                            {getAvatarTitle(customer.username)}
                                        </div>
                                }
                            </div>
                            <div className="w-full p-3 flex flex-col items-stretch justify-center">
                                <div className="text-[15px] text-slate-900 font-semibold text-center">
                                    {customer.username}
                                </div>
                                <div className="text-[12px] text-slate-500 text-center">
                                    {customer.title}
                                </div>
                                <div className="mt-2 flex items-center justify-center">
                                    <Rating name="read-only" size="small" value={customer.rating || 0} readOnly />
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1 justify-center">
                                    {customer.keywords?.slice(0, 3).map((k: any) => (
                                        <span
                                            key={k._id}
                                            className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700"
                                        >
                                            {k.value}
                                        </span>
                                    ))}
                                </div>
                                <div className="w-full flex gap-2 mt-4">
                                    <button
                                    onClick={() => joinPrivateChatOfCustomer(customer._id)}
                                    className="w-1/2 rounded-full border border-slate-200 text-[12px] text-slate-700 flex items-center justify-center hover:bg-slate-50"
                                    >
                                    Private Chat
                                    </button>
                                    <button
                                        className="w-1/2 px-3 py-2 rounded-full flex items-center justify-center bg-[#234C6A] text-white text-[12px] font-semibold disabled:opacity-50"
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
        </div>
    );
};

export default Customers;
