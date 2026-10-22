const ADMIN_DM_TARGET_ROLES = new Set(["expert", "customer"]);

export const canAdminInitiateDmWithRole = (role: unknown): boolean => {
  return ADMIN_DM_TARGET_ROLES.has(String(role || "").trim().toLowerCase());
};
