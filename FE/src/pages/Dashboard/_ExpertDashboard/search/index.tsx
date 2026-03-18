import React, { useMemo, useState } from "react";
import {
  Search as SearchIcon,
  GraduationCap,
  Star,
  BookOpen,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

const CLIENTS = [
  { id: 1, name: "Priya Sharma", initials: "PS", avatarColor: "bg-violet-100 text-violet-700", role: "B.Tech Student", university: "IIT Delhi", topics: ["Computer Science", "Machine Learning"], sessions: 4, rating: 4.9, lastActive: "2 days ago", status: "active" },
  { id: 2, name: "James Okafor", initials: "JO", avatarColor: "bg-emerald-100 text-emerald-700", role: "MBA Candidate", university: "Wharton School", topics: ["Resume Review", "Career Strategy"], sessions: 7, rating: 5.0, lastActive: "Today", status: "active" },
  { id: 3, name: "Mei Lin", initials: "ML", avatarColor: "bg-sky-100 text-sky-700", role: "MS Student", university: "Stanford University", topics: ["Civil Engineering"], sessions: 2, rating: 4.7, lastActive: "5 days ago", status: "new" },
  { id: 4, name: "Rohan Verma", initials: "RV", avatarColor: "bg-orange-100 text-orange-700", role: "Undergrad Student", university: "BITS Pilani", topics: ["Computer Science", "Resume Review"], sessions: 1, rating: 4.8, lastActive: "Today", status: "new" },
  { id: 5, name: "Sofia Mendes", initials: "SM", avatarColor: "bg-pink-100 text-pink-700", role: "MBA Student", university: "INSEAD", topics: ["Career Strategy", "Product Management"], sessions: 5, rating: 5.0, lastActive: "1 day ago", status: "active" },
  { id: 6, name: "Kwame Asante", initials: "KA", avatarColor: "bg-teal-100 text-teal-700", role: "M.Eng Student", university: "University of Toronto", topics: ["Civil Engineering", "Career Strategy"], sessions: 3, rating: 4.6, lastActive: "3 days ago", status: "active" },
];

const TOPIC_FILTERS = [
  "All",
  "Computer Science",
  "Civil Engineering",
  "Resume Review",
  "Career Strategy",
  "Machine Learning",
  "Product Management",
];

const TIME_SLOTS = [
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
];

function ClientsPage() {
  const [mode, setMode] = useState("browse"); // 'browse' | 'book'
  const [search, setSearch] = useState("");
  const [activeTopic, setActiveTopic] = useState("All");
  const [selectedClient, setSelectedClient] = useState(null);

  const [step, setStep] = useState(1); // 1,2,3
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionPrice, setSessionPrice] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const filteredClients = useMemo(() => {
    return CLIENTS.filter((c) => {
      const matchesTopic =
        activeTopic === "All" || c.topics.includes(activeTopic);
      const q = search.toLowerCase().trim();
      if (!q) return matchesTopic;
      const haystack = [
        c.name,
        c.role,
        c.university,
        ...c.topics,
      ]
        .join(" ")
        .toLowerCase();
      return matchesTopic && haystack.includes(q);
    });
  }, [search, activeTopic]);

  const startBooking = (client) => {
    setSelectedClient(client);
    setMode("book");
    setStep(1);
    setSelectedDate("");
    setSelectedTime("");
    setSessionTitle("");
    setSessionPrice("");
    setSessionNotes("");
    setBookingSuccess(false);
  };

  const resetToBrowse = () => {
    setMode("browse");
    setSelectedClient(null);
    setStep(1);
    setBookingSuccess(false);
  };

  const canContinueStep1 = !!selectedClient;
  const canContinueStep2 = !!selectedDate && !!selectedTime;
  const canConfirm =
    !!sessionTitle.trim() && !!sessionPrice && !isNaN(Number(sessionPrice));

  const handleConfirmBooking = () => {
    if (!canConfirm) return;
    setBookingSuccess(true);
  };

  const StepCircle = ({ index, label }) => {
    const isActive = step === index;
    const isCompleted = step > index;

    return (
      <div className="flex flex-1 items-center">
        <div className="flex flex-col items-center gap-1">
          <div
            className={[
              "flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold",
              isCompleted
                ? "bg-[#234C6A] text-white"
                : isActive
                  ? "bg-[#234C6A] text-white"
                  : "border border-slate-300 text-slate-500 bg-white",
            ].join(" ")}
          >
            {isCompleted ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              index
            )}
          </div>
          <span className="text-[11px] text-slate-600 text-center">
            {label}
          </span>
        </div>
        {index < 3 && (
          <div className="flex-1 h-px bg-slate-200 mx-2" aria-hidden="true" />
        )}
      </div>
    );
  };

  const renderClientSummary = () => {
    if (!selectedClient) return null;
    const c = selectedClient;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={[
                "h-11 w-11 rounded-full flex items-center justify-center text-xs font-semibold",
                c.avatarColor,
              ].join(" ")}
            >
              {c.initials}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {c.name}
              </div>
              <div className="text-[12px] text-slate-500">{c.role}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Selected
          </span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-slate-600">
          <GraduationCap className="h-4 w-4 text-slate-400" />
          <span>{c.university}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {c.topics.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[11px] text-teal-700"
            >
              {t}
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[12px] text-slate-600">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-slate-400" />
            <span>{c.sessions} sessions</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 text-amber-400" />
            <span>{c.rating.toFixed(1)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {mode === "browse" && (
        <div className="space-y-5">
          {/* Search bar */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
                      className="w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]"
              placeholder="Search by name, topic, or university"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Topic filters */}
          <div className="traditional-filters flex flex-wrap gap-2">
            {TOPIC_FILTERS.map((topic) => {
              const isActive = activeTopic === topic;
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setActiveTopic(topic)}
                  className={[
                    "px-3 py-1.5 rounded-full text-xs font-medium transition",
                    isActive
                      ? "bg-[#234C6A] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  ].join(" ")}
                >
                  {topic}
                </button>
              );
            })}
          </div>

          {/* Results count */}
          <div className="text-[12px] text-slate-500">
            Showing {filteredClients.length} clients
          </div>

          {/* Client cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((c) => (
              <div
                key={c.id}
                className="flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        "h-10 w-10 rounded-full flex items-center justify-center text-xs font-semibold",
                        c.avatarColor,
                      ].join(" ")}
                    >
                      {c.initials}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {c.role}
                      </div>
                    </div>
                  </div>
                  <span
                    className={[
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      c.status === "new"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-teal-50 text-teal-700",
                    ].join(" ")}
                  >
                    {c.status === "new" ? "New" : "Active"}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-1.5 text-[12px] text-slate-600">
                  <GraduationCap className="h-4 w-4 text-slate-400" />
                  <span>{c.university}</span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.topics.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[11px] text-teal-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between text-[12px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-slate-400" />
                    <span>{c.sessions} sessions</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 text-amber-400" />
                    <span>{c.rating.toFixed(1)}</span>
                  </div>
                </div>

                <div className="mt-1 text-[11px] text-slate-500">
                  Last active {c.lastActive}
                </div>

                <button
                  type="button"
                  onClick={() => startBooking(c)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#234C6A] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#1b3c53]"
                >
                  Book Session
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === "book" && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={resetToBrowse}
            className="inline-flex items-center gap-1 text-[13px] text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Clients
          </button>

          {/* Step indicator */}
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center">
              <StepCircle index={1} label="Select Customer" />
              <StepCircle index={2} label="Date & Time" />
              <StepCircle index={3} label="Title & Price" />
            </div>
          </div>

          {!bookingSuccess && step === 1 && (
            <div className="space-y-4">
              {renderClientSummary()}
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!canContinueStep1}
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#234C6A] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  Continue
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {!bookingSuccess && step === 2 && (
            <div className="space-y-5">
              {renderClientSummary()}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div>
                  <div className="text-[13px] font-medium text-slate-900 mb-1">
                    Select date
                  </div>
                  <input
                    type="date"
                    className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-slate-900 mb-2">
                    Select time
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const active = selectedTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={[
                            "rounded-lg border px-3 py-1.5 text-[12px] font-medium transition",
                            active
                              ? "bg-[#234C6A] border-[#234C6A] text-white"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
                          ].join(" ")}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[13px] text-slate-600 hover:text-slate-900"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canContinueStep2}
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#234C6A] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  Continue
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {!bookingSuccess && step === 3 && (
            <div className="space-y-5">
              {renderClientSummary()}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 max-w-xl">
                <div>
                  <div className="text-[13px] font-medium text-slate-900 mb-1">
                    Session Title
                  </div>
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]"
                    placeholder="e.g. Resume Review & LinkedIn Optimization"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-slate-900 mb-1">
                    Session Fee (USD)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-slate-600">$</span>
                    <input
                      className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]"
                      placeholder="120"
                      value={sessionPrice}
                      onChange={(e) => setSessionPrice(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[13px] font-medium text-slate-900 mb-1">
                    Notes for student{" "}
                    <span className="text-slate-400 text-[11px]">(optional)</span>
                  </div>
                  <textarea
                    className="w-full min-h-[90px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]"
                    placeholder="What will you cover in this session?"
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-between max-w-xl">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-[13px] text-slate-600 hover:text-slate-900"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canConfirm}
                  onClick={handleConfirmBooking}
                  className="inline-flex items-center gap-1 rounded-full bg-[#234C6A] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  Confirm Booking
                </button>
              </div>
            </div>
          )}

          {bookingSuccess && (
            <div className="space-y-5 max-w-xl">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex items-start gap-3">
                <div className="mt-1">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-emerald-900">
                    Session Booked!
                  </div>
                  <div className="mt-1 text-[13px] text-emerald-800">
                    Your session with{" "}
                    <span className="font-semibold">
                      {selectedClient?.name}
                    </span>{" "}
                    is scheduled for{" "}
                    <span className="font-semibold">
                      {selectedDate || "date"} at {selectedTime || "time"}
                    </span>
                    .
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={resetToBrowse}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to Clients
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ClientsPage;
