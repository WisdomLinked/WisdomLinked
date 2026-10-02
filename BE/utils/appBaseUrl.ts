const LEGACY_APP_BASE_URL = "https://wisdomlinked.com";

export const resolveAppBaseUrl = (env: Record<string, string | undefined> = process.env): string => {
    const configured = String(
        env.FRONTEND_BASE_URL || env.FE_URL || env.REACT_APP_URL || "",
    )
        .trim()
        .replace(/\/+$/, "");
    return configured || LEGACY_APP_BASE_URL;
};

export const appAssetUrl = (
    path: string,
    env: Record<string, string | undefined> = process.env,
): string => `${resolveAppBaseUrl(env)}/${String(path || "").replace(/^\/+/, "")}`;

/**
 * Where a reminder's call-to-action should land.
 *
 * There is no URL for an individual session — the dashboards are catch-all routes
 * that hold the selected session in component state — so the best available target
 * is the recipient's own dashboard rather than the site root.
 */
export const appDashboardUrl = (
    role: string | null | undefined,
    env: Record<string, string | undefined> = process.env,
): string => {
    const path = String(role || "").toLowerCase() === "expert"
        ? "user/expertdashboard"
        : "user/studentdashboard";
    return `${resolveAppBaseUrl(env)}/${path}`;
};
