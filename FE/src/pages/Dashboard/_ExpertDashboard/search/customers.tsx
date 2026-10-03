import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    doFilterCustomers,
    joinGeneralChat,
    joinPrivateChat,
    profileImageFetch,
} from "../../../../api/api";
import CloseIcon from "@mui/icons-material/Close";
import OverlayPortal from "../../../../components/OverayPortal";
import DatePickerField from "../../../../components/ui/DatePickerField";
import TimePickerField from "../../../../components/ui/TimePickerField";
import { SetLoadingStatus } from "../../../../actions/appActions";
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
import { notify } from '../../../../utils/notify';
import ClientsPage from '../clients/ClientsPage';
import InviteClientDialog from '../clients/InviteClientDialog';
import { collectRelationships, dedupeById, type ClientRow } from '../clients/clientModel';
import type { ClientActions } from '../clients/ui';

const NO_UNREAD: Record<string, number> = {};

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
    const [inviteOpen, setInviteOpen] = useState(false)
    const [customers, set_customers] = useState<Array<any>>([])
    const [imageUrls, setImageUrls] = useState<Record<string, string | null>>({})
    const requestedImages = useRef(new Set<string>())
    const unreadByRid = useAppSelector((state: any) => state.chat?.dmUnreadByRid) || NO_UNREAD

    const filterCustomers = async () => {
        SetLoadingStatus(true)
        const response = await doFilterCustomers({ _id: qCustomerId });

        if (response) {
            const unique = dedupeById<any>(response.result || [])
            set_customers(unique)
            if (qCustomerId) {
                selectCustomer(unique[0])
            }
        }
        SetLoadingStatus(false)
    }

    useEffect(() => {
        const users = [
            ...customers,
            ...Array.from(collectRelationships(userDetails, Date.now()).values()).map((r) => r.user),
        ]
        const pending = users.filter((u: any) => {
            const id = String(u?._id || '')
            return id && u?.image && !requestedImages.current.has(id)
        })
        if (!pending.length) return
        pending.forEach((u: any) => requestedImages.current.add(String(u._id)))
        void Promise.all(
            pending.map(async (u: any) => [String(u._id), await fetchCustomerProfile(u.image)] as const),
        ).then((entries) => {
            setImageUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
        })
    }, [customers, userDetails])

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

    const openClientProfile = (customer: any) => {
        setProfilePreview(imageUrls[String(customer._id)] || null);
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
            notify.warning("Add a title for the session.");
            return;
        }
        if (!proposeDate || !proposeStart) {
            notify.warning("Pick a date and start time.");
            return;
        }
        if (!proposeCustomerEmail) {
            notify.error("Still resolving the student — try again in a moment.");
            return;
        }
        const start = new Date(`${proposeDate}T${proposeStart}:00`);
        if (Number.isNaN(start.getTime())) {
            notify.error("That date/time isn't valid.");
            return;
        }
        if (start.getTime() <= Date.now()) {
            notify.warning("Pick a time in the future.");
            return;
        }
        const end = new Date(start.getTime() + proposeDuration * 60000);
        const price = Math.round(Number(proposePrice) * 100) / 100;
        if (Number.isNaN(price) || price < 0) {
            notify.warning("Enter a valid price for the session.");
            return;
        }

        if (hasBookingConflict(userDetails, start, end)) {
            setOutsideConfirm(false);
            notify.warning("You already have a session at this time. Pick another time.");
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
            notify.success("Session proposed — the student will be notified to accept.");
            setProposeFor(null);
        }
    };

    useEffect(() => {
        void filterCustomers()
    }, [qCustomerId])

    const actions = useMemo<ClientActions>(() => ({
        onOpenProfile: (row: ClientRow) => openClientProfile(row.raw),
        onMessage: (row: ClientRow) => openPrivateChatWithCustomer(row.id),
        onPropose: (row: ClientRow) => {
            selectCustomer(row.raw);
            openProposeModal(row.raw);
        },
    }), [imageUrls, userDetails, selectCustomer])

    return (
        <div className="w-full min-h-full relative bg-[#F5F3EF] px-4 py-6 sm:px-6 sm:py-8 text-[#1A3A4A]">
            <ClientsPage
                directory={customers}
                userDetails={userDetails}
                unreadByRid={unreadByRid}
                imageUrls={imageUrls}
                actions={actions}
                onInvite={() => setInviteOpen(true)}
            />

            <InviteClientDialog
                open={inviteOpen}
                students={customers}
                onClose={() => setInviteOpen(false)}
                onPick={(student) => {
                    setInviteOpen(false);
                    selectCustomer(student);
                    openProposeModal(student);
                }}
            />

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
