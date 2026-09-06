import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Calendar, Clock, User } from "lucide-react";
import { doGetAdminPlatformEvents, type AdminPlatformEventItem } from "../../../api/api";
import { SetLoadingStatus } from "../../../actions/appActions";

const AUTH_BASE = process.env.REACT_APP_AUTH_URL || "/user/";

const SCOPES = [
  { id: "today" as const, label: "Today" },
  { id: "upcoming" as const, label: "Upcoming" },
  { id: "past" as const, label: "Past" },
  { id: "all" as const, label: "All" },
];

function kindLabel(kind: AdminPlatformEventItem["kind"]) {
  if (kind === "booking") return "1:1 booking";
  if (kind === "seminar") return "Seminar";
  return "1:1 session";
}

function formatRange(start: string, end: string) {
  const a = new Date(start);
  const b = new Date(end);
  return `${a.toLocaleString()} → ${b.toLocaleString()}`;
}

function usermgmtEmailHref(email?: string) {
  if (!email) return `${AUTH_BASE}admindashboard/usermgmt`;
  return `${AUTH_BASE}admindashboard/usermgmt?email=${encodeURIComponent(email)}`;
}

export default function AdminUpcomingEvents() {
  const [searchParams, setSearchParams] = useSearchParams();

  const scopeFromUrl = searchParams.get("scope") as
    | "today"
    | "upcoming"
    | "past"
    | "all"
    | null;
  const [scope, setScope] = useState<"today" | "upcoming" | "past" | "all">(
    scopeFromUrl && ["today", "upcoming", "past", "all"].includes(scopeFromUrl)
      ? scopeFromUrl
      : "upcoming"
  );

  const [typeBookings, setTypeBookings] = useState(true);
  const [typeSeminars, setTypeSeminars] = useState(true);
  const [typeOneToOne, setTypeOneToOne] = useState(true);

  const [items, setItems] = useState<AdminPlatformEventItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const s = searchParams.get("scope");
    if (s && ["today", "upcoming", "past", "all"].includes(s)) {
      setScope(s as "today" | "upcoming" | "past" | "all");
    }
  }, [searchParams]);

  const buildTypes = useCallback(() => {
    const t: string[] = [];
    if (typeBookings) t.push("event");
    if (typeSeminars) t.push("seminar");
    if (typeOneToOne) t.push("oneToOne");
    return t;
  }, [typeBookings, typeSeminars, typeOneToOne]);

  const load = useCallback(async () => {
    const types = buildTypes();
    if (!types.length) {
      setItems([]);
      return;
    }
    SetLoadingStatus(true);
    setLoadError(null);
    try {
      const res = await doGetAdminPlatformEvents({ scope, types });
      if (res && res.status === "SUCCESS" && Array.isArray(res.items)) {
        setItems(res.items);
      } else {
        setItems([]);
        setLoadError("Could not load events.");
      }
    } catch (e: unknown) {
      setItems([]);
      setLoadError("Could not load events.");
    } finally {
      SetLoadingStatus(false);
    }
  }, [scope, buildTypes]);

  useEffect(() => {
    load();
  }, [load]);

  const setScopeAndUrl = (next: typeof scope) => {
    setScope(next);
    setSearchParams({ scope: next }, { replace: true });
  };

  return (
    <div className="min-h-full w-full bg-wl-page px-[18px] pb-10 pt-8 text-wl-ink">
      <div className="mx-auto max-w-[1100px]">
        <div className="text-left">
          <h2 className="text-2xl font-semibold text-wl-brand">Upcoming events</h2>
          <p className="mt-1 text-sm text-wl-muted">
            1:1 bookings, seminars, and group sessions. Filter by time and type.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-6 rounded-2xl border border-wl-line bg-white p-5 shadow-[0_10px_30px_rgba(35,76,106,0.08)] sm:p-6">
          <div>
            <div className="mb-2 text-left text-xs font-semibold uppercase tracking-wide text-wl-muted">
              When
            </div>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScopeAndUrl(s.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    scope === s.id
                      ? "bg-wl-brand text-white shadow-sm"
                      : "border border-wl-line bg-wl-pageAlt text-wl-ink hover:border-wl-brand/30"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-left text-xs font-semibold uppercase tracking-wide text-wl-muted">
              Types
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-wl-ink">
                <input
                  type="checkbox"
                  className="rounded border-lightgrey text-wl-brand focus:ring-wl-brand/30"
                  checked={typeBookings}
                  onChange={(e) => setTypeBookings(e.target.checked)}
                />
                1:1 bookings
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-wl-ink">
                <input
                  type="checkbox"
                  className="rounded border-lightgrey text-wl-brand focus:ring-wl-brand/30"
                  checked={typeSeminars}
                  onChange={(e) => setTypeSeminars(e.target.checked)}
                />
                Seminars
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-wl-ink">
                <input
                  type="checkbox"
                  className="rounded border-lightgrey text-wl-brand focus:ring-wl-brand/30"
                  checked={typeOneToOne}
                  onChange={(e) => setTypeOneToOne(e.target.checked)}
                />
                Group 1:1 sessions
              </label>
            </div>
          </div>
        </div>

        {loadError ? (
          <p className="mt-6 text-center text-sm text-red-600">{loadError}</p>
        ) : null}

        <div className="mt-8 space-y-4">
          {items.length === 0 && !loadError ? (
            <div className="rounded-2xl border border-dashed border-wl-line bg-wl-card/60 px-6 py-16 text-center text-sm text-wl-muted">
              No events match these filters.
            </div>
          ) : (
            items.map((row) => (
              <div
                key={`${row.kind}-${row.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-wl-line bg-white p-5 text-left shadow-[0_8px_24px_rgba(35,76,106,0.07)] sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-lg bg-wl-brandSoft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-wl-brand">
                      {kindLabel(row.kind)}
                    </span>
                    {row.status ? (
                      <span className="text-xs text-wl-muted">Status: {row.status}</span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 font-semibold text-wl-ink">{row.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-wl-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4 shrink-0 text-wl-brand" aria-hidden />
                      {formatRange(row.start, row.end)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    {row.expert ? (
                      <span className="inline-flex items-center gap-1.5 text-wl-ink/90">
                        <User className="h-4 w-4 shrink-0 text-green" aria-hidden />
                        <span className="text-wl-muted">Expert:</span>{" "}
                        {row.expert.email ? (
                          <Link
                            to={usermgmtEmailHref(row.expert.email)}
                            className="font-medium text-wl-brand underline decoration-wl-brand/30 underline-offset-2 hover:brightness-95"
                            title="Open in User management"
                          >
                            {row.expert.username || row.expert.email}
                          </Link>
                        ) : (
                          row.expert.username || "—"
                        )}
                      </span>
                    ) : null}
                    {row.customer ? (
                      <span className="inline-flex items-center gap-1.5 text-wl-ink/90">
                        <img src="/icons/video-call.png" alt="" aria-hidden className="h-4 w-4 shrink-0 object-contain" />
                        <span className="text-wl-muted">Student:</span>{" "}
                        {row.customer.email ? (
                          <Link
                            to={usermgmtEmailHref(row.customer.email)}
                            className="font-medium text-wl-brand underline decoration-wl-brand/30 underline-offset-2 hover:brightness-95"
                            title="Open in User management"
                          >
                            {row.customer.username || row.customer.email}
                          </Link>
                        ) : (
                          row.customer.username || "—"
                        )}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-end sm:pt-1">
                  <Calendar className="h-10 w-10 text-wl-brand/25" aria-hidden />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
