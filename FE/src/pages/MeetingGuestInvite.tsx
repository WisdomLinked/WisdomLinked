import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { joinMeetingFromGuestInvite, resolveMeetingGuestInvite } from "../api/chatApi";
import { callLogout } from "../api/api";

export default function MeetingGuestInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jitsiUrl, setJitsiUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!token) {
        setError("Invalid invite link.");
        setLoading(false);
        return;
      }

      // If the user is already logged in, skip the invite landing page and enter the meeting directly.
      const stored = localStorage.getItem("currentUser");
      const currentUser = (() => {
        try {
          return stored && stored !== "undefined" ? JSON.parse(stored) : null;
        } catch {
          return null;
        }
      })();
      const isSignedIn = Boolean(currentUser?.email);
      setIsSignedIn(isSignedIn);

      if (isSignedIn) {
        const joinRes = await joinMeetingFromGuestInvite(token);
        if (cancelled) return;
        if (joinRes?.success && joinRes?.jitsiUrl) {
          // Replace current tab: user shouldn't see the invite screen at all.
          window.location.replace(joinRes.jitsiUrl);
          return;
        }
        // If user doesn't actually have access, fall back to guest flow UI.
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

  const redirectToLoginForFullExperience = async () => {
    const redirect = `/meeting/invite/${String(token || "")}`;
    if (isSignedIn) {
      setSwitchingAccount(true);
      try {
        await callLogout();
      } catch {
        // Best-effort logout; still clear local auth cache and continue.
      }
      localStorage.removeItem("currentUser");
      localStorage.removeItem("isLoginRemembered");
      localStorage.removeItem("location");
      setSwitchingAccount(false);
    }
    navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
  };

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
                onClick={() => void redirectToLoginForFullExperience()}
                disabled={switchingAccount}
              >
                {switchingAccount
                  ? "Switching account…"
                  : isSignedIn
                    ? "Switch account for full experience"
                    : "Login for full experience"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

