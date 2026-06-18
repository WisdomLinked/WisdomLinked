import React, { useEffect, useState } from "react";
import { Calendar } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import CloseIcon from "@mui/icons-material/Close";

import EventDetail from "./eventDetail";
import SeminarDetails from "../seminarDetails";

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
import { localizer } from "../../../actions/common";
import { updateMe } from "../../../actions/authActions";
import { setChosenGroupChatDetails } from "../../../actions/chatActions";
import { useNavigate } from "react-router-dom";
import { openExpertChatWithUser } from "../../../utils/expertOpenChatWithUser";

const ExpertCalendar: React.FC = () => {
  const {
    auth: { userDetails },
    friends: { groupChatList },
  } = useAppSelector((state: any) => state);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [eventModalShow, setEventModalShow] = useState<boolean>(false);
  const [seminarModalShow, setSeminarModalShow] = useState<boolean>(false);

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<any[]>([]);
  const [dayModalShow, setDayModalShow] = useState<boolean>(false);

  const eventStyleGetter = (event: any, _start: Date, end: Date) => {
    const now = new Date();
    const isPast = end < now;

    // Base colors using brand blue palette
    let backgroundColor = "#e8f0f8"; // light brand blue
    let borderColor = "#c3d4e8";
    let textColor = "#234C6A";

    if (event.type === "seminar") {
      backgroundColor = "#ecfdf3"; // light green for seminars
      borderColor = "#bbf7d0";
      textColor = "#14532d";
    } else if (event.type === "event" || event.type === "individual") {
      backgroundColor = "#e8f0f8";
      borderColor = "#c3d4e8";
      textColor = "#234C6A";
    }

    if (isPast) {
      backgroundColor = "#f3f4f6";
      borderColor = "#e5e7eb";
      textColor = "#9ca3af";
    }

    return {
      style: {
        backgroundColor,
        borderRadius: "8px",
        border: `1px solid ${borderColor}`,
        color: textColor,
        fontSize: "11px",
        padding: "2px 4px",
      },
    };
  };

  const handleSelectEvent = (event: any) => {
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
  };

  const navigateSeminar = (item: any) => {
    if (!item) return;
    const selectedGroupChat = groupChatList.find(
      (x: any) => x.groupId === item._id
    );
    navigate(`${process.env.REACT_APP_AUTH_URL}expertdashboard/chat`);
    dispatch(setChosenGroupChatDetails(selectedGroupChat));
  };

  const getEvents = async () => {
    SetLoadingStatus(true);
    const response = await doGetMyEvents();
    SetLoadingStatus(false);
    if (response) {
      dispatch({ type: "updateUserDetails", payload: response.result });

      const temp: any[] = response.result.events.map((event: any) => ({
        ...event,
        id: event._id,
        title: `(Legacy) ${event.title || "Session"}`,
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
          const isSeminar = g.type === "seminar";
          temp.push({
            ...g,
            id: g._id,
            start: new Date(g.start),
            end: new Date(g.end),
            title: isSeminar ? `(S) ${g.name}` : g.name || "1:1 session",
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

  const handleDayClick = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const filteredEvents = events.filter(
      (event: any) => event.start >= dayStart && event.start <= dayEnd
    );
    setSelectedDay(date);
    setSelectedDayEvents(filteredEvents);
    setDayModalShow(true);
  };

  useEffect(() => {
    getEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date();

  const sortedUpcoming = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto px-6 py-7 bg-[#F5F3EF]">
      {/* ✅ Fix off-month cells going black — override rbc default dark background */}
      <style>{`
  .rbc-off-range-bg { background-color: #f1f5f9 !important; }
  .rbc-off-range .rbc-button-link { color: #94a3b8 !important; }
  .rbc-today { background-color: #eff6ff !important; }

  /* ✅ Toolbar buttons - Back, Next, Today, Month, Week, Day, Agenda */
  .rbc-toolbar button {
    color: #334155 !important;
    font-size: 13px !important;
    background-color: #f8fafc !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 6px !important;
    padding: 5px 12px !important;
  }
  .rbc-toolbar button:hover {
    background-color: #e2e8f0 !important;
    color: #0f172a !important;
  }
  .rbc-toolbar button.rbc-active {
    background-color: #234c6a !important;
    color: #ffffff !important;
    border-color: #234c6a !important;
  }
  .rbc-toolbar button.rbc-active:hover {
    background-color: #1b3c53 !important;
    border-color: #1b3c53 !important;
  }

  /* ✅ Month label - "March 2026" */
  .rbc-toolbar-label {
    color: #0f172a !important;
    font-weight: 600 !important;
    font-size: 15px !important;
  }

  .rbc-header { background-color: #f8fafc; color: #475569; font-size: 12px; padding: 8px 0; }
  .rbc-month-view { border-radius: 8px; overflow: hidden; }
  .rbc-date-cell { color: #334155; font-size: 13px; }
`}</style>

      <div className="mb-5 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Calendar</h1>
          <p className="text-sm text-slate-500">
            See your upcoming seminars and 1:1 sessions, and jump into details.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E8EEF4] px-2 py-1 text-[11px] text-[#234C6A]">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Seminar
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
            1:1 session
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_minmax(260px,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Calendar
            style={{ height: 600 }}
            views={["month", "week", "day", "agenda"]}
            selectable
            localizer={localizer}
            defaultDate={today}
            defaultView="month"
            events={events || []}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={(slotInfo: any) => handleDayClick(slotInfo.start)}
          />
        </section>

        <section className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Upcoming events</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs">
              {sortedUpcoming.length === 0 && (
                <p className="text-[11px] text-slate-500">No events scheduled yet.</p>
              )}
              {sortedUpcoming.map((e: any) => (
                <div
                  key={e.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="font-semibold text-slate-900 truncate">{e.title}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        e.type === "seminar"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-sky-100 text-sky-700"
                      }`}
                    >
                      {e.type === "seminar" ? "Seminar" : "1:1 session"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {new Date(e.start).toLocaleDateString()} ·{" "}
                    {new Date(e.start).toLocaleTimeString()}
                  </div>
                  {e.customer?.username && (
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      With {e.customer.username}
                    </div>
                  )}
                  {e.status && (
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                      Status: {e.status}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {eventModalShow ? (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-10 flex items-center justify-center p-6">
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-10 flex items-center justify-center p-6">
          <div
            className="absolute top-0 left-0 w-full h-full cursor-pointer"
            onClick={() => { setSelectedEvent(null); setSeminarModalShow(false); }}
          />
          <div className="w-full max-w-[560px] bg-white rounded-2xl text-slate-900 p-6 relative shadow-xl">
            <div className="text-center text-slate-900 text-2xl mb-2 font-semibold">
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
              theme="light"
            />

            <div className="w-full h-10 flex justify-center mt-6 space-x-4">
              <button
                className="w-fit px-4 rounded-xl bg-[#234C6A] hover:bg-[#1b3c53] text-white flex items-center justify-center"
                onClick={() => {
                  if (selectedEvent?.type === "individual" && selectedEvent?.status === "pending") {
                    cancelAppointment(selectedEvent._id);
                  } else {
                    navigateSeminar(selectedEvent);
                  }
                }}
              >
                {selectedEvent?.end > new Date()
                  ? selectedEvent?.type === "pending seminar"
                    ? "Cancel Request"
                    : selectedEvent?.type === "individual"
                    ? selectedEvent?.status === "pending"
                      ? "Cancel request"
                      : "Enter Session"
                    : "Enter Seminar"
                  : "Chat History"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dayModalShow && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-10 flex items-center justify-center p-6">
          <div
            className="absolute top-0 left-0 w-full h-full cursor-pointer"
            onClick={() => setDayModalShow(false)}
          />
          <div className="w-full max-w-[700px] bg-white rounded-2xl text-slate-900 p-6 relative shadow-xl">
            <div className="text-center text-slate-900 text-2xl mb-6 font-semibold">
              Events on {selectedDay?.toLocaleDateString()}
            </div>
            <button
              className="absolute right-2 top-2 rounded-md hover:bg-slate-100 p-1"
              onClick={() => setDayModalShow(false)}
            >
              <CloseIcon />
            </button>

            {selectedDayEvents.length === 0 ? (
              <div className="text-center py-4">No events scheduled for this day</div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                {selectedDayEvents.map((event: any) => (
                  <div key={event.id} className="mb-4 pb-4 border-b border-slate-200">
                    <div className="font-bold mb-2">{event.title}</div>
                    <div className="text-sm">
                      {new Date(event.start).toLocaleTimeString()} -{" "}
                      {new Date(event.end).toLocaleTimeString()}
                    </div>
                    {event.type === "event" ? (
                      <div className="mt-2 text-sm">
                        Session with {event.customer?.username || "Unknown"}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm">Seminar</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpertCalendar;