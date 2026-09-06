import React, { useState } from "react";
import { inviteAdmin } from "../api/api";
import { validateEmail, checkTitleNameInvalid } from "../actions/common";
import { SetLoadingStatus } from "../actions/appActions";
import FormAlert from "./FormAlert";
import { useFormAlert } from "../hooks/useFormAlert";
import ShowFieldError from "./ShowFieldError";

function AdminInviteAdmin() {
    const { message: formBannerMessage, variant: formBannerVariant, setFormError, setFormSuccess, clearFormAlert } =
        useFormAlert();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [autoPassword, setAutoPassword] = useState(true);
    const [showError, setShowError] = useState(false);

    const emailOk = validateEmail(email);
    const usernameError = checkTitleNameInvalid("Username", username);
    const canSubmit = Boolean(username && !usernameError && emailOk && (autoPassword || password.length >= 8));

    const handleInvite = async () => {
        clearFormAlert();
        if (!canSubmit) {
            setShowError(true);
            return;
        }
        SetLoadingStatus(true);
        try {
            const res = await inviteAdmin({
                email,
                username,
                password: autoPassword ? undefined : password,
            });
            if (res?.status === "SUCCESS") {
                const temp = res.temporaryPassword ? ` Temporary password: ${res.temporaryPassword}` : "";
                setFormSuccess(`Admin invited successfully.${temp}`);
                setUsername("");
                setEmail("");
                setPassword("");
            } else {
                setFormError(res?.error || "Failed to invite admin.");
            }
        } catch (err) {
            console.error(err);
            setFormError("Failed to invite admin.");
        } finally {
            SetLoadingStatus(false);
        }
    };

    return (
        <div className="w-full max-w-lg mx-auto bg-white border border-wl-line rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-wl-brand mb-1">Invite admin</h3>
            <p className="text-sm text-wl-muted mb-5">
                Creates an active admin account and sends a welcome email with a temporary password.
            </p>
            <FormAlert message={formBannerMessage} variant={formBannerVariant} />

            <label className="block text-sm text-wl-muted mb-1">Username</label>
            <input
                className="w-full mb-1 px-3 py-2 rounded-xl border border-lightgrey"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />
            {showError && usernameError ? <ShowFieldError show label={usernameError} /> : null}

            <label className="block text-sm text-wl-muted mb-1 mt-3">Email</label>
            <input
                className="w-full mb-1 px-3 py-2 rounded-xl border border-lightgrey"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            {showError && !emailOk ? <ShowFieldError show label="Enter a valid email." /> : null}

            <label className="flex items-center gap-2 text-sm text-wl-ink mt-4 mb-2">
                <input
                    type="checkbox"
                    checked={autoPassword}
                    onChange={(e) => setAutoPassword(e.target.checked)}
                />
                Auto-generate temporary password
            </label>

            {!autoPassword ? (
                <>
                    <label className="block text-sm text-wl-muted mb-1">Temporary password</label>
                    <input
                        type="password"
                        className="w-full mb-1 px-3 py-2 rounded-xl border border-lightgrey"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    {showError && password.length < 8 ? (
                        <ShowFieldError show label="Password must be at least 8 characters." />
                    ) : null}
                </>
            ) : null}

            <button
                type="button"
                onClick={handleInvite}
                className="mt-5 w-full bg-wl-brand text-white py-2.5 rounded-xl font-medium hover:brightness-95"
            >
                Invite admin
            </button>
        </div>
    );
}

export default AdminInviteAdmin;
