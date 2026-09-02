import React, { useEffect, useMemo, useState } from "react";
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
import CloseIcon from "@mui/icons-material/Close";
import OverlayPortal from "../../../../components/OverayPortal";
import DatePickerField from "../../../../components/ui/DatePickerField";
import TimePickerField from "../../../../components/ui/TimePickerField";
import FilterDropdown, { type FilterOption } from "../../../../components/ui/FilterDropdown";
import { SetLoadingStatus } from "../../../../actions/appActions";
import { serviceDropdownRowsFromApi } from "../../../../constants/serviceOptions";
import { useDispatch } from "react-redux";
import { setChosenChatDetails, setChosenGroupChatDetails } from "../../../../actions/chatActions";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../../../store";
import { fetchChatUserProfile } from "../../../../api/chatApi";
import ProfileModal from "../../Messenger/Messages/ProfileModal";
import { proposeIndividualAppointment } from "../../../../api/api";
import { proposedTimeNeedsOverride, hasBookingConflict, presetAvailabilityRanges } from "../../../../utils/proposeAvailability";
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
    const [outsideConfirm, setOutsideConfirm] = useState(false)
    const [profileFor, setProfileFor] = useState<any>(null)
    const [profilePreview, setProfilePreview] = useState<string | null>(null)
    const [keywords, set_keywords] = useState<Array<any>>([])
    const [services, set_services] = useState<Array<any>>([])
    const sorts: FilterOption[] = [
        { value: "Name in ASC", label: "Name in ASC" },
        { value: "Name in DESC", label: "Name in DESC" },
    ]
    const [selectedMajor, set_selectedMajor] = useState('all')
    const [selectedService, set_selectedService] = useState('all')
    const [sortBy, set_sortBy] = useState(sorts[0].value)
    const [nameFilter, set_nameFilter] = useState('')
    const [customers, set_customers] = useState<Array<any>>([])
    const [customersImage,set_customers_image]= useState<Array<any>>([])

    const majorOptions = useMemo<FilterOption[]>(
        () => [
            { value: 'all', label: 'All majors' },
            ...keywords.map((k: any) => ({ value: String(k._id), label: k.value || '' })),
        ],
        [keywords],
    )
    const serviceOptions = useMemo<FilterOption[]>(
        () => [
            { value: 'all', label: 'All services' },
            ...services.map((s: any) => ({ value: String(s._id), label: s.value || '' })),
        ],
        [services],
    )

    const getKeywordsAndServices = async () => {
        const response: any = await doGetKeywordsAndServices();
        if (response) {
            set_keywords(
                (response.keywords || []).map((k: any) => ({ _id: String(k._id), value: k.value || '' })),
            )
            set_services(serviceDropdownRowsFromApi(response.services || []))
        }
    }

    const filterCustomers = async () => {
        SetLoadingStatus(true)
        const response = await doFilterCustomers({
            _id: qCustomerId,
            username: nameFilter.trim(),
            keywords: selectedMajor !== 'all' ? [{ _id: selectedMajor }] : [],
            services: selectedService !== 'all' ? [{ _id: selectedService }] : [],
            sortBy
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

    const openClientProfile = (customer: any, index: number) => {
        setProfilePreview(customersImage[index] || null);
        setProfileFor(customer);
        void fetchChatUserProfile(String(customer._id)).then((r: any) => {
            if (r?.success && r?.result) {
                setProfileFor((prev: any) =>
                    prev && prev._id === customer._id ? { ...customer, ...r.result } : prev
                );
            }
        });
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
        setOutsideConfirm(false);
        void fetchChatUserProfile(String(customer._id)).then((r: any) => {
            if (r?.success && r?.result?.email) setProposeCustomerEmail(String(r.result.email));
        });
    };

    const submitPropose = async (override = false) => {
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

        if (hasBookingConflict(userDetails, start, end)) {
            setOutsideConfirm(false);
            dispatch(showWarningAlert("You already have a session at this time. Pick another time."));
            return;
        }

        const needsOverride = proposedTimeNeedsOverride(userDetails, start, end);
        if (needsOverride && !override) {
            setOutsideConfirm(true);
            return;
        }
        setOutsideConfirm(false);

        setProposeBusy(true);
        SetLoadingStatus(true);
        const res: any = await proposeIndividualAppointment({
            name: proposeTitle.trim(),
            start,
            end,
            duration: proposeDuration,
            price,
            customer: proposeCustomerEmail,
            overrideAvailability: needsOverride,
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
    }, [qCustomerId, nameFilter, selectedMajor, selectedService, sortBy])

    useEffect(() => {
        getKeywordsAndServices();
    }, []);

    return (
        <div className="w-full min-h-full relative bg-[#F5F3EF] px-6 py-8 text-[#1A3A4A]">
            <header className="mb-6 border-b border-[#E5E2DB] pb-5">
                <h1 className="font-serif text-[2.5rem] font-medium leading-tight text-[#1A3A4A]">
                    Find Clients
                </h1>
                <p className="mt-2 max-w-xl text-sm font-sans text-[#7A7A72]">
                    Browse students looking for Study Abroad, Work Abroad, and Research Guidance.
                </p>
            </header>

            <section className="mb-8 border-b border-[#E5E2DB] pb-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 border-b border-[#E5E2DB] pb-2">
                            <SearchIcon className="h-4 w-4 text-[#7A7A72]" aria-hidden />
                            <input
                                type="text"
                                value={nameFilter}
                                onChange={(e) => set_nameFilter(e.target.value)}
                                placeholder="Search by name, institution, or field..."
                                className="w-full bg-transparent text-sm font-sans text-[#1A3A4A] placeholder:text-[#B2AEA2] outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 md:flex-row md:justify-end md:gap-4">
                        <FilterDropdown
                            label="Filter by major"
                            value={selectedMajor}
                            options={majorOptions}
                            onChange={set_selectedMajor}
                            widthClass="md:w-44"
                        />

                        <FilterDropdown
                            label="Filter by service"
                            value={selectedService}
                            options={serviceOptions}
                            onChange={set_selectedService}
                            widthClass="md:w-44"
                        />

                        <FilterDropdown
                            label="Sort by"
                            value={sortBy}
                            options={sorts}
                            onChange={set_sortBy}
                            widthClass="md:w-44"
                        />
                    </div>
                </div>
            </section>

            {customers.length === 0 && (
                <section className="mt-16 flex flex-col items-center justify-center text-center text-[#7A7A72]">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[#E5E2DB]">
                        <SearchIcon className="h-5 w-5" aria-hidden />
                    </div>
                    <h2 className="font-serif text-lg text-[#1A3A4A]">No clients found</h2>
                    <p className="mt-1 max-w-sm text-xs font-sans text-[#7A7A72]">
                        Try adjusting your search, clearing a filter, or exploring a different field or service.
                    </p>
                </section>
            )}

            {/* Customers grid */}
            <div className="w-full flex flex-wrap justify-center gap-4 pb-6">
                {
                    customers.map((customer,i) => (
                        <div
                            key={`customer_${customer._id}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => openClientProfile(customer, i)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openClientProfile(customer, i);
                                }
                            }}
                            className={`w-full max-w-[260px] flex flex-col rounded-2xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow relative cursor-pointer ${
                                selectedCustomer?._id === customer._id ? 'ring-2 ring-[#234C6A]' : ''
                            }`}
                        >
                            <div className="w-full h-[180px] shrink-0 bg-slate-200 flex items-center justify-center overflow-hidden">
                                {
                                    customer.image ?
                                        <img src={customersImage[i]} className="w-full h-full object-cover object-center" /> :
                                        <div className="w-[80px] h-[80px] rounded-full border-2 border-white text-2xl text-white font-bold flex items-center justify-center bg-slate-500/60">
                                            {getAvatarTitle(customer.username)}
                                        </div>
                                }
                            </div>
                            <div className="w-full flex-1 p-3 flex flex-col items-stretch">
                                <div className="text-[15px] text-slate-900 font-semibold text-center">
                                    {customer.username}
                                </div>
                                <div className="text-[12px] text-slate-500 text-center">
                                    {customer.title}
                                </div>
                                <div className="mt-2 flex items-center justify-center">
                                    <Rating name="read-only" size="small" value={customer.rating || 0} readOnly />
                                </div>
                                <div className="mt-2 min-h-[40px] flex flex-wrap gap-1 justify-center content-start">
                                    {customer.keywords?.slice(0, 3).map((k: any) => (
                                        <span
                                            key={k._id}
                                            className="inline-flex items-center h-[18px] rounded-full bg-slate-100 px-2 text-[10px] text-slate-700"
                                        >
                                            {k.value}
                                        </span>
                                    ))}
                                </div>
                                <div className="w-full flex gap-2 mt-auto pt-4">
                                    <button
                                    onClick={(e) => { e.stopPropagation(); openPrivateChatWithCustomer(customer._id); }}
                                    className="w-1/2 px-3 py-2 rounded-full border border-slate-200 text-[12px] text-slate-700 flex items-center justify-center hover:bg-slate-50"
                                    >
                                    Private Chat
                                    </button>
                                    <button
                                        className="w-1/2 px-3 py-2 rounded-full flex items-center justify-center bg-[#234C6A] text-white text-[12px] font-semibold disabled:opacity-50"
                                        disabled={customer.status === 'review'}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            selectCustomer(customer);
                                            openProposeModal(customer);
                                        }}
                                    >
                                        Propose a session
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
                                            onChange={(v: string) => { setProposeDate(v); setOutsideConfirm(false); }}
                                            min={new Date().toLocaleDateString("en-CA")}
                                            placeholder="Select a date"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold">Start time</label>
                                        <TimePickerField
                                            id="propose-start-time"
                                            value={proposeStart}
                                            onChange={(v: string) => { setProposeStart(v); setOutsideConfirm(false); }}
                                            placeholder="Select start time"
                                        />
                                    </div>
                                    {proposeDate ? (
                                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                                            {(() => {
                                                const ranges = presetAvailabilityRanges(userDetails, proposeDate);
                                                return ranges.length ? (
                                                    <>
                                                        <span className="font-semibold">Your preset availability this day:</span>{" "}
                                                        {ranges.join(", ")}
                                                    </>
                                                ) : (
                                                    <span>You have no preset availability on this day.</span>
                                                );
                                            })()}
                                        </div>
                                    ) : null}
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold">Duration</label>
                                        <select
                                            value={proposeDuration}
                                            onChange={(e) => {
                                                const next = Number(e.target.value);
                                                setProposeDuration(next);
                                                setOutsideConfirm(false);
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

                                {outsideConfirm ? (
                                    <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-3">
                                        <p className="text-xs text-amber-800">
                                            Your chosen time is outside your preset availability. Click <span className="font-semibold">Yes</span> to continue, or <span className="font-semibold">No</span> to re-select your time slot.
                                        </p>
                                        <div className="mt-3 flex gap-2">
                                            <button
                                                type="button"
                                                disabled={proposeBusy}
                                                onClick={() => setOutsideConfirm(false)}
                                                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                                            >
                                                No, re-select
                                            </button>
                                            <button
                                                type="button"
                                                disabled={proposeBusy}
                                                onClick={() => submitPropose(true)}
                                                className="flex-1 rounded-lg bg-[#234C6A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b3c53] disabled:opacity-60"
                                            >
                                                {proposeBusy ? "Sending…" : "Yes, continue"}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={proposeBusy}
                                        onClick={() => submitPropose()}
                                        className="mt-5 w-full rounded-lg bg-[#234C6A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1b3c53] disabled:opacity-60"
                                    >
                                        {proposeBusy ? "Sending…" : "Send proposal"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </OverlayPortal> :
                    null
            }

            <ProfileModal
                isOpen={!!profileFor}
                onClose={() => setProfileFor(null)}
                userDetails={profileFor || {}}
                viewerRole={(userDetails as any)?.role}
                previewImage={profilePreview}
            />
        </div>
    );
};

export default Customers;
