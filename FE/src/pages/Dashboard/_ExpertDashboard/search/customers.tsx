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
import DatePickerField from "../../../../components/ui/DatePickerField";
import TimePickerField from "../../../../components/ui/TimePickerField";
import { SetLoadingStatus } from "../../../../actions/appActions";
import { filterApiServicesToCanonical } from "../../../../constants/serviceOptions";
import { useDispatch } from "react-redux";
import { setChosenChatDetails, setChosenGroupChatDetails } from "../../../../actions/chatActions";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../../../store";
import { fetchChatUserProfile } from "../../../../api/chatApi";
import { proposeIndividualAppointment } from "../../../../api/api";
import { normalizeExpertPrice } from "../../../../utils/schedulingSlots";
import { updateMe } from "../../../../actions/authActions";
import { showErrorAlert, showSuccessAlert, showWarningAlert } from "../../../../actions/alertActions";

const Customers = ({
    qCustomerId,
    selectedCustomer,
    selectCustomer
}: any) => {

    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { userDetails } = useAppSelector((state: any) => state.auth)
    const [proposeFor, setProposeFor] = useState<any>(null)
    const [proposeBusy, setProposeBusy] = useState(false)
    const [proposeTitle, setProposeTitle] = useState('')
    const [proposeDate, setProposeDate] = useState('')
    const [proposeStart, setProposeStart] = useState('')
    const [proposeDuration, setProposeDuration] = useState(30)
    const [proposePrice, setProposePrice] = useState('')
    const [proposePriceEdited, setProposePriceEdited] = useState(false)
    const [proposeCustomerEmail, setProposeCustomerEmail] = useState<string | null>(null)
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
            set_services(filterApiServicesToCanonical(response.services || []))
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

    const openPrivateChatWithCustomer = async (customerId: string) => {
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
            window.dispatchEvent(new Event("wl-open-chat-nav"));
          }
        } catch (err) {
          console.error("openPrivateChatWithCustomer error:", err);
        }
        SetLoadingStatus(false);
      };

    const proposeSuggestedPrice = (durationMin: number) => {
        const rate = normalizeExpertPrice((userDetails as any)?.price) ?? 0;
        return Math.round(((rate * durationMin) / 60) * 100) / 100;
    };

    const openProposeModal = (customer: any) => {
        setProposeFor(customer);
        setProposeTitle(`${customer?.username || "Student"} & ${userDetails?.username || "Expert"}`);
        setProposeDate("");
        setProposeStart("");
        setProposeDuration(30);
        setProposePrice(String(proposeSuggestedPrice(30)));
        setProposePriceEdited(false);
        setProposeCustomerEmail(null);
        void fetchChatUserProfile(String(customer._id)).then((r: any) => {
            if (r?.success && r?.result?.email) setProposeCustomerEmail(String(r.result.email));
        });
    };

    const submitPropose = async () => {
        if (!proposeTitle.trim()) {
            dispatch(showWarningAlert("Add a title for the session."));
            return;
        }
        if (!proposeDate || !proposeStart) {
            dispatch(showWarningAlert("Pick a date and start time."));
            return;
        }
        if (!proposeCustomerEmail) {
            dispatch(showErrorAlert("Still resolving the student — try again in a moment."));
            return;
        }
        const start = new Date(`${proposeDate}T${proposeStart}:00`);
        if (Number.isNaN(start.getTime())) {
            dispatch(showErrorAlert("That date/time isn't valid."));
            return;
        }
        if (start.getTime() <= Date.now()) {
            dispatch(showWarningAlert("Pick a time in the future."));
            return;
        }
        const end = new Date(start.getTime() + proposeDuration * 60000);
        const price = Math.round(Number(proposePrice) * 100) / 100;
        if (Number.isNaN(price) || price < 0) {
            dispatch(showWarningAlert("Enter a valid price for the session."));
            return;
        }

        setProposeBusy(true);
        SetLoadingStatus(true);
        const res: any = await proposeIndividualAppointment({
            name: proposeTitle.trim(),
            start,
            end,
            duration: proposeDuration,
            price,
            customer: proposeCustomerEmail,
        });
        SetLoadingStatus(false);
        setProposeBusy(false);
        if (res && res !== false) {
            if (res.userDetails) {
                dispatch({ type: "updateUserDetails", payload: res.userDetails });
            } else {
                dispatch(updateMe() as any);
            }
            dispatch(showSuccessAlert("Session proposed — the student will be notified to accept."));
            setProposeFor(null);
        }
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
                                    onClick={() => openPrivateChatWithCustomer(customer._id)}
                                    className="w-1/2 rounded-full border border-slate-200 text-[12px] text-slate-700 flex items-center justify-center hover:bg-slate-50"
                                    >
                                    Private Chat
                                    </button>
                                    <button
                                        className="w-1/2 px-3 py-2 rounded-full flex items-center justify-center bg-[#234C6A] text-white text-[12px] font-semibold disabled:opacity-50"
                                        disabled={customer.status === 'review'}
                                        onClick={() => {
                                            selectCustomer(customer);
                                            openProposeModal(customer);
                                        }}
                                    >
                                        Select
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                }
            </div>

            {
                proposeFor ?
                    <OverlayPortal closeModal={() => { if (!proposeBusy) setProposeFor(null); }}>
                        <div
                            className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                            onClick={() => { if (!proposeBusy) setProposeFor(null); }}
                        >
                            <div
                                className="w-full max-w-sm rounded-2xl p-5 relative shadow-xl border bg-white text-slate-900 border-slate-200"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    className="absolute right-3 top-3 rounded-md hover:bg-slate-100 p-1"
                                    onClick={() => { if (!proposeBusy) setProposeFor(null); }}
                                >
                                    <CloseIcon fontSize="small" />
                                </button>
                                <h3 className="text-lg font-semibold">Propose a session</h3>
                                <p className="mt-1 text-xs text-slate-500">
                                    {proposeFor?.username
                                        ? `${proposeFor.username} will get an invitation to accept or decline.`
                                        : "The student will get an invitation to accept or decline."}
                                </p>

                                <div className="mt-4 space-y-3">
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold">Title</label>
                                        <input
                                            type="text"
                                            value={proposeTitle}
                                            maxLength={100}
                                            onChange={(e) => setProposeTitle(e.target.value)}
                                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-[#234C6A]"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold">Date</label>
                                        <DatePickerField
                                            id="propose-date"
                                            value={proposeDate}
                                            onChange={setProposeDate}
                                            min={new Date().toLocaleDateString("en-CA")}
                                            placeholder="Select a date"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold">Start time</label>
                                        <TimePickerField
                                            id="propose-start-time"
                                            value={proposeStart}
                                            onChange={setProposeStart}
                                            placeholder="Select start time"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold">Duration</label>
                                        <select
                                            value={proposeDuration}
                                            onChange={(e) => {
                                                const next = Number(e.target.value);
                                                setProposeDuration(next);
                                                if (!proposePriceEdited) setProposePrice(String(proposeSuggestedPrice(next)));
                                            }}
                                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-[#234C6A]"
                                        >
                                            <option value={30}>30 min</option>
                                            <option value={60}>60 min</option>
                                            <option value={90}>90 min</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold">Price (USD)</label>
                                        <div className="relative">
                                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
                                            <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={proposePrice}
                                                onChange={(e) => { setProposePrice(e.target.value); setProposePriceEdited(true); }}
                                                className="w-full rounded-lg border pl-6 pr-3 py-2 text-sm outline-none border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-[#234C6A]"
                                            />
                                        </div>
                                        <p className="mt-1 text-[11px] text-slate-500">
                                            Prefilled from your rate for this duration — edit to set the final price the student will pay.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    disabled={proposeBusy}
                                    onClick={submitPropose}
                                    className="mt-5 w-full rounded-lg bg-[#234C6A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1b3c53] disabled:opacity-60"
                                >
                                    {proposeBusy ? "Sending…" : "Send proposal"}
                                </button>
                            </div>
                        </div>
                    </OverlayPortal> :
                    null
            }
        </div>
    );
};

export default Customers;
