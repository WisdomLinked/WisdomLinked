import React, { useEffect, useMemo, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";

import EventDetail from "./eventDetail";
import SeminarDetails from "../seminarDetails";
import StudentCalendar, { type Meeting } from "../../../components/dashboard/StudentCalendar";

import {
  doAcceptEvent,
  doCancelInvitation,
  doDeclineEvent,
  doGetMyEvents,
  cancelIndividualAppointment,
} from "../../../api/api";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../../../store";
import { SetLoadingStatus } from "../../../actions/appActions";
import { updateMe } from "../../../actions/authActions";
import { useNavigate } from "react-router-dom";
import { openExpertChatWithUser } from "../../../utils/expertOpenChatWithUser";
import { toYMDLocal } from "../../../utils/schedulingTimezone";
import { canonicalLabelsFromMixedServiceEntries } from "../../../constants/serviceOptions";
import { usePeerProfileModal } from "../../../hooks/usePeerProfileModal";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "45 min · Study Abroad" line for a session/seminar card. */
const meetingDetailsLine = (e: any): string => {
  const parts: string[] = [];
  if (e?.duration) parts.push(`${e.duration} min`);
  const purpose =
    (typeof e?.purposeOther === "string" && e.purposeOther.trim()) ||
    canonicalLabelsFromMixedServiceEntries(e?.services)[0] ||
    "";
  if (purpose) parts.push(purpose);
  return parts.join(" · ");
};

const ExpertCalendar: React.FC = () => {
  const {
    auth: { userDetails },
  } = useAppSelector((state: any) => state);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { openPeerProfile, peerProfileModal } = usePeerProfileModal(userDetails?.role);

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [eventModalShow, setEventModalShow] = useState<boolean>(false);
  const [seminarModalShow, setSeminarModalShow] = useState<boolean>(false);

  // Map the expert's events/group chats to the shared calendar's Meeting shape,
  // carrying the original record on `raw` so clicks can reopen the detail modals.
  const meetings: Meeting[] = useMemo(() => {
    return (events || [])
      .map((e: any) => {
        const start = new Date(e.start);
        if (Number.isNaN(start.getTime())) return null;
        const isSeminar = e.type === "seminar";
        const rawStatus = String(e.status || "").toLowerCase();
        let status: Meeting["status"] = "confirmed";
        if (rawStatus === "draft") status = "draft";
        else if (rawStatus === "declined") status = "declined";
        else if (rawStatus === "pending") status = "pending";

        const withLabel = isSeminar
          ? `${Array.isArray(e.participants) ? e.participants.length : 0} attendees`
          : e.customer?.username
            ? `With ${e.customer.username}`
            : "1:1 session";

        // A 1:1 session has a single peer (the student), used for the profile card.
        // Seminars have many participants and are excluded here (roster is elsewhere).
        let peerUserId: string | undefined;
        let peerName: string | undefined;
        let peerImage: string | null = null;
        if (!isSeminar) {
          const meId = String(userDetails?._id ?? "");
          const parts: any[] = Array.isArray(e.participants) ? e.participants : [];
          const peer =
            e.customer || parts.find((p: any) => String(p?._id ?? p) !== meId);
          if (peer && typeof peer === "object") {
            peerUserId = peer._id != null ? String(peer._id) : undefined;
            peerName = peer.username;
            peerImage = peer.image ?? null;
          }
        }

        return {
          id: String(e.id ?? e._id),
          title: e.title || e.name || (isSeminar ? "Seminar" : "1:1 session"),
          date: toYMDLocal(start),
          time: `${pad2(start.getHours())}:${pad2(start.getMinutes())}`,
          with: withLabel,
          location: "Online · WisdomLinked",
          details: meetingDetailsLine(e),
          type: isSeminar ? "seminar" : "session",
          status,
          recurrence: isSeminar && e.isRecurring ? e.recurrenceFrequency ?? null : null,
          seriesId: isSeminar && e.seriesId ? String(e.seriesId) : null,
          peerUserId,
          peerName,
          peerImage,
          raw: e,
        } as Meeting;
      })
      .filter(Boolean) as Meeting[];
  }, [events, userDetails?._id]);

  const handleSelectEvent = (event: any) => {
    if (!event) return;
    setSelectedEvent(event);
    if (event.type === "event") {
      setEventModalShow(true);
    } else {
      setSeminarModalShow(true);
    }
  };

  const declineEvent = async () => {
    if (!selectedEvent) return;
    SetLoadingStatus(true);
    const response = await doDeclineEvent(selectedEvent._id);
    SetLoadingStatus(false);
    if (response) {
      const updated = { ...selectedEvent, status: "declined" };
      setSelectedEvent(updated);
      const temp = [...events];
      const index = temp.findIndex((x) => x.id === selectedEvent.id);
      if (index > -1) {
        temp[index].status = "declined";
        setEvents(temp);
      }
    }
  };

  const acceptEvent = async () => {
    if (!selectedEvent) return;
    SetLoadingStatus(true);
    const response = await doAcceptEvent(selectedEvent._id);
    SetLoadingStatus(false);
    if (response) {
      const updated = { ...selectedEvent, status: "accepted" };
      setSelectedEvent(updated);
      const temp = [...events];
      const index = temp.findIndex((x) => x.id === selectedEvent.id);
      if (index > -1) {
        temp[index].status = "accepted";
        setEvents(temp);
      }
    }
  };

  const navigateCustomer = async (item: any) => {
    if (!item) return;
    await openExpertChatWithUser({
      dispatch,
      navigate,
      userDetails,
      otherUser: {
        _id: item._id,
        username: item.username,
        image: item.image,
      },
    });
    window.dispatchEvent(new Event("wl-open-chat-nav"));
  };

  const navigateSeminar = (item: any) => {
    if (!item?._id) return;
    localStorage.setItem("wl_open_seminar_id", String(item._id));
    window.dispatchEvent(new Event("wl-open-chat-nav"));
  };

  // Seminars open their group chat; 1:1 sessions open a private DM with the
  // customer, mirroring the student calendar's join routing.
  const enterChatForSelected = (item: any) => {
    if (!item) return;
    if (item.type === "individual") {
      const me = String(userDetails?._id ?? "");
      const participants: any[] = Array.isArray(item.participants) ? item.participants : [];
      const other =
        participants.find((p: any) => String(p?._id ?? p) !== me) ?? item.customer;
      if (other?._id) {
        navigateCustomer({ _id: other._id, username: other.username, image: other.image });
        return;
      }
    }
    navigateSeminar(item);
  };

  const getEvents = async () => {
    setLoading(true);
    SetLoadingStatus(true);
    const response = await doGetMyEvents();
    SetLoadingStatus(false);
    setLoading(false);
    if (response) {
      dispatch({ type: "updateUserDetails", payload: response.result });

      const temp: any[] = response.result.events.map((event: any) => ({
        ...event,
        id: event._id,
        title: event.title || "Session",
        start: new Date(event.start),
        end: new Date(event.end),
        type: "event",
      }));

      const meId = userDetails?._id;
      response.result.groupChats.forEach((g: any) => {
        const createdById = g.createdBy?._id ?? g.createdBy;
        const iAmCreator =
          createdById != null &&
          meId != null &&
          String(createdById) === String(meId);
        const shouldPush =
          g.status !== "pending" || !g.createdBy || iAmCreator;

        if (shouldPush) {
          const start = g.start ? new Date(g.start) : null;
          // A draft may be saved without a date yet — can't place it on the grid.
          if (!start || Number.isNaN(start.getTime())) return;
          temp.push({
            ...g,
            id: g._id,
            start,
            end: g.end ? new Date(g.end) : start,
            title: g.name || (g.type === "seminar" ? "Seminar" : "1:1 session"),
            type: g.type,
            status: g.status,
          });
        }
      });

      setEvents(temp);
    }
  };

  const cancelInvitation = async (id: string) => {
    SetLoadingStatus(true);
    const response = await doCancelInvitation(id);
    if (response) {
      setEventModalShow(false);
      setSelectedEvent(null);
      dispatch(updateMe());
      const temp = events.filter((x) => x.id !== id);
      setEvents(temp);
    }
    SetLoadingStatus(false);
  };

  const cancelAppointment = async (id: string) => {
    SetLoadingStatus(true);
    const response = await cancelIndividualAppointment(id);
    if (response) {
      dispatch(updateMe());
      getEvents();
    }
    setSeminarModalShow(false);
    setSelectedEvent(null);
    SetLoadingStatus(false);
  };

  useEffect(() => {
    getEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <StudentCalendar
        mode="expert"
        meetings={meetings}
        loading={loading}
        onSelectMeeting={(m) => handleSelectEvent(m.raw)}
        onViewProfile={(m) =>
          openPeerProfile({
            userId: String(m.peerUserId || ""),
            username: m.peerName,
            image: m.peerImage,
          })
        }
        title="Calendar"
        subtitle="See your upcoming seminars and 1:1 sessions, and jump into details."
        loadingLabel="Loading your sessions…"
      />
      {peerProfileModal}

      {eventModalShow ? (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div
            className="absolute top-0 left-0 w-full h-full cursor-pointer"
            onClick={() => { setSelectedEvent(null); setEventModalShow(false); }}
          />
          <div className="w-full max-w-[520px] bg-white rounded-2xl text-slate-900 p-6 relative shadow-xl">
            <div className="text-center text-slate-900 text-2xl mb-6 font-semibold">Event Details</div>
            <button
              className="absolute right-2 top-2 rounded-md hover:bg-slate-100 p-1"
              onClick={() => { setSelectedEvent(null); setEventModalShow(false); }}
            >
              <CloseIcon />
            </button>

            {selectedEvent?.paidBy === "none" ? (
              <div className="flex space-x-3 items-center text-sky-700 text-xl mb-4">
                <div className="w-3 h-3 bg-sky-500 block rounded-full" />
                <div>Invitation sent</div>
              </div>
            ) : selectedEvent?.status === "accepted" ? (
              <div className="flex space-x-3 items-center text-emerald-700 text-xl mb-4">
                <div className="w-3 h-3 bg-emerald-500 block rounded-full" />
                <div>Accepted</div>
              </div>
            ) : selectedEvent?.status === "pending" ? (
              <div className="flex space-x-3 items-center text-amber-700 text-xl mb-4">
                <div className="w-3 h-3 bg-amber-500 block rounded-full" />
                <div>Pending</div>
              </div>
            ) : (
              <div className="flex space-x-3 items-center text-rose-700 text-xl mb-4">
                <div className="w-3 h-3 bg-rose-500 block rounded-full" />
                <div>Declined</div>
              </div>
            )}

            <EventDetail
              image={selectedEvent?.customer?.image}
              name={selectedEvent?.customer?.username}
              title={selectedEvent?.title}
              description={selectedEvent?.customer?.email}
              start={selectedEvent?.start}
              duration={selectedEvent?.duration}
              price={selectedEvent?.price}
              paidBy={selectedEvent?.paidBy}
              theme="light"
            />

            {selectedEvent?.end > new Date() ? (
              selectedEvent?.paidBy === "none" ? (
                <div className="w-full h-10 flex justify-center mt-6">
                  <button
                    className="w-[calc(50%-8px)] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center"
                    onClick={() => cancelInvitation(selectedEvent._id)}
                  >
                    Cancel
                  </button>
                </div>
              ) : selectedEvent?.status === "pending" ? (
                <div className="w-full h-10 flex justify-between mt-6">
                  <button
                    className="w-[calc(50%-8px)] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center"
                    onClick={declineEvent}
                  >
                    Decline
                  </button>
                  <button
                    className="w-[calc(50%-8px)] bg-[#234C6A] hover:bg-[#1b3c53] text-white rounded-xl flex items-center justify-center disabled:opacity-50"
                    disabled={userDetails.status === "review"}
                    onClick={acceptEvent}
                  >
                    Accept
                  </button>
                </div>
              ) : selectedEvent?.status === "accepted" ? (
                <div className="w-full h-10 flex justify-center space-x-6 mt-6">
                  <button
                    className="w-[calc(50%-8px)] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center"
                    onClick={declineEvent}
                  >
                    Decline
                  </button>
                  <button
                    className="w-[calc(50%-8px)] bg-[#234C6A] hover:bg-[#1b3c53] text-white rounded-xl flex items-center justify-center disabled:opacity-50"
                    onClick={() => navigateCustomer(selectedEvent?.customer)}
                  >
                    Go To Chat
                  </button>
                </div>
              ) : null
            ) : (
              <div className="w-full h-10 flex justify-center mt-6">
                <button
                  className="w-[calc(50%-8px)] bg-[#234C6A] hover:bg-[#1b3c53] text-white rounded-xl flex items-center justify-center disabled:opacity-50"
                  onClick={() => navigateCustomer(selectedEvent?.customer)}
                >
                  Chat History
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {seminarModalShow ? (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div
            className="absolute top-0 left-0 w-full h-full cursor-pointer"
            onClick={() => { setSelectedEvent(null); setSeminarModalShow(false); }}
          />
          <div className="w-full max-w-[460px] max-h-[88vh] overflow-y-auto bg-white rounded-2xl text-slate-900 p-5 relative shadow-xl">
            <div className="text-center text-slate-900 text-xl mb-3 font-semibold">
              {selectedEvent?.type === "seminar" ? "Seminar Details" : "Session Details"}
            </div>
            <button
              className="absolute right-2 top-2 rounded-md hover:bg-slate-100 p-1"
              onClick={() => { setSelectedEvent(null); setSeminarModalShow(false); }}
            >
              <CloseIcon />
            </button>

            <SeminarDetails
              title={selectedEvent?.name}
              description={selectedEvent?.description}
              start={selectedEvent?.start}
              duration={selectedEvent?.duration}
              price={selectedEvent?.price}
              admin={selectedEvent?.admin}
              participants={selectedEvent?.participants}
              keywords={selectedEvent?.keywords}
              services={selectedEvent?.services}
              purposeOther={selectedEvent?.purposeOther}
              type={selectedEvent?.type}
              isRecurring={selectedEvent?.isRecurring}
              recurrenceFrequency={selectedEvent?.recurrenceFrequency}
              theme="light"
            />

            <div className="w-full h-10 flex justify-center mt-4 space-x-4">
              <button
                className="w-fit px-4 rounded-xl bg-[#234C6A] hover:bg-[#1b3c53] text-white flex items-center justify-center"
                onClick={() => {
                  if (selectedEvent?.type === "individual" && selectedEvent?.status === "pending") {
                    cancelAppointment(selectedEvent._id);
                  } else {
                    enterChatForSelected(selectedEvent);
                  }
                }}
              >
                {selectedEvent?.end > new Date()
                  ? selectedEvent?.type === "pending seminar"
                    ? "Cancel Request"
                    : selectedEvent?.type === "individual"
                    ? selectedEvent?.status === "pending"
                      ? "Cancel request"
                      : "Enter Chat"
                    : "Enter Seminar Chat"
                  : "Chat History"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default ExpertCalendar;
