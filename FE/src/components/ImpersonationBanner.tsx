import React from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { stopImpersonation } from "../api/api";
import { actionTypes } from "../actions/types";
import { SetLoadingStatus } from "../actions/appActions";

const STORAGE_KEY = "impersonating";

export type ImpersonationInfo = {
    email: string;
    username?: string;
    role?: string;
};

export function setImpersonationSession(info: ImpersonationInfo) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    } catch {
        // ignore
    }
}

export function clearImpersonationSession() {
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}

export function readImpersonationSession(): ImpersonationInfo | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as ImpersonationInfo;
    } catch {
        return null;
    }
}

export default function ImpersonationBanner() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [info, setInfo] = React.useState<ImpersonationInfo | null>(() => readImpersonationSession());

    React.useEffect(() => {
        const sync = () => setInfo(readImpersonationSession());
        sync();
        window.addEventListener("storage", sync);
        window.addEventListener("wl-impersonation-change", sync);
        return () => {
            window.removeEventListener("storage", sync);
            window.removeEventListener("wl-impersonation-change", sync);
        };
    }, []);

    if (!info?.email) return null;

    const handleExit = async () => {
        SetLoadingStatus(true);
        try {
            const res = await stopImpersonation();
            clearImpersonationSession();
            window.dispatchEvent(new Event("wl-impersonation-change"));
            if (res?.status === "SUCCESS" && res.userDetails) {
                localStorage.setItem("currentUser", JSON.stringify(res.userDetails));
                dispatch({
                    type: actionTypes.authenticate,
                    payload: res.userDetails,
                });
                navigate("/user/admindashboard", { replace: true });
            } else {
                window.location.href = "/user/admindashboard";
            }
        } catch (err) {
            console.error(err);
            clearImpersonationSession();
            window.location.href = "/user/admindashboard";
        } finally {
            SetLoadingStatus(false);
        }
    };

    return (
        <>
            <div className="fixed top-0 inset-x-0 z-[9999] bg-amber-500 text-wl-ink shadow-md">
                <div className="mx-auto max-w-[1400px] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
                    <span>
                        Impersonating <strong>{info.username || info.email}</strong>
                        {info.role ? ` (${info.role})` : ""} — you are viewing the app as this user.
                    </span>
                    <button
                        type="button"
                        onClick={handleExit}
                        className="rounded-lg bg-wl-ink text-white px-3 py-1.5 text-xs font-semibold hover:opacity-90"
                    >
                        Exit impersonation
                    </button>
                </div>
            </div>
            <div aria-hidden className="h-11" />
        </>
    );
}
