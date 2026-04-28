import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resolveMeetingGuestInvite } from "../api/chatApi";

export default function MeetingGuestInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jitsiUrl, setJitsiUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const handleLoginForFullExperience = () => {
    try {
      const raw = window.localStorage.getItem("currentUser");
      const user = raw && raw !== "undefined" ? JSON.parse(raw) : null;
      if (user?.email && user?.role) {
        const dashboardPath = user.role === "customer"
          ? "/user/studentdashboard"
          : `/user/${String(user.role)}dashboard`;
        navigate(dashboardPath);
        return;
      }
    } catch {
      // fall through to login route if local data is invalid
    }
    navigate("/login");
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!token) {
        setError("Invalid invite link.");
        setLoading(false);
        return;
      }
      const res = await resolveMeetingGuestInvite(token);
      if (cancelled) return;
      if (!res?.success || !res?.jitsiUrl) {
        setError(res?.error || "Invite is invalid or expired.");
      } else {
        setJitsiUrl(res.jitsiUrl);
        setExpiresAt(String(res.expiresAt || ""));
      }
      setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-slate-900">WisdomLinked Meet invite</h1>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Validating invite…</p>
        ) : error ? (
          <p className="mt-3 text-sm text-rose-700">{error}</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-slate-600">
              You were invited to join a WisdomLinked video call.
            </p>
            {expiresAt ? (
              <p className="mt-1 text-xs text-slate-500">
                Expires at: {new Date(expiresAt).toLocaleString()}
              </p>
            ) : null}
            <div className="mt-4 space-y-2">
              <button
                type="button"
                className="w-full rounded-xl bg-[#234C6A] px-4 py-2 text-sm font-semibold text-white hover:brightness-105"
                onClick={() => window.open(jitsiUrl, "_blank", "noopener,noreferrer")}
              >
                Continue as guest
              </button>
              <button
                type="button"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={handleLoginForFullExperience}
              >
                Login for full experience
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

