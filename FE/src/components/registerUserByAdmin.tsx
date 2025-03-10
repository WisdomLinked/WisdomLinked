import React, { useState } from "react";
import AdminRegisterCustomer from "./adminRegisterCustomer";
import AdminRegisterExpert from "./adminRegisterExpert";

function RegisterUserByAdmin() {
    const [view, setView] = useState<"none" | "customer" | "expert">("none");

    return (
        <div className="w-full min-h-screen bg-[#181818] text-white relative z-[9999] flex flex-col items-center py-6">
            {view === "none" && (
                <div className="w-fit flex flex-col items-center">
                    <div className="bg-[#181818] p-6 rounded-md shadow-lg mb-6 w-fit text-center">
                        <h2 className="text-2xl font-bold text-[#31B099] mb-2">
                            Register a New User (Admin)
                        </h2>
                        <p className="text-gray-300">
                            Manage user creation by selecting which type of account to register.
                        </p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6 items-center justify-center w-fit">
                        <div
                            onClick={() => setView("customer")}
                            className="bg-[#252525] hover:bg-[#2e2e2e] p-6 rounded-lg shadow-md
                         hover:shadow-xl transition-shadow cursor-pointer w-64 text-center"
                        >
                            <h3 className="text-xl font-semibold text-[#31B099] mb-2">
                                Register a Customer
                            </h3>
                            <p className="text-gray-400">
                                Create a new <strong>Customer</strong> account.
                            </p>
                        </div>

                        <div
                            onClick={() => setView("expert")}
                            className="bg-[#252525] hover:bg-[#2e2e2e] p-6 rounded-lg shadow-md
                         hover:shadow-xl transition-shadow cursor-pointer w-64 text-center"
                        >
                            <h3 className="text-xl font-semibold text-[#31B099] mb-2">
                                Register an Expert
                            </h3>
                            <p className="text-gray-400">
                                Create a new <strong>Expert</strong> account.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {view !== "none" && (
                <button
                    className="mb-4 bg-[#31B099] text-black px-4 py-2 rounded
                     hover:bg-[#28a286] transition-colors w-fit"
                    onClick={() => setView("none")}
                >
                    &larr; Go Back
                </button>
            )}

            {view === "customer" && <AdminRegisterCustomer />}
            {view === "expert" && <AdminRegisterExpert />}
        </div>
    );
}

export default RegisterUserByAdmin;
