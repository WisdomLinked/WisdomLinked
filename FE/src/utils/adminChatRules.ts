export const canAdminInitiateDmWithRole = (role: unknown): boolean => {
  return String(role || "").toLowerCase() === "expert";
};

