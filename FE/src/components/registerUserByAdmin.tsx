import React, { useState } from "react";
import AdminRegisterCustomer from "./adminRegisterCustomer";
import AdminRegisterExpert from "./adminRegisterExpert";
import AdminInviteAdmin from "./adminInviteAdmin";

function RegisterUserByAdmin() {
    const [view, setView] = useState<"none" | "customer" | "expert" | "admin">("none");

    const choiceCardClass =
        "bg-white border border-wl-line hover:border-wl-brand/35 p-8 rounded-2xl shadow-[0_10px_30px_rgba(35,76,106,0.08)] hover:shadow-[0_16px_40px_rgba(35,76,106,0.12)] transition-all cursor-pointer w-full sm:w-72 min-h-[220px] flex flex-col justify-center text-center";

    return (
        <div className="w-full min-h-full bg-wl-page text-wl-ink relative z-[1] flex flex-col items-center px-[18px] pt-10 pb-10">
            {view === "none" && (
                <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
                    <div className="bg-white border border-wl-line p-6 rounded-2xl shadow-sm mb-8 w-full text-center max-w-xl">
                        <h2 className="text-2xl font-semibold text-wl-brand mb-2">
                            Register a New User (Admin)
                        </h2>
                        <p className="text-wl-muted text-sm sm:text-base">
                            Manage user creation by selecting which type of account to register.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 items-stretch justify-center w-full flex-wrap">
                        <div
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") setView("customer");
                            }}
                            onClick={() => setView("customer")}
                            className={choiceCardClass}
                        >
                            <h3 className="text-xl font-semibold text-wl-brand mb-3">
                                Register a Customer
                            </h3>
                            <p className="text-wl-muted text-sm leading-relaxed">
                                Create a new <strong className="text-wl-ink font-medium">Customer</strong> account.
                            </p>
                        </div>

                        <div
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") setView("expert");
                            }}
                            onClick={() => setView("expert")}
                            className={choiceCardClass}
                        >
                            <h3 className="text-xl font-semibold text-wl-brand mb-3">
                                Register an Expert
                            </h3>
                            <p className="text-wl-muted text-sm leading-relaxed">
                                Create a new <strong className="text-wl-ink font-medium">Expert</strong> account.
                            </p>
                        </div>

                        <div
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") setView("admin");
                            }}
                            onClick={() => setView("admin")}
                            className={choiceCardClass}
                        >
                            <h3 className="text-xl font-semibold text-wl-brand mb-3">
                                Invite Admin
                            </h3>
                            <p className="text-wl-muted text-sm leading-relaxed">
                                Create another <strong className="text-wl-ink font-medium">Admin</strong> account.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {view !== "none" && (
                <button
                    type="button"
                    className="mb-6 self-start sm:self-center bg-wl-brand text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:brightness-95 transition-colors shadow-sm"
                    onClick={() => setView("none")}
                >
                    &larr; Go Back
                </button>
            )}

            {view === "customer" && <AdminRegisterCustomer />}
            {view === "expert" && <AdminRegisterExpert />}
            {view === "admin" && <AdminInviteAdmin />}
        </div>
    );
}

export default RegisterUserByAdmin;
